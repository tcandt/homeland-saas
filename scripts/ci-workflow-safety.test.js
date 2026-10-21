const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const workflowModel = () => yaml.parse(read('.github/workflows/ci-cd-pipeline.yml'), { uniqueKeys: true });
const remoteJobs = ['deploy-staging', 'health-smoke-staging', 'core-10-04-staging-gate', 'rollback-staging', 'deploy-production', 'health-smoke-production', 'rollback-production'];

test('secret scan checks out history needed by multi-commit push ranges', () => {
  const steps = workflowModel().jobs['security-scan'].steps;
  const checkout = steps.find(step => step.uses === 'actions/checkout@v4');
  assert.equal(checkout.with['fetch-depth'], 0);
  assert.ok(steps.findIndex(step => step.name === 'Gitleaks Secret Scan') > steps.indexOf(checkout));
});

test('workflow YAML has real jobs, scoped integration env and no duplicate top-level keys', () => {
  const workflow = workflowModel();
  assert.equal(workflow.env.PUPPETEER_SKIP_DOWNLOAD, 'true');
  assert.equal(workflow.jobs['integration-test'].env.DATABASE_URL, 'postgresql://homeland:homeland123@localhost:5433/homeland?schema=public');
  assert.equal(workflow.jobs['integration-test'].env.REDIS_URL, 'redis://localhost:6385');
  assert.ok(Array.isArray(workflow.jobs['integration-test'].steps));
  for (const [name, job] of Object.entries(workflow.jobs)) {
    assert.ok(job['runs-on'], `Missing runner: ${name}`);
    assert.ok(Array.isArray(job.steps), `Missing steps: ${name}`);
    for (const dependency of job.needs || []) assert.ok(workflow.jobs[dependency], `Unknown dependency: ${dependency}`);
  }
});

test('push and PR can test but cannot publish or contact the NAS/legacy VPS', () => {
  const workflow = workflowModel();
  assert.equal(workflow.on.workflow_dispatch.inputs.publish_release.default, false);
  assert.match(workflow.jobs['semantic-release'].if, /github.event_name == 'workflow_dispatch'/);
  assert.match(workflow.jobs['semantic-release'].if, /inputs.publish_release == true/);
  assert.equal(workflow.jobs['semantic-release'].environment, 'release-approval');
  for (const name of remoteJobs) assert.equal(workflow.jobs[name].if, '${{ false }}', `${name} must never run in the local repair milestone`);
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (job.steps.some((step) => /ssh-action/.test(step.uses || ''))) assert.ok(remoteJobs.includes(name));
  }
});

test('disabled staging gate checks the current release against an approved fingerprint, not baseline18', () => {
  const gate = workflowModel().jobs['core-10-04-staging-gate'];
  assert.equal(gate.if, '${{ false }}');
  assert.equal(gate.env.E2E_TARGET_DB_ID, gate.env.STAGING_DB_ID);
  assert.equal(gate.env.E2E_EXPECTED_BUILD_SHA, '${{ github.sha }}');
  assert.equal(gate.env.E2E_STAGING_ORIGINS, '${{ vars.STAGING_ORIGINS }}');
  const config = gate.steps.find((step) => step.name === 'Fail fast on required staging configuration');
  assert.match(config.run, /node scripts\/staging-url-guard\.js/);
  const identity = gate.steps.find((step) => step.name === 'Check staging database identity');
  assert.match(identity.run, /node scripts\/staging-diagnostics-guard\.js/);
  assert.doesNotMatch(identity.run, /migrationCount == 18|canonicalFingerprint/);
});

test('owner-approved CI, API and Web use Node22 without changing framework versions', () => {
  for (const [name, job] of Object.entries(workflowModel().jobs)) {
    for (const step of job.steps) {
      if (/actions\/setup-node@/.test(step.uses || '')) assert.equal(step.with['node-version'], '22', `Runtime mismatch: ${name}`);
    }
  }
  assert.match(read('Dockerfile.api'), /FROM node:22/);
  assert.match(read('Dockerfile.web'), /FROM node:22-alpine AS base/);
});

test('CI uses dedicated loopback-only services with no production env or volume reference', () => {
  const compose = yaml.parse(read('docker-compose.ci.yml'));
  assert.deepEqual(Object.keys(compose.services).sort(), ['postgres', 'redis']);
  assert.deepEqual(compose.services.postgres.ports, ['127.0.0.1:5433:5432']);
  assert.deepEqual(compose.services.redis.ports, ['127.0.0.1:6385:6379']);
  assert.deepEqual(Object.keys(compose.volumes), ['ci-postgres']);
  assert.doesNotMatch(read('docker-compose.ci.yml'), /env_file:|external:\s*true|container_name:/);
  for (const name of ['integration-test', 'e2e']) {
    const steps = workflowModel().jobs[name].steps;
    assert.ok(steps.some((step) => /docker compose -f docker-compose\.ci\.yml -p homeland-ci-/.test(step.run || '')));
  }
});

test('API image startup never pushes, resets, seeds, or starts a dev watcher', () => {
  const entrypoint = read('scripts/docker-api-entrypoint.sh');
  assert.doesNotMatch(entrypoint, /prisma\s+db\s+push|force-reset|accept-data-loss|prisma\s+db\s+seed|npm\s+run\s+dev/i);
  assert.match(entrypoint, /node node_modules\/prisma\/build\/index\.js migrate deploy/);
  assert.match(entrypoint, /RUN_DB_MIGRATIONS:-false/);
  assert.match(entrypoint, /cd apps\/api\s+exec node dist\/main/);
  assert.doesNotMatch(entrypoint, /^\s*(?:exec\s+)?(?:npm|npx)\b/m);
});

test('CI browser acceptance binds fixture writes to its disposable database and disables background delivery', () => {
  const env = workflowModel().jobs.e2e.env;
  const compose = yaml.parse(read('docker-compose.ci.yml'));
  assert.equal(env.E2E_DATABASE_URL, env.DATABASE_URL);
  const databaseUrl = new URL(env.E2E_DATABASE_URL);
  assert.equal(databaseUrl.hostname, 'localhost');
  assert.equal(databaseUrl.port, '5433');
  assert.equal(databaseUrl.pathname.slice(1), env.E2E_TARGET_DB_ID);
  assert.equal(env.E2E_TARGET_DB_ID, compose.services.postgres.environment.POSTGRES_DB);
  assert.equal(env.E2E_DISPOSABLE_DATABASE, 'true');
  assert.match(env.E2E_RUN_ID, /^ci-e2e-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}$/);
  assert.equal(env.RUN_DESTRUCTIVE_E2E, true);
  assert.equal(env.DISABLE_SCHEDULED_JOBS, 'true');
  assert.equal(env.APP_RUNTIME_ROLE, 'api');
  assert.equal(env.COMMUNICATION_IMMEDIATE_DELIVERY, 'false');
  assert.equal(env.ALLOW_REGISTRATION, 'false');
  assert.equal(env.NEXT_PUBLIC_ALLOW_REGISTRATION, 'false');
  assert.ok(workflowModel().jobs.e2e.steps.some((step) =>
    /playwright test tests\/e2e\/smoke tests\/e2e\/production\/registration-closed\.desktop\.spec\.ts/.test(step.run || ''),
  ), 'CI must execute the public-registration closure gate');
});

test('Docker images compile API code and bake a same-origin web API route', () => {
  const apiDockerfile = read('Dockerfile.api');
  const webDockerfile = read('Dockerfile.web');
  assert.match(apiDockerfile, /npm run db:generate/);
  assert.match(apiDockerfile, /npm run build --workspace=api/);
  assert.match(apiDockerfile, /RUN npm ci/);
  assert.match(apiDockerfile, /npm prune --omit=dev/);
  assert.match(apiDockerfile, /npm install --no-save --omit=dev --ignore-scripts prisma@5\.22\.0/);
  assert.match(webDockerfile, /ARG NEXT_PUBLIC_API_URL=\/api\/v1/);
  assert.match(webDockerfile, /ARG INTERNAL_API_ORIGIN=http:\/\/api:3001/);
  assert.match(webDockerfile, /ARG NEXT_PUBLIC_ALLOW_REGISTRATION=false/);
  assert.match(webDockerfile, /npm run build -w @homeland\/shared/);
  assert.match(webDockerfile, /RUN npm ci/);
});

test('Docker context excludes local dependencies, builds, reports, secrets, and backups', () => {
  const dockerignore = read('.dockerignore');
  for (const requiredPattern of [
    '**/node_modules',
    '**/.next',
    '**/dist',
    '.git',
    '.tmp*',
    '**/playwright-report',
    '**/test-results',
    '.codex-backups',
    '*.bak',
    '.env.*',
    '**/.env',
    '**/.env.*',
    '**/.agentflow',
    '**/.agents',
    '**/.codex',
    '**/.eos',
    '**/deploy/public-production/release',
    '**/deploy/public-production/release-*',
    '**/deploy/**/node_modules',
    '**/scratch',
    '**/tmp',
    '**/screenshots',
  ]) {
    assert.ok(dockerignore.split(/\r?\n/).includes(requiredPattern), `Missing .dockerignore pattern: ${requiredPattern}`);
  }
  assert.doesNotMatch(dockerignore, /^\*\*\/storage$/m);
  assert.match(dockerignore, /^!\/\.env\.example$/m);
  assert.match(dockerignore, /^!\/\.env\.docker\.example$/m);
  assert.doesNotMatch(dockerignore, /^!\*\*\/\.env/m);
});

test('frontend build arguments are attached to the web image only', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  const apiBlock = workflow.slice(workflow.indexOf('# Docker Build & Push for API'), workflow.indexOf('# Docker Build & Push for Web'));
  const webBlock = workflow.slice(workflow.indexOf('# Docker Build & Push for Web'), workflow.indexOf('Download Security Artifacts'));
  assert.doesNotMatch(apiBlock, /NEXT_PUBLIC_API_URL|INTERNAL_API_ORIGIN|NEXT_PUBLIC_ALLOW_REGISTRATION/);
  assert.match(webBlock, /NEXT_PUBLIC_API_URL=\/api\/v1/);
  assert.match(webBlock, /INTERNAL_API_ORIGIN=http:\/\/api:3001/);
  assert.match(webBlock, /NEXT_PUBLIC_ALLOW_REGISTRATION=false/);
});

test('deployment workflow preserves env files and validates compose before restart', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  assert.doesNotMatch(workflow, /\\\$/);
  assert.doesNotMatch(workflow, /mv \.env\.tmp \.env|echo "PREVIOUS_API_TAG=.*> \.env\.tmp/);
  assert.match(workflow, /\.env\.backup-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(workflow, /docker compose config --quiet/);
  assert.ok((workflow.match(/update_env RUN_DB_MIGRATIONS false/g) || []).length >= 4);
  for (const name of remoteJobs) assert.equal(workflowModel().jobs[name].if, '${{ false }}');
});

test('CodeQL analysis is mandatory and is not gated by an unreliable capability probe', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  const securityScan = workflowModel().jobs['security-scan'];
  const codeqlSteps = securityScan.steps.filter((step) => /github\/codeql-action\/(?:init|analyze)@v3/.test(step.uses || ''));
  assert.equal(codeqlSteps.length, 2);
  for (const step of codeqlSteps) assert.equal(step.if, undefined, 'CodeQL must not be silently skipped');
  assert.doesNotMatch(workflow, /Check CodeQL Capability|code-scanning\/alerts|steps\.check-codeql/);
});

test('staging and production gates use the real production Playwright command', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  const localGate = read('scripts/verify-production.ps1');
  assert.doesNotMatch(workflow, /PLAYWRIGHT_BASE_URL|--project=smoke/);
  assert.match(workflow, /E2E_WEB_BASE_URL/);
  assert.match(workflow, /E2E_API_BASE_URL/);
  assert.match(workflow, /npm run test:e2e:prod --workspace=web/);
  assert.match(workflow, /health-smoke-production:/);
  assert.ok((workflow.match(/\/api\/v1\/health\/ready/g) || []).length >= 2);
  assert.match(localGate, /RELEASE_GATE_DATABASE_URL is required/);
  assert.match(localGate, /login writes audit and refresh-token metadata/);
  assert.match(localGate, /Assert-PersonaLogin/);
  assert.match(localGate, /THROTTLER_LIMIT = '100000'/);
  assert.match(localGate, /--project='Release Mobile 430' --project='Release Mobile 390' --project='Release Mobile 375'/);
  assert.equal((localGate.match(/Desktop production E2E on dedicated release-gate database/g) || []).length, 1);
  assert.doesNotMatch(localGate, /SKIP_DESKTOP_E2E/);
  assert.doesNotMatch(localGate, /db\s+push|db\s+seed|force-reset|accept-data-loss/i);
});

test('API integration tests compile shared workspace before Vitest resolves it', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  const bootstrap = read('scripts/ci-bootstrap-database.js');
  const integrationBlock = workflow.slice(
    workflow.indexOf('  integration-test:'),
    workflow.indexOf('  build-api:'),
  );
  const sharedBuild = integrationBlock.indexOf('npm run build -w @homeland/shared');
  const servicesReady = integrationBlock.indexOf('docker compose -f docker-compose.ci.yml -p homeland-ci-');
  const migration = integrationBlock.indexOf('node scripts/ci-bootstrap-database.js');
  const apiE2e = integrationBlock.indexOf('npm run test:e2e --workspace=api');
  assert.ok(sharedBuild >= 0, 'Integration job must compile @homeland/shared');
  assert.ok(apiE2e > sharedBuild, 'Shared workspace must compile before API E2E');
  assert.ok(servicesReady > sharedBuild, 'Disposable services must start after build');
  assert.ok(migration > servicesReady, 'Migrations must target the disposable CI database');
  assert.ok(apiE2e > migration, 'API E2E must run after migrations');
  assert.match(integrationBlock, /DATABASE_URL: postgresql:\/\/homeland:homeland123@localhost:5433\/homeland\?schema=public/);
  assert.match(integrationBlock, /ALLOW_REGISTRATION: true/);
  assert.match(integrationBlock, /CI_DATABASE_BOOTSTRAP: true/);
  assert.match(integrationBlock, /RUN_DESTRUCTIVE_E2E: true/);
  assert.doesNotMatch(integrationBlock, /prisma\s+(?:db\s+push|db\s+seed)|force-reset|accept-data-loss/i);
  assert.match(bootstrap, /GITHUB_ACTIONS !== 'true'/);
  assert.match(bootstrap, /CI_DATABASE_BOOTSTRAP !== 'true'/);
  assert.match(bootstrap, /RUN_DESTRUCTIVE_E2E !== 'true'/);
  assert.match(bootstrap, /localhost', '127\.0\.0\.1/);
  assert.match(bootstrap, /databaseUrl\.port !== '5433'/);
  assert.match(bootstrap, /information_schema\.tables/);
  assert.match(bootstrap, /database is not empty/);
  assert.match(bootstrap, /baseline-v2\.sql/);
  assert.match(bootstrap, /db', 'execute', '--file', preludeSql/);
  assert.match(bootstrap, /db', 'execute', '--file', baselineV2Sql/);
  assert.match(bootstrap, /assertCanonicalFingerprint/);
  assert.match(bootstrap, /contractStatusAudit/);
  assert.match(bootstrap, /migrate', 'resolve', '--applied'/);
  assert.match(bootstrap, /migrate', 'deploy'/);
  assert.doesNotMatch(bootstrap, /db\s+push|db\s+seed|force-reset|accept-data-loss/i);
});

test('empty-database baseline runbook matches the reviewed CI migration checksums', () => {
  const baseline = read('docs/operations/DATABASE_BASELINE.md');
  const { reviewedMigrations } = require('./ci-bootstrap-database');
  assert.match(baseline, /historical manifest 18\/18/);
  assert.equal(reviewedMigrations.length, 18);
  assert.match(baseline, /public_base_tables = 0/);
  assert.match(baseline, /BASELINE-V2/);
  assert.match(baseline, /baseline-v2\.sql/);
  assert.match(baseline, /migrate resolve/);
  assert.match(baseline, /migrate status/);
  assert.match(baseline, /Không dùng `prisma db push`/);
  assert.match(baseline, /Không dùng.*seed/);
  assert.match(baseline, /18/);
});

test('booking cash gate runs explicitly against a separate copy of the migrated CI schema', () => {
  const steps = workflowModel().jobs['integration-test'].steps;
  const bootstrap = steps.findIndex((step) => step.run === 'node scripts/ci-bootstrap-database.js');
  const prepare = steps.findIndex((step) => step.name === 'Prepare isolated booking invoice gate database');
  const gate = steps.findIndex((step) => step.name === 'Booking invoice real PostgreSQL gate');
  const e2e = steps.findIndex((step) => step.run === 'npm run test:e2e --workspace=api');
  assert.ok(prepare > bootstrap && gate > prepare && e2e > gate);
  assert.match(steps[prepare].run, /-p homeland-ci-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);
  assert.match(steps[prepare].run, /exec -T postgres psql -U homeland -d postgres -v ON_ERROR_STOP=1/);
  assert.match(steps[prepare].run, /CREATE DATABASE homeland_booking_invoice_test TEMPLATE homeland/);
  assert.doesNotMatch(steps[prepare].run, /DROP|force-reset|db push/i);
  assert.equal(steps[gate]['working-directory'], 'apps/api');
  assert.deepEqual(steps[gate].env, {
    RUN_BOOKING_INVOICE_DB_TESTS: '1',
    TEST_DATABASE_URL: 'postgresql://homeland:homeland123@127.0.0.1:5433/homeland_booking_invoice_test?schema=public',
  });
  assert.equal(steps[gate].run, 'npx vitest run src/invoices/booking-invoice-payment.integration.spec.ts');
});

test('notification identity gate runs explicitly in the isolated database without provider dispatch', () => {
  const steps = workflowModel().jobs['integration-test'].steps;
  const booking = steps.findIndex((step) => step.name === 'Booking invoice real PostgreSQL gate');
  const gate = steps.findIndex((step) => step.name === 'In-app notification real PostgreSQL gate');
  const e2e = steps.findIndex((step) => step.run === 'npm run test:e2e --workspace=api');
  assert.ok(gate > booking && e2e > gate);
  assert.equal(steps[gate]['working-directory'], 'apps/api');
  assert.deepEqual(steps[gate].env, {
    RUN_IN_APP_NOTIFICATION_DB_TESTS: '1',
    TEST_DATABASE_URL: 'postgresql://homeland:homeland123@127.0.0.1:5433/homeland_booking_invoice_test?schema=public',
    COMMUNICATION_IMMEDIATE_DELIVERY: 'false',
  });
  assert.equal(steps[gate].run, 'npx vitest run src/communication/in-app-notification-identity.integration.spec.ts');
});

test('release documents point to the evidence-based central go-live backlog', () => {
  const goLiveTodo = read('docs/operations/GO_LIVE_TODO.md');
  for (const file of [
    'docs/operations/PRODUCTION_READINESS.md',
    'docs/operations/DEPLOYMENT.md',
    'docs/engineering/RELEASE_CHECKLIST.md',
    'docs/product/rental-lifecycle-flow.md',
  ]) {
    assert.match(read(file), /GO_LIVE_TODO\.md/, `${file} must link to the central go-live backlog`);
  }
  for (const requiredTask of [
    'SEC-01',
    'INF-01',
    'BKP-03',
    'SEP-03',
    'HUN-03',
    'UAT-01',
    'OBS-05',
    'REL-09',
    'HC-08',
  ]) {
    assert.ok(
      goLiveTodo.includes(`\`${requiredTask}\``),
      `Go-live backlog is missing ${requiredTask}`,
    );
  }
  assert.match(goLiveTodo, /Trigger NO-GO bắt buộc/);
  assert.match(goLiveTodo, /Definition of Done \/ bằng chứng/);
  assert.match(goLiveTodo, /LOCAL RELEASE CANDIDATE PASS \/ LIVE NO-GO/);
});

test('web build compiles shared workspace before Next resolves runtime schemas', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  const webBuildBlock = workflow.slice(
    workflow.indexOf('  build-web:'),
    workflow.indexOf('  security-scan:'),
  );
  const sharedBuild = webBuildBlock.indexOf('npm run build -w @homeland/shared');
  const nextBuild = webBuildBlock.indexOf('npm run build --workspace=web');
  assert.ok(sharedBuild >= 0, 'Web build must compile @homeland/shared');
  assert.ok(nextBuild > sharedBuild, 'Shared workspace must compile before Next build');
});

test('release version is propagated through every deploy job dependency', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  assert.match(workflow, /release_version: \$\{\{ needs\.semantic-release\.outputs\.new_release_version \}\}/);
  assert.match(workflow, /release_version: \$\{\{ needs\.package\.outputs\.release_version \}\}/);
  assert.match(workflow, /release_version: \$\{\{ needs\.deploy-staging\.outputs\.release_version \}\}/);
  assert.match(workflow, /release_version: \$\{\{ needs\.health-smoke-staging\.outputs\.release_version \}\}/);
});

test('CI blocks packaging when runtime audit contains high or critical findings', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  assert.match(workflow, /npm audit --omit=dev --json/);
  assert.match(workflow, /Enforce Runtime Dependency Policy/);
  assert.match(workflow, /node scripts\/runtime-audit-policy\.js security\/npm-audit\.json/);
  assert.doesNotMatch(workflow, /high:0|critical:0|const filtered=/);
});

test('CI creates a validated reproducible SBOM while retaining the runtime audit gate', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  const securityBlock = workflow.slice(
    workflow.indexOf('  security-scan:'),
    workflow.indexOf('  e2e:'),
  );
  assert.match(
    securityBlock,
    /cyclonedx-npm --package-lock-only --ignore-npm-errors --validate --output-reproducible/,
  );
  assert.match(securityBlock, /--output-file security\/sbom\.cdx\.json/);
  assert.ok(
    securityBlock.indexOf('Generate SBOM') < securityBlock.indexOf('Enforce Runtime Dependency Policy'),
    'Runtime dependency policy must still run after SBOM generation',
  );
  assert.match(securityBlock, /node scripts\/runtime-audit-policy\.js security\/npm-audit\.json/);
  const scans = workflowModel().jobs['security-scan'].steps.filter((step) => /aquasecurity\/trivy-action@/.test(step.uses || ''));
  assert.equal(scans.length, 3);
  for (const scan of scans) {
    assert.match(scan.uses, /@[a-f0-9]{40}$/);
    assert.equal(scan.with['exit-code'], '1');
    assert.equal(scan.with.severity, 'CRITICAL,HIGH');
    assert.equal(scan.with['limit-severities-for-sarif'], 'true', 'SARIF must respect the blocking severity threshold');
    assert.equal(scan.with.scanners, 'vuln,secret', 'Both vulnerability and secret scans must remain enabled');
  }
  assert.equal(scans[1].with['vuln-type'], 'os,library', 'Actual runtime image must gate OS and library vulnerabilities');
  assert.equal(scans[2].with['image-ref'], 'homeland-web:test');
  assert.equal(scans[2].with['vuln-type'], 'os,library');
  assert.equal(scans[2].with.output, 'security/trivy-web-image.sarif');
  const webBuild = workflowModel().jobs['security-scan'].steps.find(step => step.name === 'Build Web Runtime Image for Scan');
  assert.match(webBuild.run, /docker build .*COMMIT_SHA=\$\{\{ github.sha \}\} .*Dockerfile\.web/);
  const webVerify = workflowModel().jobs['security-scan'].steps.find(step => step.name === 'Verify production Web runtime image');
  assert.equal(webVerify.env.VERIFY_DISPOSABLE_WEB_IMAGE, 'true');
  assert.match(webVerify.run, /node scripts\/verify-web-runtime-image\.js homeland-web:test \$\{\{ github.sha \}\}/);
});

test('Hunonic mobile signing secrets stay outside source control', () => {
  const provider = read('apps/api/src/hunonic/hunonic.provider.ts');
  const exampleEnv = read('.env.example');
  const gitleaks = read('.gitleaks.toml');
  assert.match(provider, /process\.env\.HUNONIC_MOBILE_ACCESS_KEY/);
  assert.match(provider, /process\.env\.HUNONIC_MOBILE_SECRET_KEY/);
  assert.match(provider, /Missing Hunonic mobile signing keys/);
  assert.doesNotMatch(provider, /accessKey[0-9a-f]{20,}|HUNONICBIGBUG/i);
  assert.match(exampleEnv, /HUNONIC_MOBILE_ACCESS_KEY=replace-/);
  assert.match(exampleEnv, /HUNONIC_MOBILE_SECRET_KEY=replace-/);
  const bootstrap = read('scripts/ci-bootstrap-database.js');
  assert.match(bootstrap, /migration-manifest\.json/);
  assert.equal((bootstrap.match(/gitleaks:allow - reviewed migration checksum/g) || []).length, 0);
  assert.match(gitleaks, /trace_out/);
  assert.doesNotMatch(gitleaks, /hunonic\.provider|apps\/api/);
});
