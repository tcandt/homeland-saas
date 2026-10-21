const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const imageId = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const commit = 'b'.repeat(40);

function runVerifier({ env = { VERIFY_DISPOSABLE_WEB_IMAGE: 'true' }, args = ['homeland-web:test', commit], handler } = {}) {
  const calls = [];
  const localRequire = (id) => {
    if (id === 'node:assert/strict') return assert;
    if (id === 'node:crypto') return { randomBytes: () => ({ toString: () => 'fixedname' }) };
    if (id === 'node:child_process') return {
      execFileSync: (command, dockerArgs, options) => {
        calls.push({ command, args: dockerArgs, options });
        return handler(command, dockerArgs, options, calls);
      },
    };
    throw new Error(`Unexpected module: ${id}`);
  };
  const context = {
    require: localRequire,
    process: { argv: ['node', 'verify-web-runtime-image.js', ...args], env, exitCode: 0 },
    console: { log: () => {} },
  };
  try {
    vm.runInNewContext(read('scripts/verify-web-runtime-image.js'), context, { filename: 'verify-web-runtime-image.js' });
    return { calls, exitCode: context.process.exitCode };
  } catch (error) {
    return { calls, error, exitCode: context.process.exitCode };
  }
}

function happyDocker(command, args) {
  assert.equal(command, 'docker');
  if (args[0] === 'image') return JSON.stringify([{
    Id: imageId,
    Config: {
      User: 'nextjs', WorkingDir: '/app/apps/web',
      Cmd: ['node', '../../node_modules/next/dist/bin/next', 'start'],
      Env: [`COMMIT_SHA=${commit}`],
    },
  }]);
  if (args[0] === 'container' && args[1] === 'inspect') throw new Error('not found');
  if (args[0] === 'exec') return 'PASS';
  if (args[0] === 'inspect') return '0';
  return '';
}

test('Web runtime Dockerfile locks the production runner to Node 22, direct Next startup and non-root ownership', () => {
  const dockerfile = read('Dockerfile.web');
  const runner = dockerfile.slice(dockerfile.indexOf('FROM base AS runner'));
  assert.match(dockerfile, /^FROM node:22-alpine AS base/m);
  assert.match(dockerfile, /RUN npm prune --omit=dev --workspace=web --include-workspace-root=false --ignore-scripts/);
  assert.match(runner, /addgroup --system --gid 1001 nodejs/);
  assert.match(runner, /adduser --system --uid 1001 nextjs/);
  assert.match(runner, /RUN mkdir -p \/app\/apps\/web\/\.local-data\/learning \\\s*\r?\n\s*&& chown -R nextjs:nodejs \/app\/apps\/web\/\.local-data/);
  assert.match(runner, /COPY --from=builder \/app\/tai-lieu \.\/tai-lieu/);
  assert.match(runner, /COPY --from=builder \/app\/tai-lieu \.\/apps\/web\/tai-lieu/);
  assert.match(runner, /test ! -d \/app\/node_modules\/npm[\s\S]*test ! -d \/app\/node_modules\/typescript/);
  assert.match(runner, /USER nextjs/);
  assert.match(runner, /WORKDIR \/app\/apps\/web[\s\S]*CMD \["node", "\.\.\/\.\.\/node_modules\/next\/dist\/bin\/next", "start"\]/);
  assert.doesNotMatch(runner, /(?:^|\s)(?:npm|npx)\s+(?:run\s+)?start/m);
});

test('Web runner binds COMMIT_SHA before its first cached OS-refresh layer without later redefinition', () => {
  const dockerfile = read('Dockerfile.web');
  const runner = dockerfile.slice(dockerfile.indexOf('FROM base AS runner'));
  const commitArg = runner.indexOf('ARG COMMIT_SHA');
  const firstUpgrade = runner.indexOf('RUN apk upgrade --no-cache');
  assert.ok(commitArg >= 0 && firstUpgrade > commitArg);
  assert.equal((runner.match(/^ARG COMMIT_SHA$/gm) || []).length, 1);
});

test('Web verifier requires explicit opt-in and a full commit SHA before Docker is invoked', () => {
  for (const input of [
    { env: {}, args: ['web:test', commit] },
    { env: { VERIFY_DISPOSABLE_WEB_IMAGE: 'true' }, args: ['web:test', 'short'] },
    { env: { VERIFY_DISPOSABLE_WEB_IMAGE: 'true' }, args: ['-unsafe-image', commit] },
  ]) {
    const result = runVerifier({ ...input, handler: () => { throw new Error('Docker must not run'); } });
    assert.equal(result.calls.length, 0);
    assert.ok(result.error);
  }
});

test('Web verifier uses the immutable inspected ID in an isolated no-port container and cleans it up on success', () => {
  const result = runVerifier({ handler: happyDocker });
  assert.equal(result.error, undefined);
  assert.equal(result.exitCode, 0);
  const create = result.calls.find(({ args }) => args[0] === 'create');
  assert.deepEqual(Array.from(create.args), [
    'create', '--name', 'homeland-web-runtime-fixedname', '--network', 'none', '--add-host', 'api:127.0.0.1', imageId,
  ]);
  assert.ok(!create.args.some((value) => value === '-p' || value === '--publish' || value === '-v' || value === '--volume'));
  const remove = result.calls.at(-1);
  assert.deepEqual(Array.from(remove.args), ['rm', '-f', 'homeland-web-runtime-fixedname']);
  assert.equal(result.calls.filter(({ args }) => args[0] === 'exec').length, 1);
});

test('Web verifier collision precheck prevents creation and failure after creation still cleans up', () => {
  const collision = runVerifier({ handler: (command, args) => {
    if (args[0] === 'image') return happyDocker(command, args);
    if (args[0] === 'container') return '{}';
    throw new Error('creation must not occur');
  } });
  assert.match(collision.error.message, /Disposable resource collision/);
  assert.equal(collision.calls.some(({ args }) => args[0] === 'create'), false);

  const failed = runVerifier({ handler: (command, args) => {
    if (args[0] === 'start') throw new Error('synthetic start failure');
    return happyDocker(command, args);
  } });
  assert.match(failed.error.message, /synthetic start failure/);
  assert.deepEqual(Array.from(failed.calls.at(-1).args), ['rm', '-f', 'homeland-web-runtime-fixedname']);
});

test('Web verifier probes live Node 22/non-root state, templates, runtime dependencies and no-package-manager policy', () => {
  const verifier = read('scripts/verify-web-runtime-image.js');
  for (const required of [
    "process.versions.node.split('.')[0], '22'",
    'process.getuid(), 1001',
    "process.cwd(), '/app/apps/web'",
    "fs.readlinkSync('/proc/1/exe')",
    "'/usr/local/lib/node_modules/npm'",
    "'/app/node_modules/typescript'",
    "'docxtemplater'", "'pdf-lib'", "'@zxing/browser'", "'@zxing/library'",
    "'CT01.docx'", "'HOP_DONG_1PN.docx'", "'HOP_DONG_2PN.docx'", "'HD-COC-GIU-PHONG.docx'",
    "mockApi.listen(3001, '127.0.0.1'",
    "'Same-origin API proxy'",
  ]) assert.ok(verifier.includes(required), `Missing runtime probe: ${required}`);
  assert.match(verifier, /docker\(\['create', '--name', name, '--network', 'none', '--add-host', 'api:127\.0\.0\.1', info\.Id\]\)/);
  assert.match(verifier, /docker\(\['rm', '-f', name\]\)/);
});
