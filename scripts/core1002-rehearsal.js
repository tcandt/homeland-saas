#!/usr/bin/env node
/*
 * CORE-10.02 cross-database rehearsal.  This deliberately imports a small,
 * reviewed set of legacy tables only.  It is not a generic database copier.
 * The legacy client is used exclusively for SELECT statements and must point
 * to an isolated restore of the frozen source dump, never the live legacy DB.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { fingerprint, readCanonicalInventory } = require('./baseline-v2-inventory');
const { runDetector } = require('./core-lifecycle-detector');

const SOURCE_CHECKSUM = '02b090bbbfdfbaa72137ee7e015f3e78a2ec1db93d5bfc4cb2dab63ec7184c8c';
const APPROVED_SNAPSHOT_ROOT = path.resolve('.codex-backups/legacy-source-core1002');
const TARGET_DATABASE = 'homeland_staging_authoritative_v2';
const TARGET_FINGERPRINT = '41d9b9c2ce5892f4da23688e2c26ca6dc15fcc3f270ec3b51d5795a227ab0e66';
const TIMESTAMP_COLUMNS = new Set(['createdAt', 'updatedAt']);
const NON_IMPORTED = Object.freeze([
  { table: 'BillingSnapshot', classification: 'BACKFILL', reason: 'SOURCE_SNAPSHOT_DOES_NOT_CONTAIN_CANONICAL_SNAPSHOT' },
  { table: 'MonthlySettlementRun', classification: 'BACKFILL', reason: 'SOURCE_SNAPSHOT_DOES_NOT_CONTAIN_CANONICAL_SETTLEMENT_RUN' },
  { table: 'DepositLedgerEntry', classification: 'REVIEW_REQUIRED', reason: 'USE_REVIEWED_OPENING_BALANCE_BACKFILL_ONLY' },
  { table: 'AiConversation', classification: 'SKIP', reason: 'NOT_CORE_MIGRATION_SCOPE' },
  { table: 'DocumentTemplate', classification: 'SKIP', reason: 'NOT_CORE_MIGRATION_SCOPE' },
  { table: 'NotificationJob', classification: 'SKIP', reason: 'NOT_CORE_MIGRATION_SCOPE' },
  { table: 'WorkflowInstance', classification: 'SKIP', reason: 'NOT_CORE_MIGRATION_SCOPE' },
]);

// The order is a foreign-key order.  Nothing outside this explicit list can
// be copied, even if a source table happens to exist.
const IMPORT_TABLES = Object.freeze([
  { table: 'TenantOrg', tenant: false, parents: [] },
  { table: 'Owner', parents: [['tenantId', 'TenantOrg']] },
  { table: 'Building', parents: [['tenantId', 'TenantOrg'], ['ownerId', 'Owner']] },
  { table: 'Floor', parents: [['buildingId', 'Building']] },
  { table: 'Room', parents: [['buildingId', 'Building'], ['floorId', 'Floor']] },
  { table: 'Customer', parents: [['roomId', 'Room']] },
  { table: 'ChartOfAccount', parents: [] },
  { table: 'CashAccount', parents: [] },
  { table: 'BankAccount', parents: [['ownerId', 'Owner']] },
  { table: 'CostCenter', parents: [['ownerId', 'Owner'], ['buildingId', 'Building']] },
  { table: 'RoomPaymentAccountRoute', parents: [['roomId', 'Room'], ['bankAccountId', 'BankAccount']] },
  { table: 'RentalCycle', parents: [['customerId', 'Customer'], ['roomId', 'Room']] },
  { table: 'Contract', parents: [['roomId', 'Room'], ['customerId', 'Customer'], ['rentalCycleId', 'RentalCycle']] },
  { table: 'ContractParty', parents: [['contractId', 'Contract'], ['customerId', 'Customer']] },
  { table: 'Occupancy', parents: [['roomId', 'Room'], ['customerId', 'Customer'], ['contractId', 'Contract'], ['rentalCycleId', 'RentalCycle']] },
  { table: 'Deposit', parents: [['roomId', 'Room'], ['customerId', 'Customer'], ['contractId', 'Contract'], ['rentalCycleId', 'RentalCycle']] },
  { table: 'Invoice', parents: [['customerId', 'Customer'], ['contractId', 'Contract'], ['rentalCycleId', 'RentalCycle']] },
  { table: 'InvoiceItem', parents: [['invoiceId', 'Invoice']] },
  { table: 'Payment', parents: [['invoiceId', 'Invoice'], ['rentalCycleId', 'RentalCycle']] },
  { table: 'PaymentAllocation', parents: [['paymentId', 'Payment'], ['invoiceId', 'Invoice']] },
  { table: 'Expense', parents: [['costCenterId', 'CostCenter'], ['ownerId', 'Owner'], ['buildingId', 'Building'], ['roomId', 'Room'], ['paidByOwnerId', 'Owner']] },
  { table: 'HunonicMeterMapping', parents: [['buildingId', 'Building'], ['roomId', 'Room']] },
  { table: 'HunonicMeterReading', parents: [['meterMappingId', 'HunonicMeterMapping'], ['roomId', 'Room']] },
]);

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stable(value) {
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  if (value === null || typeof value !== 'object' || value instanceof Date) return value instanceof Date ? value.toISOString() : value;
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (value.constructor?.name === 'Decimal') return { $decimal: value.toString() };
  if (Array.isArray(value)) return value.map(stable);
  return Object.keys(value).sort().reduce((result, key) => ({ ...result, [key]: stable(value[key]) }), {});
}
function stableJson(value) { return JSON.stringify(stable(value)); }
function quoted(identifier) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(identifier)) throw new Error(`Unsafe SQL identifier: ${identifier}`);
  return `"${identifier}"`;
}
function databaseIdentity(url) {
  const parsed = new URL(url);
  return { host: parsed.hostname, port: parsed.port || '5432', database: decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) };
}
function maskedIdentity(identity) { return `${identity.host}:${identity.port}/${identity.database}`; }
function ensureSourceIdentity(url) {
  const identity = databaseIdentity(url);
  if (!/(core1002|restore|snapshot|rehearsal|isolated)/i.test(identity.database) || /^homeland$/i.test(identity.database)) {
    throw new Error('SOURCE_URL must name an isolated CORE-10.02 restore, never live homeland.');
  }
  return identity;
}
function ensureTargetIdentity(url) {
  const identity = databaseIdentity(url);
  if (identity.database !== TARGET_DATABASE) throw new Error(`TARGET_URL must point exactly to ${TARGET_DATABASE}.`);
  return identity;
}
function validateSourceDump(sourceDump) {
  const resolved = path.resolve(sourceDump || '');
  const rootPrefix = `${APPROVED_SNAPSHOT_ROOT}${path.sep}`;
  if (!resolved.startsWith(rootPrefix) || path.basename(resolved) !== 'database.dump' || !fs.existsSync(resolved)) throw new Error('--source-dump must be database.dump inside the approved CORE-10.02 snapshot root.');
  const manifestPath = path.join(path.dirname(resolved), 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Approved source dump manifest is missing.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');
  if (checksum !== SOURCE_CHECKSUM || manifest?.database?.sha256 !== SOURCE_CHECKSUM) throw new Error('Approved source dump checksum/manifest mismatch.');
  return { path: resolved, checksum, sourceId: String(manifest.id || '') };
}
function parseArguments(argv) {
  const options = { mode: 'DRY_RUN', runId: '', sourceUrl: '', targetUrl: '', sourceDump: '', batchSize: 100, evidenceDir: '.codex-runtime/core1002-evidence', sourceChecksum: SOURCE_CHECKSUM, expectedTargetFingerprint: TARGET_FINGERPRINT, faultAfterCommit: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') options.mode = String(argv[++index] || '').toUpperCase();
    else if (arg === '--run-id') options.runId = argv[++index] || '';
    else if (arg === '--source-url') options.sourceUrl = argv[++index] || '';
    else if (arg === '--target-url') options.targetUrl = argv[++index] || '';
    else if (arg === '--source-dump') options.sourceDump = argv[++index] || '';
    else if (arg === '--batch-size') options.batchSize = Number(argv[++index]);
    else if (arg === '--evidence-dir') options.evidenceDir = argv[++index] || options.evidenceDir;
    else if (arg === '--source-checksum') options.sourceChecksum = argv[++index] || '';
    else if (arg === '--expected-target-fingerprint') options.expectedTargetFingerprint = argv[++index] || '';
    else if (arg === '--fault-after-commit') options.faultAfterCommit = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['DRY_RUN', 'APPLY', 'RESUME'].includes(options.mode)) throw new Error('--mode must be DRY_RUN, APPLY, or RESUME.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,120}$/.test(options.runId)) throw new Error('--run-id must be stable and at least 8 safe characters.');
  if (!options.sourceUrl || !options.targetUrl || !options.sourceDump) throw new Error('--source-url, --target-url and --source-dump are required.');
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 1000) throw new Error('--batch-size must be an integer from 1 to 1000.');
  if (!Number.isInteger(options.faultAfterCommit) || options.faultAfterCommit < 0) throw new Error('--fault-after-commit must be a non-negative integer.');
  if (options.faultAfterCommit && process.env.CORE1002_TEST_FAULTS !== '1') throw new Error('--fault-after-commit is test-only and requires CORE1002_TEST_FAULTS=1.');
  if (options.sourceChecksum !== SOURCE_CHECKSUM) throw new Error('Source checksum does not match the frozen CORE-10.02 snapshot.');
  options.sourceDumpInfo = validateSourceDump(options.sourceDump);
  return options;
}
function artifactPath(options, name) { return path.resolve(options.evidenceDir, options.runId, name); }
function writeImmutableJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const content = `${stableJson(payload)}\n`;
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== content) throw new Error(`Immutable evidence conflict: ${file}`);
    return sha256(content);
  }
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporary, file);
  return sha256(content);
}
function readJsonIfExists(file) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; }
function emptyTotals() { return { SOURCE_TOTAL: 0, ELIGIBLE: 0, INSERT: 0, UPDATE: 0, SKIP: 0, REJECT: 0, CONFLICT: 0, ORPHAN: 0, REVIEW_REQUIRED: 0, BACKFILL: 0, TOTAL_FAILED: 0 }; }
function addTotals(to, from) { for (const key of Object.keys(to)) to[key] += Number(from[key] || 0); return to; }
function cleanRecord(row, columns) {
  return Object.fromEntries(columns.filter((key) => !TIMESTAMP_COLUMNS.has(key)).map((key) => [key, row[key] === undefined ? null : row[key]]));
}
function deterministicRecordId(runId, table, sourceId) { return `core1002_${sha256(`${runId}:${table}:${sourceId}`).slice(0, 30)}`; }
function normalizeIdentity(value) { return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); }
function sourceSchemaColumns(prisma, table) {
  return prisma.$queryRawUnsafe('SELECT column_name AS "columnName", data_type AS "dataType", udt_name AS "udtName" FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = $1 ORDER BY ordinal_position', table);
}
async function sourceTableExists(prisma, table) {
  const rows = await prisma.$queryRawUnsafe('SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = $1', table);
  return rows.length === 1;
}
async function buildSchemaMap(source, target) {
  const result = new Map();
  for (const descriptor of IMPORT_TABLES) {
    const [sourceExists, targetExists] = await Promise.all([sourceTableExists(source, descriptor.table), sourceTableExists(target, descriptor.table)]);
    if (!sourceExists || !targetExists) { result.set(descriptor.table, { sourceExists, targetExists, columns: [] }); continue; }
    const [sourceColumns, targetColumns] = await Promise.all([sourceSchemaColumns(source, descriptor.table), sourceSchemaColumns(target, descriptor.table)]);
    const targetSet = new Set(targetColumns.map((row) => row.columnName));
    const sourceColumnsShared = sourceColumns.map((row) => row.columnName).filter((column) => targetSet.has(column));
    const columns = [...sourceColumnsShared];
    if (descriptor.table === 'HunonicMeterReading') {
      for (const field of ['sourceProvider', 'sourceProviderMeterId', 'sourcePeriod', 'observedAt', 'payloadHash', 'aggregateBasis']) {
        if (targetSet.has(field) && !columns.includes(field)) columns.push(field);
      }
    }
    if (!columns.includes('id')) throw new Error(`${descriptor.table} has no shared id column.`);
    const targetByColumn = new Map(targetColumns.map((row) => [row.columnName, row]));
    const casts = Object.fromEntries(columns
      .map((column) => [column, targetByColumn.get(column)])
      .filter(([, column]) => column.dataType === 'USER-DEFINED' || column.dataType === 'jsonb')
      .map(([name, column]) => [name, column.dataType === 'jsonb' ? 'jsonb' : column.udtName]));
    result.set(descriptor.table, { sourceExists, targetExists, sourceColumns: sourceColumnsShared, columns, casts });
  }
  return result;
}
async function duplicateSets(source) {
  const duplicateCustomerIds = new Set();
  if (await sourceTableExists(source, 'Customer')) {
    const customers = await source.$queryRawUnsafe('SELECT "id", "tenantId", "identityNo" FROM "Customer" WHERE "identityNo" IS NOT NULL AND btrim("identityNo") <> \'\' ORDER BY "tenantId", "id"');
    const groups = new Map();
    for (const item of customers) { const key = `${item.tenantId}:${normalizeIdentity(item.identityNo)}`; if (key.endsWith(':')) continue; groups.set(key, [...(groups.get(key) || []), item.id]); }
    for (const ids of groups.values()) if (ids.length > 1) ids.forEach((id) => duplicateCustomerIds.add(id));
  }
  const duplicatePaymentIds = new Set();
  if (await sourceTableExists(source, 'Payment')) {
    const payments = await source.$queryRawUnsafe('SELECT "id", "tenantId", "provider", "providerRef" FROM "Payment" WHERE "providerRef" IS NOT NULL AND btrim("providerRef") <> \'\' ORDER BY "tenantId", "id"');
    const groups = new Map();
    for (const item of payments) { const key = `${item.tenantId}:${item.provider}:${String(item.providerRef).trim()}`; groups.set(key, [...(groups.get(key) || []), item.id]); }
    for (const ids of groups.values()) if (ids.length > 1) ids.forEach((id) => duplicatePaymentIds.add(id));
  }
  return { duplicateCustomerIds, duplicatePaymentIds };
}
async function targetFingerprint(target) { return fingerprint(await readCanonicalInventory(target)); }
async function fetchBatch(source, table, columns, cursor, batchSize) {
  const selectColumns = columns.map(quoted).join(', ');
  return source.$queryRawUnsafe(`SELECT ${selectColumns} FROM ${quoted(table)} WHERE "id" > $1 ORDER BY "id" ASC LIMIT $2`, cursor || '', batchSize);
}
async function buildTransforms(source) {
  const mappings = new Map();
  if (await sourceTableExists(source, 'HunonicMeterMapping')) {
    const rows = await source.$queryRawUnsafe('SELECT "id", "provider", "providerMeterId" FROM "HunonicMeterMapping"');
    for (const row of rows) mappings.set(row.id, row);
  }
  return { mappings };
}
function transformRow(descriptor, row, transforms) {
  if (descriptor.table !== 'HunonicMeterReading') return { row, reason: null };
  const mapping = transforms.mappings.get(row.meterMappingId);
  const period = String(row.currentMonth || '');
  if (!mapping || !mapping.providerMeterId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || !row.readingAt) {
    return { row, reason: 'HUNONIC_READING_PROVENANCE_REQUIRES_REVIEW' };
  }
  // All new provenance is deterministically derived from immutable legacy
  // evidence; no consumption/billing snapshot is manufactured here.
  return {
    reason: null,
    row: {
      ...row,
      sourceProvider: String(mapping.provider || 'hunonic'),
      sourceProviderMeterId: mapping.providerMeterId,
      sourcePeriod: period,
      observedAt: row.readingAt,
      payloadHash: sha256(stableJson(row.raw || {})),
      aggregateBasis: 'MONTHLY_AGGREGATE_V1',
    },
  };
}
async function targetRow(tx, table, id) {
  const rows = await tx.$queryRawUnsafe(`SELECT * FROM ${quoted(table)} WHERE "id" = $1 LIMIT 1`, id);
  return rows[0] || null;
}
async function relationIssue(tx, descriptor, row) {
  if (descriptor.table !== 'TenantOrg' && row.tenantId) {
    const tenant = await targetRow(tx, 'TenantOrg', row.tenantId);
    if (!tenant) return 'ORPHAN_TENANT';
  }
  for (const [field, parentTable] of descriptor.parents) {
    if (!row[field]) continue;
    const parent = await targetRow(tx, parentTable, row[field]);
    if (!parent) return `ORPHAN_${field}`;
    if (row.tenantId && parent.tenantId && row.tenantId !== parent.tenantId) return `CROSS_TENANT_${field}`;
  }
  return null;
}
async function buildQuarantine(source, schema, duplicates) {
  const records = new Map(IMPORT_TABLES.map((descriptor) => [descriptor.table, new Map()]));
  for (const id of duplicates.duplicateCustomerIds) records.get('Customer').set(id, 'DUPLICATE_CUSTOMER_IDENTITY_REQUIRES_REVIEW');
  for (const id of duplicates.duplicatePaymentIds) records.get('Payment').set(id, 'DUPLICATE_PAYMENT_PROVIDER_REF_REQUIRES_REVIEW');
  // Propagate a direct quarantine through the explicit FK graph.  A dependent
  // is REJECTED, not silently copied with a broken source relation.
  let changed = true;
  while (changed) {
    changed = false;
    for (const descriptor of IMPORT_TABLES) {
      const meta = schema.get(descriptor.table);
      if (!meta?.sourceExists || !descriptor.parents.length) continue;
      const fields = ['id', ...descriptor.parents.map(([field]) => field)].filter((field, index, all) => meta.sourceColumns.includes(field) && all.indexOf(field) === index);
      const rows = await source.$queryRawUnsafe(`SELECT ${fields.map(quoted).join(', ')} FROM ${quoted(descriptor.table)} ORDER BY "id"`);
      for (const row of rows) {
        if (records.get(descriptor.table).has(row.id)) continue;
        const parent = descriptor.parents.find(([field, table]) => row[field] && records.get(table)?.has(row[field]));
        if (parent) {
          records.get(descriptor.table).set(row.id, `DEPENDENCY_QUARANTINED_${parent[1]}`);
          changed = true;
        }
      }
    }
  }
  return records;
}
function quarantineReason(descriptor, row, quarantine) { return quarantine?.get(descriptor.table)?.get(row.id) || null; }
function isReviewReason(reason) { return reason && !reason.startsWith('DEPENDENCY_QUARANTINED_'); }
async function hasRecordAudit(tx, runId, table, id) {
  const auditId = deterministicRecordId(runId, 'audit:record', `${table}:${id}`);
  return Boolean(await targetRow(tx, 'AuditLog', auditId));
}
async function insertEquivalent(tx, runId, table, row, columns, casts = {}) {
  const existing = await targetRow(tx, table, row.id);
  const incoming = cleanRecord(row, columns);
  if (existing) {
    const actual = cleanRecord(existing, columns);
    // Exact values alone are not proof of a safe resume.  They must have an
    // immutable audit row belonging to this exact RUN_ID, otherwise another
    // interrupted or manual import may have produced them.
    return stableJson(incoming) === stableJson(actual) && await hasRecordAudit(tx, runId, table, row.id) ? 'SKIP' : 'CONFLICT';
  }
  const fields = columns.map(quoted).join(', ');
  const placeholders = columns.map((column, index) => `$${index + 1}${casts[column] ? `::${casts[column] === 'jsonb' ? 'jsonb' : quoted(casts[column])}` : ''}`).join(', ');
  await tx.$executeRawUnsafe(`INSERT INTO ${quoted(table)} (${fields}) VALUES (${placeholders})`, ...columns.map((column) => row[column]));
  return 'INSERT';
}
async function writeAudit(tx, runId, kind, tenantId, entity, entityId, after) {
  const id = deterministicRecordId(runId, `audit:${kind}`, `${entity}:${entityId}`);
  const existing = await targetRow(tx, 'AuditLog', id);
  if (existing) return;
  await tx.$executeRawUnsafe(
    'INSERT INTO "AuditLog" ("id", "tenantId", "module", "entity", "entityId", "action", "after") VALUES ($1, $2, $3, $4, $5, $6::"AuditAction", $7::jsonb)',
    id, tenantId || null, 'CORE1002Rehearsal', entity, entityId, 'CREATE', JSON.stringify({ ...after, runId }),
  );
}
async function assertTargetRunBoundary(target, runId) {
  const rows = await target.$queryRawUnsafe(
    'SELECT count(*)::int AS total, count(*) FILTER (WHERE "after"->>\'runId\' = $1)::int AS same_run FROM "AuditLog" WHERE "module" = \'CORE1002Rehearsal\'',
    runId,
  );
  const state = rows[0] || { total: 0, same_run: 0 };
  if (Number(state.total) !== Number(state.same_run)) {
    throw new Error('Target contains CORE-10.02 records from another or unverifiable RUN_ID; restore the authoritative staging backup before a new run.');
  }
}
async function readAudit(tx, runId, kind, entity, entityId) {
  const id = deterministicRecordId(runId, `audit:${kind}`, `${entity}:${entityId}`);
  const row = await targetRow(tx, 'AuditLog', id);
  return row?.after || null;
}
function makePlanIdentity(options, sourceIdentity, targetIdentity, sourceFingerprint) {
  return { version: 2, runId: options.runId, source: { id: options.sourceDumpInfo.sourceId, restoredDb: maskedIdentity(sourceIdentity), checksum: options.sourceDumpInfo.checksum, fingerprint: sourceFingerprint }, target: { id: maskedIdentity(targetIdentity), fingerprint: options.expectedTargetFingerprint }, batchSize: options.batchSize, tables: IMPORT_TABLES.map((entry) => entry.table), nonImported: NON_IMPORTED };
}
async function readSourceFingerprint(source) { return fingerprint(await readCanonicalInventory(source)); }
async function sourceDataFingerprint(source, schema, quarantine, transforms, batchSize) {
  const perTable = {};
  for (const descriptor of IMPORT_TABLES) {
    const meta = schema.get(descriptor.table);
    if (!meta?.sourceExists) { perTable[descriptor.table] = sha256('SOURCE_TABLE_ABSENT'); continue; }
    const records = []; let cursor = '';
    while (true) {
      const rows = await fetchBatch(source, descriptor.table, meta.sourceColumns, cursor, batchSize);
      if (!rows.length) break;
      for (const row of rows) {
        const transformed = transformRow(descriptor, row, transforms);
        // Do not omit audit timestamps here: every source value that reaches
        // target data, a transform, or a quarantine decision binds the plan.
        records.push({ id: row.id, source: Object.fromEntries(meta.sourceColumns.map((field) => [field, row[field]])), effective: Object.fromEntries(meta.columns.map((field) => [field, transformed.row[field]])), classification: quarantineReason(descriptor, row, quarantine) || transformed.reason || 'ELIGIBLE' });
      }
      cursor = rows.at(-1).id;
    }
    perTable[descriptor.table] = sha256(stableJson(records));
  }
  return { perTable, aggregate: sha256(stableJson(perTable)) };
}
function ensureRunMetadata(options, sourceIdentity, targetIdentity) {
  const file = artifactPath(options, 'run.json');
  const existing = readJsonIfExists(file);
  const payload = existing || { RUN_ID: options.runId, SOURCE_ID: options.sourceDumpInfo.sourceId, SOURCE_CHECKSUM: options.sourceDumpInfo.checksum, TARGET_DB_ID: maskedIdentity(targetIdentity), STARTED_AT: new Date().toISOString(), BATCH_SIZE: options.batchSize };
  if (payload.RUN_ID !== options.runId || payload.SOURCE_CHECKSUM !== options.sourceDumpInfo.checksum || payload.TARGET_DB_ID !== maskedIdentity(targetIdentity) || payload.BATCH_SIZE !== options.batchSize) throw new Error('Immutable run metadata does not match current invocation.');
  writeImmutableJson(file, payload);
  return payload;
}
function writeOperationMetadata(options, metadata, mode, totals) {
  const file = artifactPath(options, `operations/${mode}.json`);
  const prior = readJsonIfExists(file);
  const payload = { ...metadata, MODE: mode, FINISHED_AT: prior?.FINISHED_AT || new Date().toISOString(), TOTALS: totals };
  writeImmutableJson(file, payload);
  return payload;
}
function sanitizedError(error) {
  const message = String(error?.message || 'UNKNOWN_ERROR').replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'DATABASE_URL_REDACTED').slice(0, 500);
  return { code: String(error?.code || error?.name || 'ERROR').slice(0, 80), message };
}
function writeFailedOperation(options, targetIdentity, error) {
  const metadata = readJsonIfExists(artifactPath(options, 'run.json')) || {
    RUN_ID: options.runId, SOURCE_ID: options.sourceDumpInfo.sourceId, SOURCE_CHECKSUM: options.sourceDumpInfo.checksum,
    TARGET_DB_ID: maskedIdentity(targetIdentity), STARTED_AT: new Date().toISOString(), BATCH_SIZE: options.batchSize,
  };
  writeImmutableJson(artifactPath(options, 'run.json'), metadata);
  const existing = readJsonIfExists(artifactPath(options, `operations/${options.mode}_FAILED.json`));
  const payload = existing || { ...metadata, MODE: options.mode, FAILED_AT: new Date().toISOString(), ERROR: sanitizedError(error), TOTALS: { ...emptyTotals(), TOTAL_FAILED: 1 }, LAST_COMMITTED_BATCH: options._lastCommitted || null };
  writeImmutableJson(artifactPath(options, `operations/${options.mode}_FAILED.json`), payload);
  return payload;
}
async function dryRun(options, clients) {
  const { source, target } = clients;
  const sourceIdentity = ensureSourceIdentity(options.sourceUrl); const targetIdentity = ensureTargetIdentity(options.targetUrl);
  const actualTargetFingerprint = await targetFingerprint(target);
  if (actualTargetFingerprint !== options.expectedTargetFingerprint) throw new Error(`Target schema fingerprint mismatch: ${actualTargetFingerprint}`);
  const metadata = ensureRunMetadata(options, sourceIdentity, targetIdentity);
  const [sourceFingerprint, schema, duplicates, transforms] = await Promise.all([readSourceFingerprint(source), buildSchemaMap(source, target), duplicateSets(source), buildTransforms(source)]);
  const quarantine = await buildQuarantine(source, schema, duplicates);
  const dataFingerprint = await sourceDataFingerprint(source, schema, quarantine, transforms, options.batchSize);
  const plan = makePlanIdentity(options, sourceIdentity, targetIdentity, sourceFingerprint);
  plan.schema = Object.fromEntries([...schema.entries()].map(([table, value]) => [table, value]));
  plan.quarantine = {
    duplicateCustomerIds: [...duplicates.duplicateCustomerIds].sort(),
    duplicatePaymentIds: [...duplicates.duplicatePaymentIds].sort(),
    records: Object.fromEntries([...quarantine.entries()].map(([table, rows]) => [table, [...rows.entries()].sort(([left], [right]) => left.localeCompare(right))])),
  };
  plan.transforms = { HunonicMeterReading: 'LEGACY_RAW_TO_MONTHLY_AGGREGATE_V1' };
  plan.sourceDataFingerprint = dataFingerprint;
  plan.planHash = sha256(stableJson(plan));
  writeImmutableJson(artifactPath(options, 'plan.json'), plan);
  const totals = emptyTotals(); const perTable = {};
  for (const descriptor of IMPORT_TABLES) {
    const meta = schema.get(descriptor.table); const tableTotals = emptyTotals(); perTable[descriptor.table] = tableTotals;
    if (!meta.sourceExists || !meta.targetExists) { tableTotals.BACKFILL += 1; addTotals(totals, tableTotals); continue; }
    let cursor = '';
    while (true) {
      const rows = await fetchBatch(source, descriptor.table, meta.sourceColumns, cursor, options.batchSize);
      if (!rows.length) break;
      for (const row of rows) {
        tableTotals.SOURCE_TOTAL += 1;
        const transformed = transformRow(descriptor, row, transforms);
        const direct = quarantineReason(descriptor, row, quarantine) || transformed.reason;
        if (direct) { tableTotals[isReviewReason(direct) ? 'REVIEW_REQUIRED' : 'REJECT'] += 1; continue; }
        // Dry-run intentionally does not query or mutate target record state.  The
        // relation classification is verified again atomically during APPLY.
        tableTotals.ELIGIBLE += 1; tableTotals.INSERT += 1;
      }
      cursor = rows[rows.length - 1].id;
    }
    addTotals(totals, tableTotals);
  }
  for (const ignored of NON_IMPORTED) totals[ignored.classification] = (totals[ignored.classification] || 0) + 1;
  const result = { mode: 'DRY_RUN', planHash: plan.planHash, sourceFingerprint, sourceDataFingerprint: dataFingerprint.aggregate, targetFingerprint: actualTargetFingerprint, totals, perTable, nonImported: NON_IMPORTED };
  writeImmutableJson(artifactPath(options, `dry-run-${plan.planHash}.json`), result);
  writeOperationMetadata(options, metadata, 'DRY_RUN', totals);
  return result;
}
function committedCheckpoints(options, table) {
  const directory = path.dirname(artifactPath(options, `batches/${table}/placeholder`));
  if (!fs.existsSync(directory)) return [];
  const checkpoints = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort();
  return checkpoints.map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
}
async function financialControl(prisma, schema, quarantine = null, expected = false) {
  const totals = { depositAmount: 0, invoiceTotal: 0, invoicePaid: 0, confirmedPayment: 0, allocationAmount: 0, outstanding: 0, depositLedgerBalance: null, credit: null, refund: null, classification: 'SIMPLE_IMPORT_CONTROL' };
  for (const descriptor of IMPORT_TABLES.filter((item) => ['Deposit', 'Invoice', 'Payment', 'PaymentAllocation'].includes(item.table))) {
    const meta = schema.get(descriptor.table); if (!meta?.sourceExists && expected) continue;
    if (!expected) {
      const exists = await sourceTableExists(prisma, descriptor.table); if (!exists) continue;
    }
    const columns = expected ? meta.sourceColumns : ['id', 'amount', 'total', 'paidAmount', 'creditAmount', 'status'];
    if (expected) {
      let cursor = '';
      while (true) {
        const rows = await fetchBatch(prisma, descriptor.table, columns, cursor, 500);
        if (!rows.length) break;
        for (const row of rows) {
          if (quarantineReason(descriptor, row, quarantine)) continue;
          if (descriptor.table === 'Deposit') totals.depositAmount += Number(row.amount || 0);
          if (descriptor.table === 'Invoice') { totals.invoiceTotal += Number(row.total || 0); totals.invoicePaid += Number(row.paidAmount || 0); totals.outstanding += Number(row.total || 0) - Number(row.paidAmount || 0) - Number(row.creditAmount || 0); }
          if (descriptor.table === 'Payment' && row.status === 'CONFIRMED') totals.confirmedPayment += Number(row.amount || 0);
          if (descriptor.table === 'PaymentAllocation') totals.allocationAmount += Number(row.amount || 0);
        }
        cursor = rows.at(-1).id;
      }
    } else {
      const sql = descriptor.table === 'Invoice'
        ? 'SELECT COALESCE(sum("total"), 0)::text AS total, COALESCE(sum("paidAmount"), 0)::text AS paid, COALESCE(sum("creditAmount"), 0)::text AS credit FROM "Invoice"'
        : descriptor.table === 'Payment'
          ? 'SELECT COALESCE(sum("amount"), 0)::text AS amount, COALESCE(sum(CASE WHEN "status" = \'CONFIRMED\' THEN "amount" ELSE 0 END), 0)::text AS confirmed FROM "Payment"'
          : `SELECT COALESCE(sum("amount"), 0)::text AS amount FROM ${quoted(descriptor.table)}`;
      const rows = await prisma.$queryRawUnsafe(sql);
      const row = rows[0] || {};
      if (descriptor.table === 'Deposit') totals.depositAmount += Number(row.amount || 0);
      if (descriptor.table === 'Invoice') { totals.invoiceTotal += Number(row.total || 0); totals.invoicePaid += Number(row.paid || 0); totals.outstanding += Number(row.total || 0) - Number(row.paid || 0) - Number(row.credit || 0); }
      if (descriptor.table === 'Payment') totals.confirmedPayment += Number(row.confirmed || 0);
      if (descriptor.table === 'PaymentAllocation') totals.allocationAmount += Number(row.amount || 0);
    }
  }
  for (const key of Object.keys(totals)) if (typeof totals[key] === 'number') totals[key] = Number(totals[key].toFixed(2));
  return totals;
}
async function runTargetDetector(target) {
  const originalWrite = process.stdout.write;
  process.stdout.write = () => true;
  try { return await runDetector({ envFile: null, tenantId: '' }, { prisma: target }); }
  finally { process.stdout.write = originalWrite; }
}
async function apply(options, clients) {
  const { source, target } = clients;
  const plan = readJsonIfExists(artifactPath(options, 'plan.json'));
  if (!plan) throw new Error('APPLY/RESUME requires the immutable DRY_RUN plan artifact.');
  const currentDryRun = await dryRun({ ...options, mode: 'DRY_RUN' }, clients);
  if (currentDryRun.planHash !== plan.planHash) throw new Error('Current source/target plan differs from approved dry-run; refuse apply.');
  await assertTargetRunBoundary(target, options.runId);
  const schema = new Map(Object.entries(plan.schema));
  const transforms = await buildTransforms(source);
  const duplicates = { duplicateCustomerIds: new Set(plan.quarantine.duplicateCustomerIds), duplicatePaymentIds: new Set(plan.quarantine.duplicatePaymentIds) };
  const quarantine = new Map(IMPORT_TABLES.map((descriptor) => [descriptor.table, new Map(plan.quarantine.records?.[descriptor.table] || [])]));
  const totals = emptyTotals(); const perTable = {};
  let committedBatchCount = 0;
  for (const descriptor of IMPORT_TABLES) {
    const meta = schema.get(descriptor.table); const tableTotals = emptyTotals(); perTable[descriptor.table] = tableTotals;
    if (!meta.sourceExists || !meta.targetExists) { tableTotals.BACKFILL += 1; addTotals(totals, tableTotals); continue; }
    const existingCheckpoints = committedCheckpoints(options, descriptor.table);
    for (const checkpoint of existingCheckpoints) {
      if (checkpoint.runId !== options.runId || checkpoint.planHash !== plan.planHash || checkpoint.table !== descriptor.table) throw new Error(`Invalid checkpoint for ${descriptor.table}.`);
      addTotals(tableTotals, checkpoint.totals); addTotals(totals, checkpoint.totals);
    }
    let cursor = existingCheckpoints.at(-1)?.cursor || '';
    let sequence = existingCheckpoints.length;
    while (true) {
      const rows = await fetchBatch(source, descriptor.table, meta.sourceColumns, cursor, options.batchSize);
      if (!rows.length) break;
      const batchTotals = emptyTotals(); const decisions = [];
      const nextSequence = sequence + 1;
      // A crash after commit but before the filesystem checkpoint is repaired
      // from the in-transaction AuditLog.  It retains original INSERT totals
      // instead of recasting a committed batch as a new SKIP-only batch.
      const committed = await target.$transaction((tx) => readAudit(tx, options.runId, 'batch', 'CORE1002Batch', `${descriptor.table}:${nextSequence}`));
      if (committed) {
        if (committed.planHash !== plan.planHash || committed.table !== descriptor.table || committed.cursor !== rows[rows.length - 1].id) {
          throw new Error(`Committed batch audit does not match source batch: ${descriptor.table}:${nextSequence}`);
        }
        Object.assign(batchTotals, committed.totals || {});
        cursor = rows[rows.length - 1].id; sequence = nextSequence;
        const recovered = { version: 1, runId: options.runId, planHash: plan.planHash, table: descriptor.table, sequence, cursor, sourceRange: { firstId: rows[0].id, lastId: cursor, count: rows.length }, totals: batchTotals, decisions, recoveredFromAudit: true };
        writeImmutableJson(artifactPath(options, `batches/${descriptor.table}/${String(sequence).padStart(6, '0')}-${cursor}.json`), recovered);
        addTotals(tableTotals, batchTotals); addTotals(totals, batchTotals);
        continue;
      }
      await target.$transaction(async (tx) => {
        for (const row of rows) {
          batchTotals.SOURCE_TOTAL += 1;
          const transformed = transformRow(descriptor, row, transforms);
          const direct = quarantineReason(descriptor, row, quarantine) || transformed.reason;
          if (direct) {
            const classification = isReviewReason(direct) ? 'REVIEW_REQUIRED' : 'REJECT';
            batchTotals[classification] += 1; decisions.push({ id: row.id, classification, reason: direct }); continue;
          }
          const canonicalRow = transformed.row;
          const issue = await relationIssue(tx, descriptor, canonicalRow);
          if (issue) { batchTotals[issue.startsWith('ORPHAN') ? 'ORPHAN' : 'REJECT'] += 1; decisions.push({ id: row.id, classification: issue.startsWith('ORPHAN') ? 'ORPHAN' : 'REJECT', reason: issue }); continue; }
          batchTotals.ELIGIBLE += 1;
          const outcome = await insertEquivalent(tx, options.runId, descriptor.table, canonicalRow, meta.columns, meta.casts);
          batchTotals[outcome] += 1;
          decisions.push({ id: row.id, classification: outcome });
          if (outcome === 'INSERT') await writeAudit(tx, options.runId, 'record', canonicalRow.tenantId, descriptor.table, canonicalRow.id, { sourceId: canonicalRow.id, sourceChecksum: options.sourceChecksum, planHash: plan.planHash });
        }
        await writeAudit(tx, options.runId, 'batch', null, 'CORE1002Batch', `${descriptor.table}:${nextSequence}`, { table: descriptor.table, cursor: rows[rows.length - 1].id, totals: batchTotals, planHash: plan.planHash });
      }, { timeout: 10000 });
      committedBatchCount += 1;
      options._lastCommitted = { table: descriptor.table, sequence: nextSequence, cursor: rows[rows.length - 1].id };
      if (options.faultAfterCommit === committedBatchCount) throw new Error(`INJECTED_FAULT_AFTER_COMMITTED_BATCH:${descriptor.table}:${nextSequence}`);
      addTotals(tableTotals, batchTotals); addTotals(totals, batchTotals);
      cursor = rows[rows.length - 1].id; sequence = nextSequence;
      const checkpoint = { version: 1, runId: options.runId, planHash: plan.planHash, table: descriptor.table, sequence, cursor, sourceRange: { firstId: rows[0].id, lastId: cursor, count: rows.length }, totals: batchTotals, decisions };
      writeImmutableJson(artifactPath(options, `batches/${descriptor.table}/${String(sequence).padStart(6, '0')}-${cursor}.json`), checkpoint);
    }
  }
  for (const ignored of NON_IMPORTED) totals[ignored.classification] = (totals[ignored.classification] || 0) + 1;
  const result = { mode: options.mode, planHash: plan.planHash, totals, perTable, nonImported: NON_IMPORTED };
  writeImmutableJson(artifactPath(options, `apply-${plan.planHash}.json`), result);
  const sourceControl = await financialControl(source, schema, null, true);
  const expectedControl = await financialControl(source, schema, quarantine, true);
  const targetControl = await financialControl(target, schema, null, false);
  writeImmutableJson(artifactPath(options, `financial-control-${plan.planHash}.json`), { runId: options.runId, planHash: plan.planHash, source: sourceControl, expected: expectedControl, target: targetControl, explainedDelta: { quarantineOrBackfill: totals.REJECT + totals.REVIEW_REQUIRED + totals.BACKFILL } });
  const detector = await runTargetDetector(target);
  writeImmutableJson(artifactPath(options, `detector-${plan.planHash}.json`), { runId: options.runId, planHash: plan.planHash, totalFindings: detector.totalFindings, countsBySeverity: detector.countsBySeverity, countsByCode: detector.countsByCode });
  if (detector.totalFindings !== 0) throw new Error(`Post-apply lifecycle detector found ${detector.totalFindings} finding(s).`);
  const metadata = readJsonIfExists(artifactPath(options, 'run.json'));
  writeOperationMetadata(options, metadata, options.mode, totals);
  return result;
}
async function withSourceSnapshot(source, work) {
  return source.$transaction(async (sourceSnapshot) => {
    await sourceSnapshot.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return work(sourceSnapshot);
  }, { isolationLevel: 'RepeatableRead', timeout: 60000 });
}
async function run(options, deps = {}) {
  const sourceIdentity = ensureSourceIdentity(options.sourceUrl); const targetIdentity = ensureTargetIdentity(options.targetUrl);
  const source = deps.source || new PrismaClient({ datasources: { db: { url: options.sourceUrl } } });
  const target = deps.target || new PrismaClient({ datasources: { db: { url: options.targetUrl } } });
  try {
    const result = await withSourceSnapshot(source, async (sourceSnapshot) => {
      return options.mode === 'DRY_RUN'
        ? dryRun(options, { source: sourceSnapshot, target })
        : apply(options, { source: sourceSnapshot, target });
    });
    return { ...result, source: maskedIdentity(sourceIdentity), target: maskedIdentity(targetIdentity), runId: options.runId };
  } catch (error) {
    if (options.mode === 'APPLY' || options.mode === 'RESUME') writeFailedOperation(options, targetIdentity, error);
    throw error;
  } finally { if (!deps.source) await source.$disconnect(); if (!deps.target) await target.$disconnect(); }
}
if (require.main === module) {
  run(parseArguments(process.argv.slice(2))).then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch((error) => { process.stderr.write(`CORE-10.02 rehearsal failed: ${error.message}\n`); process.exitCode = 1; });
}
module.exports = { IMPORT_TABLES, NON_IMPORTED, SOURCE_CHECKSUM, TARGET_DATABASE, TARGET_FINGERPRINT, addTotals, cleanRecord, databaseIdentity, deterministicRecordId, dryRun, emptyTotals, ensureSourceIdentity, ensureTargetIdentity, insertEquivalent, normalizeIdentity, parseArguments, run, sanitizedError, sourceDataFingerprint, stableJson, validateSourceDump, withSourceSnapshot, writeFailedOperation, writeImmutableJson };
