const { execSync } = require('child_process');

const ports = [3000, 3001];
const isWindows = process.platform === 'win32';

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getWindowsPids(port) {
  return unique(
    run(`netstat -ano -p tcp | findstr ":${port}"`)
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts[1] && parts[1].match(new RegExp(`:${port}$`)) && parts[3] === 'LISTENING')
      .map((parts) => parts[4]),
  );
}

function getUnixPids(port) {
  return unique(run(`lsof -ti tcp:${port} -sTCP:LISTEN`).split(/\s+/));
}

function stopPid(pid) {
  if (String(pid) === String(process.pid)) return;

  if (isWindows) {
    run(`taskkill /PID ${pid} /F`);
  } else {
    run(`kill -9 ${pid}`);
  }
}

for (const port of ports) {
  const pids = isWindows ? getWindowsPids(port) : getUnixPids(port);

  for (const pid of pids) {
    stopPid(pid);
    console.log(`Freed port ${port} by stopping PID ${pid}`);
  }
}
