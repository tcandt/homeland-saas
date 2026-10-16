// Run only in the disposable PostgreSQL network namespace, with /backup read-only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const target = 'homeland_preview_restore_drill_20261016';
async function main() {
  assert.equal(process.env.PREVIEW_RESTORE_CONFIRM, target);
  assert.equal(process.env.E2E_DISPOSABLE_DATABASE, 'true');
  assert.equal(process.env.COMMIT_SHA, 'e1decc81045114db20e09718fcb465349aa012f9');
  assert.ok(process.env.POSTGRES_PASSWORD);
  const backupId = process.env.PREVIEW_BACKUP_ID;
  assert.match(backupId, /^2026-10-16T[0-9TZ-]+-[a-f0-9-]{36}$/);
  const manifestPath = path.join('/backup', backupId, 'manifest.json');
  const databaseUrl = `postgresql://homeland_staging:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@127.0.0.1:5432/${target}`;
  const runner = require('/app/scripts/production-restore-drill');
  const result = runner.runRestoreDrill({
    manifest: manifestPath, maxAgeHours: 24, requireOffHost: false,
    databaseUrl, confirmTargetDb: target, pgRestore: 'pg_restore', psql: 'psql',
    prisma: '/app/node_modules/.bin/prisma', schema: '/app/packages/database/prisma/schema.prisma',
    skipMigrateStatus: false,
  });
  assert.equal(result.ready, true, JSON.stringify(result.checks.filter(c => c.status !== 'PASS').map(c => c.id)));
  assert.equal(result.restored, true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  assert.ok(manifest.storage.files.length > 0);
  assert.deepEqual(fs.readdirSync('/restore-storage'), [], 'Refuse to overwrite existing restored storage');
  for (const file of manifest.storage.files) {
    const source = path.resolve('/backup', backupId, 'storage', file.path);
    const destination = path.resolve('/restore-storage', file.path);
    assert.ok(source.startsWith(path.join('/backup', backupId, 'storage') + '/'));
    assert.ok(destination.startsWith('/restore-storage/'));
    assert.equal(fs.lstatSync(source).isFile(), true);
    assert.equal(fs.lstatSync(source).isSymbolicLink(), false);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex'), file.sha256);
  }
  const { PrismaClient } = require('/app/node_modules/@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const bootstrap = require('/app/scripts/ci-bootstrap-database');
    await bootstrap.auditNasRelease(prisma);
    await bootstrap.assertNasSeedCompleted(prisma);
    const document = await prisma.document.findUnique({ where: { id: process.env.PREVIEW_DOCUMENT_ID } });
    assert.ok(document, 'Uploaded document metadata must be present after restore');
    console.log(JSON.stringify({ status: 'PASS', scope: 'isolated-NAS-DB-and-manual-storage-restore-not-financial-or-offhost', backupId, database: target, restoreChecks: result.summary, files: manifest.storage.files.length, documentId: document.id, releaseAudit: '35-checksums-schema-marker-PASS' }));
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error('Preview restore assertion failed: ' + error.message); process.exitCode = 1; });
