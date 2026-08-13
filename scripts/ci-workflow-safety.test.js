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
