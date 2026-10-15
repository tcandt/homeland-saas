const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { runBackup, parseArguments: parseBackupArguments } = require('/app/scripts/production-backup');
const { runRestoreDrill, parseArguments: parseRestoreArguments } = require('/app/scripts/production-restore-drill');
const { seed, audit } = require('/app/testing/recovery-financial-20261015/fixture.cjs');

const output = '/drill-output';
const sourceStorage = path.join(output, 'source-storage');
const targetStorage = path.join(output, 'restored-storage');
const backupRoot = path.join(output, 'backup');
const targetDb = process.env.TARGET_DATABASE_NAME || 'homeland_finrec_20261015_restore_drill';
const sourceUrl = process.env.DATABASE_URL;
const hashFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function targetUrlFromSource() {
  const parsed = new URL(sourceUrl); parsed.hostname = '127.0.0.1'; parsed.pathname = `/${targetDb}`; return parsed.toString();
}
async function createTargetDatabase(prisma) {
  try { await prisma.$executeRawUnsafe(`CREATE DATABASE "${targetDb.replaceAll('"', '""')}"`); } catch (error) {
    if (!/already exists/i.test(error.message)) throw error;
  }
}
async function waitForTarget() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const probe = new PrismaClient({ datasources: { db: { url: targetUrlFromSource() } } });
    try { await probe.$queryRawUnsafe('SELECT 1'); await probe.$disconnect(); return; } catch { await probe.$disconnect(); await sleep(200); }
  }
  throw new Error('restore target did not become ready');
}
function copyStorage(manifest) {
  if (fs.readdirSync(targetStorage).length !== 0) throw new Error('restore storage target was not empty');
  for (const record of manifest.storage.files) {
    const source = path.join(backupRoot, manifest.id, 'storage', record.path); const target = path.resolve(targetStorage, record.path);
    if (!target.startsWith(targetStorage + path.sep)) throw new Error('unsafe restored storage path');
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
    if (hashFile(target) !== record.sha256) throw new Error('restored attachment checksum mismatch');
  }
}

async function main() {
  fs.mkdirSync(sourceStorage, { recursive: true }); fs.mkdirSync(targetStorage, { recursive: true }); fs.mkdirSync(backupRoot, { recursive: true });
  const attachment = path.join(sourceStorage, 'attachments', 'finrec-20261015.bin'); fs.mkdirSync(path.dirname(attachment), { recursive: true });
  fs.writeFileSync(attachment, Buffer.from('homeland-financial-recovery-20261015-attachment\n', 'utf8')); const attachmentSha256 = hashFile(attachment);
  const source = new PrismaClient();
  try {
    const fixture = await seed(source); const sourceBefore = await audit(source);
    if (Number(sourceBefore.financial.deposits) < 1 || Number(sourceBefore.financial.invoices) < 1 || Number(sourceBefore.financial.payments) < 1 || Number(sourceBefore.financial.ledger_entries) < 1) throw new Error('financial fixture is empty');
    await createTargetDatabase(source); await source.$disconnect(); await waitForTarget();
    const backup = runBackup(parseBackupArguments(['--env-managed-externally', '--output-dir', backupRoot, '--storage-dir', sourceStorage, '--note', 'isolated financial recovery drill']));
    if (backup.status !== 'SUCCESS') throw new Error('backup did not report SUCCESS');
    const sourceAuditClient = new PrismaClient(); const sourceAfterBackup = await audit(sourceAuditClient); await sourceAuditClient.$disconnect();
    if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfterBackup)) throw new Error('source changed during backup');
    const restore = runRestoreDrill(Object.assign(parseRestoreArguments(['--manifest', path.join(backupRoot, 'latest-manifest.json'), '--confirm-target-db', targetDb, '--prisma', '/app/node_modules/.bin/prisma', '--json']), { databaseUrl: targetUrlFromSource() }));
    if (!restore.ready || !restore.restored) throw new Error('restore drill did not pass');
    const manifest = JSON.parse(fs.readFileSync(path.join(backupRoot, 'latest-manifest.json'), 'utf8')); copyStorage(manifest);
    const restoredClient = new PrismaClient({ datasources: { db: { url: targetUrlFromSource() } } }); const restored = await audit(restoredClient); await restoredClient.$disconnect();
    if (restored.fullDataSha256 !== sourceBefore.fullDataSha256 || restored.schemaSha256 !== sourceBefore.schemaSha256) throw new Error('restored hashes differ from source');
    if (restored.sequenceStateSha256 !== sourceBefore.sequenceStateSha256) throw new Error('restored sequence state differs from source');
    if (JSON.stringify(restored.financial) !== JSON.stringify(sourceBefore.financial)) throw new Error('restored financial totals differ from source');
    const sourceFinalClient = new PrismaClient(); const sourceFinal = await audit(sourceFinalClient); await sourceFinalClient.$disconnect();
    if (JSON.stringify(sourceFinal) !== JSON.stringify(sourceBefore)) throw new Error('source changed during restore verification');
    const summary = { status: 'PASS', backupId: manifest.id, sourceUnchanged: true, sourceFullDataSha256: sourceBefore.fullDataSha256, restoredFullDataSha256: restored.fullDataSha256, sourceSchemaSha256: sourceBefore.schemaSha256, restoredSchemaSha256: restored.schemaSha256, sourceSequenceStateSha256: sourceBefore.sequenceStateSha256, restoredSequenceStateSha256: restored.sequenceStateSha256, schemaCoverage: sourceBefore.schemaCoverage, financial: sourceBefore.financial, attachmentSha256, restoredAttachmentSha256: hashFile(path.join(targetStorage, 'attachments', 'finrec-20261015.bin')), restoreChecks: restore.checks, fixture };
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2)); process.stdout.write(`${JSON.stringify(summary)}\n`);
  } finally { try { await source.$disconnect(); } catch {} }
}
main().catch((error) => { fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({ status: 'BLOCKED', reason: error.message }, null, 2)); process.stderr.write('Financial recovery drill blocked; inspect sanitized summary.json.\n'); process.exitCode = 1; });
