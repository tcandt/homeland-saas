const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';
const processes = [];
let shuttingDown = false;
const rootEnv = loadRootEnv();

function loadRootEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};

  return fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return env;

      const separator = trimmed.indexOf('=');
      if (separator === -1) return env;

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;
      return env;
    }, {});
}

function prefixOutput(name, stream, chunk) {
  const lines = chunk.toString().split(/\r?\n/);

  for (const line of lines) {
    if (line.trim().length > 0) {
      stream.write(`[${name}] ${line}\n`);
    }
  }
}

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed && Number.isInteger(child.pid) && child.pid > 0) {
      if (isWindows) {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    }
  }

  process.exit(exitCode);
}

function runSetupStep(label, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...rootEnv, ...process.env },
      shell: false,
    });

    child.stdout.on('data', (chunk) => prefixOutput(label, process.stdout, chunk));
    child.stderr.on('data', (chunk) => prefixOutput(label, process.stderr, chunk));
    child.once('error', reject);

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      reject(new Error(`${label} stopped with ${reason}`));
    });
  });
}

function start(name, workspace, env = {}) {
  const command = isWindows ? 'cmd.exe' : 'npm';
  const args = isWindows
    ? ['/d', '/s', '/c', `npm run dev --workspace=${workspace}`]
    : ['run', 'dev', `--workspace=${workspace}`];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...rootEnv, ...process.env, ...env },
    shell: false,
  });

  processes.push(child);

  child.stdout.on('data', (chunk) => prefixOutput(name, process.stdout, chunk));
  child.stderr.on('data', (chunk) => prefixOutput(name, process.stderr, chunk));
  child.once('error', (error) => {
    console.error(`[dev] ${name} failed to start: ${error.message}`);
    stopAll(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[dev] ${name} stopped with ${reason}`);
    stopAll(code || 1);
  });
}

const http = require('http');

function waitForBackendReady(port = 3001, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    let done = false;
    let request;
    let retry;
    const finish = (ready) => {
      if (done) return;
      done = true;
      clearTimeout(overall);
      clearTimeout(retry);
      request?.destroy();
      resolve(ready);
    };
    const overall = setTimeout(() => finish(false), timeoutMs);
    const check = () => {
      if (done) return;
      let completed = false;
      const next = () => {
        if (done || completed) return;
        completed = true;
        if (Date.now() >= deadline) finish(false);
        else retry = setTimeout(check, Math.min(500, deadline - Date.now()));
      };
      request = http.get(`http://127.0.0.1:${port}/api/v1/health/ready`, (res) => {
        res.resume();
        res.once('error', next);
        res.once('end', () => res.statusCode === 200 ? finish(true) : next());
      });
      request.setTimeout(Math.min(2000, Math.max(1, deadline - Date.now())), () => request.destroy(new Error('Readiness probe timed out')));
      request.once('error', next);
    };
    check();
  });
}

async function main() {
  if (isWindows) {
    console.log('[dev] Syncing Prisma client and packages before watch mode');
    await runSetupStep('setup', 'cmd.exe', ['/d', '/s', '/c', 'npm run db:generate']);
    await runSetupStep('setup', 'cmd.exe', ['/d', '/s', '/c', 'npm run build -w @homeland/shared']);
    const apiDist = path.join(process.cwd(), 'apps', 'api', 'dist', 'main.js');
    if (!fs.existsSync(apiDist)) {
      await runSetupStep('setup', 'cmd.exe', ['/d', '/s', '/c', 'npm run build -w api']);
    }
  } else {
    console.log('[dev] Syncing Prisma client and packages before watch mode');
    await runSetupStep('setup', 'npm', ['run', 'db:generate']);
    await runSetupStep('setup', 'npm', ['run', 'build', '-w', '@homeland/shared']);
    const apiDist = path.join(process.cwd(), 'apps', 'api', 'dist', 'main.js');
    if (!fs.existsSync(apiDist)) {
      await runSetupStep('setup', 'npm', ['run', 'build', '-w', 'api']);
    }
  }

  console.log('[dev] Starting backend on http://localhost:3001');
  start('api', 'api', { PORT: '3001' });

  console.log('[dev] Waiting for backend API to be ready before starting frontend...');
  if (!await waitForBackendReady(3001, 30000)) {
    throw new Error('Backend readiness failed. Check database/schema configuration; frontend was not started.');
  }
  console.log('[dev] Backend API is ready!');

  console.log('[dev] Starting frontend on http://localhost:3000');
  start('web', 'web', { PORT: '3000' });
}

module.exports = { waitForBackendReady };

if (require.main === module) {
  process.on('SIGINT', () => stopAll(0));
  process.on('SIGTERM', () => stopAll(0));
  main().catch((error) => {
    console.error(`[dev] ${error.message}`);
    stopAll(1);
  });
}
