const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '/bin/bash';
assert.ok(fs.existsSync(bash), `Bash is required for shell-runtime tests: ${bash}`);

function tempDirectory(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeExecutable(file, source) {
  fs.writeFileSync(file, source, { mode: 0o755 });
}

function runBash(script, options = {}) {
  return childProcess.spawnSync(bash, [script, ...(options.args || [])], {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
  });
}

function makeEntrypointFixture() {
  const fixture = tempDirectory('homeland-api-entrypoint-');
  const bin = path.join(fixture, 'bin');
  const calls = path.join(fixture, 'node-calls.log');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(fixture, 'apps', 'api'), { recursive: true });
  writeExecutable(path.join(bin, 'node'), '#!/usr/bin/env bash\nprintf "%s|%s\\n" "$PWD" "$*" >> "$NODE_CALLS"\nif [ "${FAIL_MIGRATION:-false}" = "true" ] && [ "$1" = "node_modules/prisma/build/index.js" ]; then exit 41; fi\n');
  return { fixture, bin, calls };
}

function entrypointEnvironment(bin, calls, extra = {}) {
  return {
    ...process.env,
    ...extra,
    NODE_CALLS: calls,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
  };
}

test('API entrypoint skips migrations by default and starts Node from the API workspace', () => {
  const { fixture, bin, calls } = makeEntrypointFixture();
  const result = runBash(path.join(root, 'scripts', 'docker-api-entrypoint.sh'), {
    cwd: fixture,
    env: entrypointEnvironment(bin, calls),
  });
  assert.equal(result.status, 0, result.stderr);
  const invocations = fs.readFileSync(calls, 'utf8').trim().split(/\r?\n/);
  assert.equal(invocations.length, 1);
  assert.match(invocations[0], new RegExp(`/${path.basename(fixture)}/apps/api\\|dist/main$`));
});

test('API entrypoint runs reviewed migrations before the main process and fails closed', () => {
  const { fixture, bin, calls } = makeEntrypointFixture();
  const migration = runBash(path.join(root, 'scripts', 'docker-api-entrypoint.sh'), {
    cwd: fixture,
    env: entrypointEnvironment(bin, calls, { RUN_DB_MIGRATIONS: 'true' }),
  });
  assert.equal(migration.status, 0, migration.stderr);
  const invocations = fs.readFileSync(calls, 'utf8').trim().split(/\r?\n/);
  assert.equal(invocations.length, 2);
  assert.match(invocations[0], /\|node_modules\/prisma\/build\/index\.js migrate deploy --schema=packages\/database\/prisma\/schema\.prisma$/);
  assert.match(invocations[1], new RegExp(`/${path.basename(fixture)}/apps/api\\|dist/main$`));

  const failed = makeEntrypointFixture();
  const failure = runBash(path.join(root, 'scripts', 'docker-api-entrypoint.sh'), {
    cwd: failed.fixture,
    env: entrypointEnvironment(failed.bin, failed.calls, { RUN_DB_MIGRATIONS: 'true', FAIL_MIGRATION: 'true' }),
  });
  assert.equal(failure.status, 41, failure.stderr);
  const failedCalls = fs.readFileSync(failed.calls, 'utf8').trim().split(/\r?\n/);
  assert.equal(failedCalls.length, 1);
  assert.match(failedCalls[0], /\|node_modules\/prisma\/build\/index\.js migrate deploy --schema=packages\/database\/prisma\/schema\.prisma$/);
});

test('install-version rejects runtime source builds before filesystem side effects', () => {
  const fixture = tempDirectory('homeland-install-guard-');
  const workspace = path.join(fixture, 'workspace');
  const updateRoot = path.join(fixture, 'update-root');
  const bin = path.join(fixture, 'bin');
  fs.mkdirSync(workspace);
  fs.mkdirSync(bin);
  const result = runBash(path.join(root, 'scripts', 'update', 'install-version.sh'), {
    cwd: fixture,
    env: { ...process.env, PATH: bin, SYSTEM_UPDATE_RUN_BUILD: 'true' },
    args: ['--target-version', 'v3.0.2', '--workspace', workspace, '--update-root', updateRoot],
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Source builds require npm/);
  assert.equal(fs.existsSync(updateRoot), false);
  assert.equal(fs.existsSync(path.join(workspace, '.codex-backups')), false);
});

test('install-version recognizes a host npm path and the explicit no-build escape hatch', () => {
  const fixture = tempDirectory('homeland-install-host-builder-');
  const workspace = path.join(fixture, 'workspace');
  const bin = path.join(fixture, 'bin');
  const marker = path.join(fixture, 'mkdir-called');
  const bashEnv = path.join(fixture, 'bash-env');
  fs.mkdirSync(workspace);
  fs.mkdirSync(bin);
  writeExecutable(path.join(bin, 'builder-npm'), '#!/usr/bin/env bash\nexit 0\n');
  fs.writeFileSync(bashEnv, 'mkdir() { printf x >> "$MARKER"; return 77; }\n');
  const args = [
    '--target-version', 'v3.0.2', '--workspace', workspace,
    '--update-root', path.join(fixture, 'update-root'),
  ];
  for (const env of [
    { SYSTEM_UPDATE_RUN_BUILD: 'true', SYSTEM_UPDATE_NPM_PATH: 'builder-npm' },
    { SYSTEM_UPDATE_RUN_BUILD: 'false', SYSTEM_UPDATE_NPM_PATH: 'intentionally-missing-npm' },
  ]) {
    fs.rmSync(marker, { force: true });
    const result = childProcess.spawnSync(bash, [path.join(root, 'scripts', 'update', 'install-version.sh'), ...args], {
      cwd: fixture,
      env: {
        ...process.env, ...env, PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        MARKER: marker, BASH_ENV: bashEnv,
      },
      encoding: 'utf8',
    });
    assert.equal(result.status, 77, result.stderr);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'x');
  }
});

function executeFreshReset({ entries = [{ name: '002_beta', isDirectory: () => true }, { name: '001_alpha', isDirectory: () => true }], results = [] } = {}) {
  const calls = [];
  const resolved = [];
  const exit = Symbol('process.exit');
  const localRequire = (id) => {
    if (id === 'node:fs') return { readdirSync: () => entries };
    if (id === 'node:path') return { join: (...parts) => parts.join('/') };
    if (id === 'node:child_process') return {
      spawnSync: (command, args, options) => {
        calls.push({ command, args, options });
        return results.shift() || { status: 0 };
      },
    };
    throw new Error(`Unexpected module: ${id}`);
  };
  localRequire.resolve = (id) => {
    resolved.push(id);
    return `/resolved/${id}`;
  };
  const context = {
    require: localRequire,
    process: {
      execPath: '/node/direct',
      env: { ORIGINAL: 'value' },
      exit: (status) => { throw { exit, status }; },
    },
    console: { log: () => {} },
  };
  try {
    vm.runInNewContext(read('scripts/production-fresh-reset.js'), context, { filename: 'production-fresh-reset.js' });
    return { calls, resolved };
  } catch (error) {
    return { calls, resolved, error, exit };
  }
}

test('fresh reset invokes bundled Prisma and seed directly through Node in migration order', () => {
  const { calls, resolved, error } = executeFreshReset();
  assert.equal(error, undefined);
  assert.deepEqual(resolved, ['prisma/build/index.js', 'tsx/cli']);
  assert.equal(calls.length, 4);
  for (const call of calls) assert.equal(call.command, '/node/direct');
  assert.deepEqual(Array.from(calls[0].args), [
    '/resolved/prisma/build/index.js', 'db', 'push', '--schema', 'packages/database/prisma/schema.prisma', '--force-reset',
  ]);
  assert.deepEqual(Array.from(calls[1].args).slice(-1), ['001_alpha']);
  assert.deepEqual(Array.from(calls[2].args).slice(-1), ['002_beta']);
  assert.deepEqual(Array.from(calls[3].args), ['/resolved/tsx/cli', 'packages/database/prisma/seed.ts']);
  for (const call of calls) assert.equal(call.options.env.SEED_MODE, 'production');
});

test('fresh reset stops after a Prisma spawn error or nonzero status', () => {
  const failure = new Error('spawn failed');
  const errored = executeFreshReset({ results: [{ error: failure }] });
  assert.equal(errored.error, failure);
  assert.equal(errored.calls.length, 1);

  const nonzero = executeFreshReset({ results: [{ status: 9 }] });
  assert.equal(nonzero.error.exit, nonzero.exit);
  assert.equal(nonzero.error.status, 9);
  assert.equal(nonzero.calls.length, 1);
});

test('runtime image and build context cannot retain npm or release artifacts', () => {
  const dockerfile = read('Dockerfile.api');
  const runtime = dockerfile.slice(dockerfile.indexOf('FROM runtime-base AS runtime'));
  const copy = runtime.indexOf('COPY --from=build /app /app');
  const pathMutation = runtime.indexOf('ENV PATH="/app/node_modules/.bin:${PATH}"');
  const finalGuard = runtime.indexOf('RUN ! command -v npm', pathMutation);
  assert.ok(copy >= 0 && pathMutation > copy && finalGuard > pathMutation);
  assert.match(runtime.slice(finalGuard), /! command -v npm[\s\S]*test ! -d \/app\/node_modules\/npm/);
  assert.match(read('.dockerignore'), /^\/backups$[\s\S]*^\/testing$/m);
  assert.match(read('.dockerignore'), /^\*\*\/deploy\/public-production\/release-\*/m);
  assert.match(read('.dockerignore'), /^\*\*\/\.codex-backups$/m);
  assert.match(read('.dockerignore'), /^\*\*\/\.codex-update$/m);
});

test('API runtime binds COMMIT_SHA before its first cached OS-refresh layer without later redefinition', () => {
  const dockerfile = read('Dockerfile.api');
  const runtime = dockerfile.slice(dockerfile.indexOf('FROM runtime-base AS runtime'));
  const commitArg = runtime.indexOf('ARG COMMIT_SHA');
  const firstUpgrade = runtime.indexOf('RUN apk upgrade --no-cache');
  assert.ok(commitArg >= 0 && firstUpgrade > commitArg);
  assert.equal((runtime.match(/^ARG COMMIT_SHA$/gm) || []).length, 1);
});

test('CI keeps Node 22 and scans runtime image OS and library vulnerabilities', () => {
  const workflow = read('.github/workflows/ci-cd-pipeline.yml');
  assert.match(workflow, /node-version:\s*['"]?22['"]?/);
  assert.match(workflow, /vuln-type:\s*['"]os,library['"]/);
});
