const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve('deploy/public-production/systemd');

test('production scheduler templates exist for backup cycle and restore drill', () => {
  const expectedFiles = [
    'homeland-backup-cycle.service',
    'homeland-backup-cycle.timer',
    'homeland-restore-drill.service',
    'homeland-restore-drill.timer',
  ];

  for (const file of expectedFiles) {
    const target = path.join(root, file);
    assert.equal(fs.existsSync(target), true, `${file} should exist`);
  }
});

test('scheduler templates reference the production backup and restore commands', () => {
  const backupService = fs.readFileSync(path.join(root, 'homeland-backup-cycle.service'), 'utf8');
  const restoreService = fs.readFileSync(path.join(root, 'homeland-restore-drill.service'), 'utf8');

  assert.match(backupService, /production-backup-cycle\.js/);
  assert.match(backupService, /--require-off-host/);
  assert.match(restoreService, /production-restore-drill\.js/);
  assert.match(restoreService, /RESTORE_DRILL_DATABASE_URL/);
});
