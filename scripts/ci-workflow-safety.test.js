const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('API image startup never pushes, resets, seeds, or starts a dev watcher', () => {
  const entrypoint = read('scripts/docker-api-entrypoint.sh');
  assert.doesNotMatch(entrypoint, /prisma\s+db\s+push|force-reset|accept-data-loss|prisma\s+db\s+seed|npm\s+run\s+dev/i);
  assert.match(entrypoint, /prisma\s+migrate\s+deploy/);
  assert.match(entrypoint, /RUN_DB_MIGRATIONS:-false/);
  assert.match(entrypoint, /npm\s+run\s+start:prod/);
});

test('Docker images compile API code and bake a same-origin web API route', () => {
  const apiDockerfile = read('Dockerfile.api');
  const webDockerfile = read('Dockerfile.web');
  assert.match(apiDockerfile, /npm run db:generate/);
  assert.match(apiDockerfile, /npm run build --workspace=api/);
  assert.match(apiDockerfile, /RUN npm ci/);
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
  ]) {
    assert.ok(dockerignore.split(/\r?\n/).includes(requiredPattern), `Missing .dockerignore pattern: ${requiredPattern}`);
  }
  assert.doesNotMatch(dockerignore, /^\*\*\/storage$/m);
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
  assert.match(workflow, /needs\.deploy-staging\.result == 'failure'/);
  assert.match(workflow, /needs\.deploy-production\.result == 'failure'/);
});

test('staging and production gates use the real production Playwright command', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  assert.doesNotMatch(workflow, /PLAYWRIGHT_BASE_URL|--project=smoke/);
  assert.match(workflow, /E2E_WEB_BASE_URL/);
  assert.match(workflow, /E2E_API_BASE_URL/);
  assert.match(workflow, /npm run test:e2e:prod --workspace=web/);
  assert.match(workflow, /health-smoke-production:/);
  assert.ok((workflow.match(/\/api\/v1\/health\/ready/g) || []).length >= 2);
});

test('API integration tests compile shared workspace before Vitest resolves it', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  const bootstrap = read('scripts/ci-bootstrap-database.js');
  const integrationBlock = workflow.slice(
    workflow.indexOf('  integration-test:'),
    workflow.indexOf('  build-api:'),
  );
  const sharedBuild = integrationBlock.indexOf('npm run build -w @homeland/shared');
  const servicesReady = integrationBlock.indexOf('docker compose up -d --wait --wait-timeout 60 postgres redis');
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
  assert.match(bootstrap, /migrate',\s*'diff'/);
  assert.match(bootstrap, /'--from-empty'/);
  assert.match(bootstrap, /'--to-schema-datamodel'/);
  assert.match(bootstrap, /migrate', 'resolve', '--applied'/);
  assert.doesNotMatch(bootstrap, /migrate', 'deploy'/);
  assert.doesNotMatch(bootstrap, /db\s+push|db\s+seed|force-reset|accept-data-loss/i);
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
  assert.match(workflow, /counts\.critical/);
  assert.match(workflow, /counts\.high/);
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
  assert.equal((bootstrap.match(/gitleaks:allow - reviewed migration checksum/g) || []).length, 7);
  assert.match(gitleaks, /trace_out/);
  assert.doesNotMatch(gitleaks, /hunonic\.provider|apps\/api/);
});
