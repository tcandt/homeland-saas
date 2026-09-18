const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  IMPORT_TABLES, NON_IMPORTED, SOURCE_CHECKSUM, addTotals, cleanRecord,
  deterministicRecordId, emptyTotals, ensureSourceIdentity, ensureTargetIdentity,
  parseArguments, stableJson, validateSourceDump, withSourceSnapshot, writeImmutableJson,
  sourceDataFingerprint, writeFailedOperation,
} = require('./core1002-rehearsal');

test('CORE-10.02 has an explicit, dependency ordered allow-list only', () => {
  const tables = IMPORT_TABLES.map((item) => item.table);
  assert.equal(new Set(tables).size, tables.length);
  assert.ok(tables.indexOf('TenantOrg') < tables.indexOf('Room'));
  assert.ok(tables.indexOf('Room') < tables.indexOf('Contract'));
  assert.ok(tables.indexOf('Invoice') < tables.indexOf('PaymentAllocation'));
  assert.ok(!tables.includes('BillingSnapshot'));
  assert.ok(!tables.includes('DepositLedgerEntry'));
  assert.ok(NON_IMPORTED.some((item) => item.table === 'MonthlySettlementRun' && item.classification === 'BACKFILL'));
});

test('source work is always executed in a repeatable read-only transaction', async () => {
  const calls = [];
  const snapshot = { $executeRawUnsafe: async (sql) => { calls.push(sql); if (/^(UPDATE|INSERT|DELETE)/.test(sql)) throw new Error('cannot execute write in a read-only transaction'); } };
  const source = { $transaction: async (work, options) => { assert.equal(options.isolationLevel, 'RepeatableRead'); return work(snapshot); } };
  await assert.rejects(() => withSourceSnapshot(source, async (tx) => tx.$executeRawUnsafe('UPDATE "Customer" SET "fullName" = \'blocked\'')), /read-only/);
  assert.deepEqual(calls, ['SET TRANSACTION READ ONLY', 'UPDATE "Customer" SET "fullName" = \'blocked\'']);
});

test('run id, frozen checksum and exact isolated database guards fail closed', () => {
  const dump = '.codex-backups/legacy-source-core1002/2026-09-13T03-28-20-992Z/database.dump';
  const valid = parseArguments(['--mode', 'DRY_RUN', '--run-id', 'core1002-20260913', '--source-url', 'postgresql://u:p@localhost:5430/homeland_core1002_source_restore', '--target-url', 'postgresql://u:p@localhost:5430/homeland_staging_authoritative_v2', '--source-dump', dump]);
  assert.equal(valid.sourceChecksum, SOURCE_CHECKSUM);
  assert.throws(() => ensureSourceIdentity('postgresql://u:p@localhost:5430/homeland'), /isolated/);
  assert.throws(() => ensureTargetIdentity('postgresql://u:p@localhost:5430/homeland'), /exactly/);
  assert.throws(() => parseArguments(['--mode', 'APPLY', '--run-id', 'short', '--source-url', 'postgresql://u:p@localhost:5430/x_restore', '--target-url', 'postgresql://u:p@localhost:5430/homeland_staging_authoritative_v2', '--source-dump', dump]), /run-id/);
  assert.throws(() => parseArguments(['--mode', 'APPLY', '--run-id', 'core1002-12345678', '--source-url', 'postgresql://u:p@localhost:5430/x_restore', '--target-url', 'postgresql://u:p@localhost:5430/homeland_staging_authoritative_v2', '--source-dump', dump, '--fault-after-commit', '1']), /test-only/);
  assert.throws(() => validateSourceDump('package.json'), /approved/);
});

test('record equivalence excludes timestamps but source-plan representation binds them', () => {
  const columns = ['id', 'tenantId', 'createdAt', 'updatedAt', 'payload'];
  const left = cleanRecord({ id: 'a', tenantId: 't', createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-02'), payload: { b: 2, a: 1 } }, columns);
  const right = cleanRecord({ payload: { a: 1, b: 2 }, tenantId: 't', id: 'a', createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-02') }, columns);
  assert.equal(stableJson(left), stableJson(right));
  assert.equal(deterministicRecordId('run-12345678', 'Payment', 'p1'), deterministicRecordId('run-12345678', 'Payment', 'p1'));
  assert.notEqual(stableJson({ id: 'source-1', createdAt: new Date('2026-09-01T00:00:00Z') }), stableJson({ id: 'source-1', createdAt: new Date('2026-09-02T00:00:00Z') }));
});

test('timestamp-only eligible source mutation changes the approved source data fingerprint', async () => {
  const schema = new Map(IMPORT_TABLES.map((item) => [item.table, { sourceExists: item.table === 'TenantOrg', sourceColumns: ['id', 'name', 'createdAt'], columns: ['id', 'name', 'createdAt'] }]));
  const quarantine = new Map(IMPORT_TABLES.map((item) => [item.table, new Map()]));
  const makeSource = (createdAt) => ({ $queryRawUnsafe: async (sql, cursor) => sql.includes('"TenantOrg"') && !cursor ? [{ id: 't1', name: 'Tenant', createdAt: new Date(createdAt) }] : [] });
  const first = await sourceDataFingerprint(makeSource('2026-09-01T00:00:00Z'), schema, quarantine, { mappings: new Map() }, 10);
  const changed = await sourceDataFingerprint(makeSource('2026-09-02T00:00:00Z'), schema, quarantine, { mappings: new Map() }, 10);
  assert.notEqual(first.aggregate, changed.aggregate);
});

test('immutable checkpoint refuses a changed replay and totals are deterministic', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core1002-'));
  const file = path.join(root, 'checkpoint.json');
  writeImmutableJson(file, { cursor: 'a', totals: { INSERT: 2 } });
  assert.doesNotThrow(() => writeImmutableJson(file, { totals: { INSERT: 2 }, cursor: 'a' }));
  assert.throws(() => writeImmutableJson(file, { cursor: 'b', totals: { INSERT: 2 } }), /Immutable evidence conflict/);
  const totals = addTotals(emptyTotals(), { SOURCE_TOTAL: 2, ELIGIBLE: 2, INSERT: 2 });
  assert.deepEqual(totals, { SOURCE_TOTAL: 2, ELIGIBLE: 2, INSERT: 2, UPDATE: 0, SKIP: 0, REJECT: 0, CONFLICT: 0, ORPHAN: 0, REVIEW_REQUIRED: 0, BACKFILL: 0, TOTAL_FAILED: 0 });
  fs.rmSync(root, { recursive: true, force: true });
});

test('failed apply evidence is immutable and records a cumulative failure total', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core1002-failure-'));
  const options = { runId: 'core1002-failure-1', mode: 'APPLY', evidenceDir: root, batchSize: 25, sourceDumpInfo: { sourceId: 'snapshot-1', checksum: 'a'.repeat(64) }, _lastCommitted: { table: 'Room', sequence: 2, cursor: 'r2' } };
  const first = writeFailedOperation(options, { host: 'localhost', port: '5430', database: 'homeland_staging_authoritative_v2' }, Object.assign(new Error('boom'), { code: 'PTEST' }));
  const second = writeFailedOperation(options, { host: 'localhost', port: '5430', database: 'homeland_staging_authoritative_v2' }, new Error('different later error'));
  assert.equal(first.TOTALS.TOTAL_FAILED, 1);
  assert.deepEqual(second, first);
  fs.rmSync(root, { recursive: true, force: true });
});
