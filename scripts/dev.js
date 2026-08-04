const { spawn } = require('child_process');

const isWindows = process.platform === 'win32';
const processes = [];
let shuttingDown = false;

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
    if (!child.killed) {
      if (isWindows) {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill('SIGTERM');
      }
    }
  }

  process.exit(exitCode);
}

function start(name, workspace, env = {}) {
  const command = isWindows ? 'cmd.exe' : 'npm';
  const args = isWindows
    ? ['/d', '/s', '/c', `npm run dev --workspace=${workspace}`]
    : ['run', 'dev', `--workspace=${workspace}`];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    shell: false,
  });

  processes.push(child);

  child.stdout.on('data', (chunk) => prefixOutput(name, process.stdout, chunk));
  child.stderr.on('data', (chunk) => prefixOutput(name, process.stderr, chunk));

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[dev] ${name} stopped with ${reason}`);
    stopAll(code || 1);
  });
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

console.log('[dev] Starting backend on http://localhost:3001');
start('api', 'api', { PORT: '3001' });

console.log('[dev] Starting frontend on http://localhost:3000');
start('web', 'web');
