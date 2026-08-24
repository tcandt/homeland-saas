const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArguments, parseDfOutput, runHostCheck } = require('./production-host-check');

function runnerFrom(map) {
  return (command, args) => {
    const key = [command, ...args].join(' ');
    const value = map[key] || { status: 127, stdout: '', stderr: `missing mock: ${key}` };
    return { stdout: '', stderr: '', ...value };
  };
}

test('parses production host check arguments', () => {
  assert.deepEqual(parseArguments([
    '--path',
    '/',
    '--min-free-gb',
    '4',
    '--max-used-percent',
    '90',
    '--containers',
    'api,web,postgres',
    '--skip-docker',
    '--json',
  ]), {
    path: '/',
    minFreeGb: 4,
    maxUsedPercent: 90,
    containers: ['api', 'web', 'postgres'],
    skipDocker: true,
    json: true,
  });
});

test('parses df -Pk output', () => {
  assert.deepEqual(parseDfOutput([
    'Filesystem 1024-blocks Used Available Capacity Mounted on',
    '/dev/root 28311552 23100000 3860000 86% /',
  ].join('\n')), {
    filesystem: '/dev/root',
    sizeKb: 28311552,
    usedKb: 23100000,
    availableKb: 3860000,
    usedPercent: 86,
    mountedOn: '/',
  });
});

test('passes when disk, docker, and restart policies are healthy', () => {
  const result = runHostCheck({
    path: '/',
    minFreeGb: 2,
    maxUsedPercent: 90,
    containers: ['homeland_production_api', 'homeland_production_web'],
    skipDocker: false,
    json: false,
  }, runnerFrom({
    'df -Pk /': { status: 0, stdout: 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/root 28311552 20000000 5000000 80% /\n' },
    'systemctl is-enabled docker': { status: 0, stdout: 'enabled\n' },
    'systemctl is-active docker': { status: 0, stdout: 'active\n' },
    'docker inspect homeland_production_api --format {{.HostConfig.RestartPolicy.Name}}': { status: 0, stdout: 'unless-stopped\n' },
    'docker inspect homeland_production_web --format {{.HostConfig.RestartPolicy.Name}}': { status: 0, stdout: 'always\n' },
  }));

  assert.equal(result.ready, true);
  assert.equal(result.summary.failed, 0);
});

test('fails when disk or restart policy is unsafe', () => {
  const result = runHostCheck({
    path: '/',
    minFreeGb: 8,
    maxUsedPercent: 85,
    containers: ['api'],
    skipDocker: false,
    json: false,
  }, runnerFrom({
    'df -Pk /': { status: 0, stdout: 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/root 28311552 25000000 1000000 96% /\n' },
    'systemctl is-enabled docker': { status: 0, stdout: 'enabled\n' },
    'systemctl is-active docker': { status: 0, stdout: 'active\n' },
    'docker inspect api --format {{.HostConfig.RestartPolicy.Name}}': { status: 0, stdout: 'no\n' },
  }));

  assert.equal(result.ready, false);
  assert.ok(result.checks.some((check) => check.id === 'disk_capacity' && check.status === 'FAIL'));
  assert.ok(result.checks.some((check) => check.id === 'restart_policy:api' && check.status === 'FAIL'));
});
