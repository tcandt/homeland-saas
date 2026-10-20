const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { PrismaClient } = require('/app/node_modules/@prisma/client');
const prisma = new PrismaClient();
const tables = ['TenantOrg', 'Owner', 'User', 'Role', 'Permission', 'UserRole', 'RolePermission',
  'AppSetting', 'ChartOfAccount', 'CashAccount', 'BankAccount', 'NotificationTemplate',
  'NotificationTemplateVersion', 'NotificationPreference', 'AiPromptTemplate', 'AiModelConfig', 'DocumentTemplate'];
const retained = new Set([...tables, 'HunonicMeterMapping', '_prisma_migrations']);
const file = '/release/retained.private.json';
const mode = process.argv[2];
const hash = rows => crypto.createHash('sha256').update(JSON.stringify(rows.map(x => JSON.stringify(x)).sort())).digest('hex');
function cleanMapping(row) {
  return { ...row, buildingId: null, roomId: null, lastStatus: null, lastReadingKwh: null,
    lastAmountVnd: null, lastSyncedAt: null, raw: null };
}
async function snapshot(client) {
  const result = {};
  for (const table of tables) {
    const rows = await client.$queryRawUnsafe(`SELECT to_jsonb(t) AS row FROM "${table}" t`);
    result[table] = rows.map(x => x.row);
  }
  const mappings = await client.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM "HunonicMeterMapping" t');
  result.HunonicMeterMapping = mappings.map(x => cleanMapping(x.row));
  return result;
}
function summary(data) {
  return Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, { count: rows.length, sha256: hash(rows) }]));
}
async function assertEmptyBusiness() {
  const names = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  const counts = {};
  for (const { tablename } of names) {
    assert.match(tablename, /^[A-Za-z_][A-Za-z0-9_]*$/);
    if (retained.has(tablename)) continue;
    const [row] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "${tablename}"`);
    assert.equal(row.count, 0, `Business data must be empty: ${tablename}`);
    counts[tablename] = row.count;
  }
  return counts;
}
async function main() {
  if (mode === 'capture') {
    const data = await prisma.$transaction(tx => snapshot(tx), { isolationLevel: 'RepeatableRead', timeout: 60000 });
    fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ retained: summary(data) }));
  } else if (mode === 'restore-mappings') {
    const expected = JSON.parse(fs.readFileSync(file));
    assert.equal(await prisma.hunonicMeterMapping.count(), 0);
    // Let PostgreSQL restore its own timestamp/JSON types without JS date coercion.
    await prisma.$executeRaw`INSERT INTO "HunonicMeterMapping"
      SELECT * FROM jsonb_populate_recordset(NULL::"HunonicMeterMapping", ${JSON.stringify(expected.HunonicMeterMapping)}::jsonb)`;
    console.log('MAPPING_CONFIGURATION_RESTORED_WITHOUT_HISTORY_OR_ROOM_BINDINGS');
  } else if (mode === 'verify-source' || mode === 'verify-target') {
    const expected = JSON.parse(fs.readFileSync(file));
    const actual = await prisma.$transaction(tx => snapshot(tx), { isolationLevel: 'RepeatableRead', timeout: 60000 });
    assert.deepEqual(summary(actual), summary(expected), 'Retained account/configuration data changed');
    if (mode === 'verify-target') {
      const counts = await assertEmptyBusiness();
      const [shape] = await prisma.$queryRawUnsafe("SELECT pg_get_constraintdef(oid) AS value FROM pg_constraint WHERE conname='Invoice_billing_kind_shape_check'");
      assert.ok(shape.value.includes('CONTRACT_SETTLEMENT'));
      const triggers = await prisma.$queryRawUnsafe("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('Invoice_protect_settlement_state','InvoiceItem_protect_settlement_insert')");
      assert.equal(triggers.length, 2);
      console.log(JSON.stringify({ status: 'PASS', retained: summary(actual), emptyBusinessTables: counts, settlementMigration: true }));
    } else console.log('SOURCE_RETAINED_CONFIGURATION_UNCHANGED');
  } else throw new Error('Unknown data verification mode');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
