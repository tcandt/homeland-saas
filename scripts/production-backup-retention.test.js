const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseArguments, classifyRetention, runRetention } = require('./production-backup-retention');

test('parses backup retention CLI arguments', () => {
  const result = parseArguments([
    '--output-dir',
    '.backups',
    '--keep-daily',
    '5',
    '--keep-weekly',
    '3',
    '--keep-monthly',
    '6',
    '--apply',
  ]);
  assert.equal(result.outputDir, '.backups');
  assert.equal(result.keepDaily, 5);
  assert.equal(result.keepWeekly, 3);
  assert.equal(result.keepMonthly, 6);
  assert.equal(result.apply, true);
  assert.ok(result.now instanceof Date);
});

test('classifies retained and prunable backups by day/week/month buckets', () => {
  const backups = [
    { id: 'b1', completedAt: new Date('2026-08-24T10:00:00.000Z'), status: 'SUCCESS', offHostLocation: 'r2:a', backupDir: '/tmp/b1' },
    { id: 'b2', completedAt: new Date('2026-08-23T10:00:00.000Z'), status: 'SUCCESS', offHostLocation: 'r2:b', backupDir: '/tmp/b2' },
    { id: 'b3', completedAt: new Date('2026-08-16T10:00:00.000Z'), status: 'SUCCESS', offHostLocation: 'r2:c', backupDir: '/tmp/b3' },
    { id: 'b4', completedAt: new Date('2026-07-01T10:00:00.000Z'), status: 'SUCCESS', offHostLocation: 'r2:d', backupDir: '/tmp/b4' },
    { id: 'b5', completedAt: new Date('2026-06-01T10:00:00.000Z'), status: 'SUCCESS', offHostLocation: null, backupDir: '/tmp/b5' },
  ];

  const result = classifyRetention(backups, {
    keepDaily: 2,
    keepWeekly: 1,
    keepMonthly: 1,
  });

  assert.deepEqual(
    result.retainedBackups.map((backup) => [backup.id, backup.tier]),
    [['b1', 'daily'], ['b2', 'daily'], ['b3', 'weekly'], ['b4', 'monthly']],
  );
  assert.deepEqual(result.prunableBackups.map((backup) => backup.id), ['b5']);
});

test('writes retention report and prunes only when apply is enabled', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-backup-retention-'));
  const backupIds = [
    '2026-08-24T10-00-00-000Z',
    '2026-08-23T10-00-00-000Z',
    '2026-08-16T10-00-00-000Z',
  ];

  for (const backupId of backupIds) {
    const backupDir = path.join(root, backupId);
    fs.mkdirSync(backupDir, { recursive: true });
    const completedAt = backupId
      .replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, '$1T$2:$3:$4.$5Z');
    fs.writeFileSync(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify({
        id: backupId,
        status: 'SUCCESS',
        completedAt,
        offHostLocation: `r2:bucket/${backupId}`,
      }),
    );
  }

  const dryRun = runRetention({
    outputDir: root,
    keepDaily: 1,
    keepWeekly: 0,
    keepMonthly: 0,
    apply: false,
    now: new Date('2026-08-24T12:00:00.000Z'),
  });
  assert.equal(dryRun.summary.retainedBackups, 1);
  assert.equal(dryRun.summary.prunableBackups, 2);
  assert.equal(dryRun.summary.deletedBackups, 0);
  assert.equal(fs.existsSync(path.join(root, backupIds[1])), true);

  const applyRun = runRetention({
    outputDir: root,
    keepDaily: 1,
    keepWeekly: 0,
    keepMonthly: 0,
    apply: true,
    now: new Date('2026-08-24T12:00:00.000Z'),
  });
  assert.equal(applyRun.summary.deletedBackups, 2);
  assert.equal(fs.existsSync(path.join(root, backupIds[1])), false);
  assert.ok(fs.existsSync(path.join(root, 'latest-retention-report.json')));
});
