#!/usr/bin/env node
const { spawnSync } = require('child_process');

function parseArguments(argv) {
  const options = {
    path: '/',
    minFreeGb: 8,
    maxUsedPercent: 85,
    containers: [],
    skipDocker: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--path') {
      options.path = argv[index + 1] || options.path;
      index += 1;
    } else if (argument === '--min-free-gb') {
      options.minFreeGb = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--max-used-percent') {
      options.maxUsedPercent = Number(argv[index + 1]);
      index += 1;
    } else if (argument === '--containers') {
      options.containers = String(argv[index + 1] || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
    } else if (argument === '--skip-docker') {
      options.skipDocker = true;
    } else if (argument === '--json') {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!Number.isFinite(options.minFreeGb) || options.minFreeGb < 0) {
    throw new Error('--min-free-gb must be a non-negative number.');
  }
  if (!Number.isFinite(options.maxUsedPercent) || options.maxUsedPercent <= 0 || options.maxUsedPercent > 100) {
    throw new Error('--max-used-percent must be between 1 and 100.');
  }

  return options;
}

function pass(id, message, details = {}) {
  return { id, status: 'PASS', message, details };
}

function fail(id, message, details = {}) {
  return { id, status: 'FAIL', message, details };
}

function warn(id, message, details = {}) {
  return { id, status: 'WARN', message, details };
}

function parseDfOutput(output) {
  const lines = String(output || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('df output is missing data rows.');
  const columns = lines[1].trim().split(/\s+/);
  if (columns.length < 6) throw new Error('df output row has an unexpected format.');
  return {
    filesystem: columns[0],
    sizeKb: Number(columns[1]),
    usedKb: Number(columns[2]),
    availableKb: Number(columns[3]),
    usedPercent: Number(columns[4].replace('%', '')),
    mountedOn: columns.slice(5).join(' '),
  };
}

function runCommand(runner, command, args) {
  return runner(command, args, { encoding: 'utf8', stdio: 'pipe' });
}

function checkDisk(options, runner) {
  const result = runCommand(runner, 'df', ['-Pk', options.path]);
  if (result.status !== 0) {
    return fail('disk_capacity', 'Cannot read disk capacity with df.', { command: 'df -Pk', stderr: result.stderr || '' });
  }

  const disk = parseDfOutput(result.stdout);
  const availableGb = disk.availableKb / 1024 / 1024;
  const ok = availableGb >= options.minFreeGb && disk.usedPercent <= options.maxUsedPercent;
  return ok
    ? pass('disk_capacity', 'Disk capacity is within the production update threshold.', { ...disk, availableGb })
    : fail('disk_capacity', 'Disk capacity is below the production update threshold.', { ...disk, availableGb });
}

function checkDockerService(runner) {
  const enabled = runCommand(runner, 'systemctl', ['is-enabled', 'docker']);
  const active = runCommand(runner, 'systemctl', ['is-active', 'docker']);

  if (enabled.status !== 0 || active.status !== 0) {
    return fail('docker_service', 'Docker service is not enabled and active.', {
      enabled: String(enabled.stdout || enabled.stderr || '').trim(),
      active: String(active.stdout || active.stderr || '').trim(),
    });
  }

  return pass('docker_service', 'Docker service is enabled and active.', {
    enabled: String(enabled.stdout).trim(),
    active: String(active.stdout).trim(),
  });
}

function checkContainerRestartPolicies(containers, runner) {
  if (containers.length === 0) {
    return warn('docker_restart_policies', 'No container names were provided for restart policy verification.');
  }

  const checks = [];
  for (const container of containers) {
    const result = runCommand(runner, 'docker', ['inspect', container, '--format', '{{.HostConfig.RestartPolicy.Name}}']);
    const policy = String(result.stdout || '').trim();
    const ok = result.status === 0 && ['always', 'unless-stopped'].includes(policy);
    checks.push(ok
      ? pass(`restart_policy:${container}`, `${container} restart policy is ${policy}.`, { container, policy })
      : fail(`restart_policy:${container}`, `${container} restart policy must be always or unless-stopped.`, {
        container,
        policy: policy || null,
        stderr: result.stderr || '',
      }));
  }
  return checks;
}

function runHostCheck(options, runner = spawnSync) {
  const checks = [checkDisk(options, runner)];
  if (!options.skipDocker) {
    checks.push(checkDockerService(runner));
    checks.push(...checkContainerRestartPolicies(options.containers, runner));
  }

  const failed = checks.filter((check) => check.status === 'FAIL').length;
  const warned = checks.filter((check) => check.status === 'WARN').length;
  return {
    ready: failed === 0,
    summary: {
      passed: checks.length - failed - warned,
      warned,
      failed,
      total: checks.length,
    },
    checks,
  };
}

function formatHumanReport(result) {
  const lines = ['HomeLand production host preflight', ''];
  for (const check of result.checks) {
    lines.push(`[${check.status}] ${check.id}: ${check.message}`);
  }
  lines.push('', `Host preflight: ${result.ready ? 'PASS' : 'FAIL'} (${result.summary.passed}/${result.summary.total}, warnings ${result.summary.warned})`);
  return lines.join('\n');
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const result = runHostCheck(options);
  process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : formatHumanReport(result)}\n`);
  process.exitCode = result.ready ? 0 : 1;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Production host preflight failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  formatHumanReport,
  parseArguments,
  parseDfOutput,
  runHostCheck,
};
