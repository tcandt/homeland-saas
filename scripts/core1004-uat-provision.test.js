const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStaticGuards, assertDatabaseGuards, stableId, validateProvisionResult, assertFixtureOwnership } = require('./core1004-uat-provision');
const good = { DEPLOY_ENV:'staging', ALLOW_UAT_FIXTURE_PROVISION:'true', STAGING_DB_ID:'homeland_staging_authoritative_v2', CORE1004_SCHEMA_FINGERPRINT:'abc', FIXTURE_ID:'core1004' };
test('pre-write environment and opt-in guards fail closed', () => {
  assert.throws(() => assertStaticGuards({ ...good, DEPLOY_ENV:'production' }), /staging/);
  assert.throws(() => assertStaticGuards({ ...good, ALLOW_UAT_FIXTURE_PROVISION:'false' }), /ALLOW/);
});
test('database and fingerprint guards fail closed', () => {
  assert.throws(() => assertDatabaseGuards({ databaseId:'wrong',migrationCount:18,schemaFingerprint:'abc' }, good), /identity/);
  assert.throws(() => assertDatabaseGuards({ databaseId:good.STAGING_DB_ID,migrationCount:18,schemaFingerprint:'wrong' }, good), /fingerprint/);
  assert.throws(() => assertDatabaseGuards({ databaseId:good.STAGING_DB_ID,migrationCount:17,schemaFingerprint:'abc' }, good), /migration/);
});
test('fixture identities are deterministic', () => assert.equal(stableId('same','room',1), stableId('same','room',1)));
test('provision output is structured and bound to requested fixture', () => {
  const result = {
    STATUS:'PASS', RUN_ID:'run-1', FIXTURE_ID:'core1004', TENANT_ID:'t', OWNER_A_ID:'a', OWNER_B_ID:'b',
    BUILDING_IDS:Array(11).fill('b'), FLOOR_IDS:Array(11).fill('f'), ROOM_IDS:Array(11).fill('r'),
    CUSTOMER_IDS:Array(11).fill('c'), CONTRACT_IDS:Array(11).fill('k'), RENTAL_CYCLE_IDS:Array(11).fill('y'),
  };
  assert.equal(validateProvisionResult(result, good).STATUS, 'PASS');
  assert.throws(() => validateProvisionResult({ ...result, FIXTURE_ID:'other' }, good), /identifier/);
});
test('fixture hierarchy collision aborts before mutation', async () => {
  const lookup = (value) => ({ findUnique: async () => value });
  const prisma = {
    owner: lookup({ tenantId: 'foreign' }),
    building: lookup(null), floor: lookup(null), room: lookup(null), customer: lookup(null), rentalCycle: lookup(null), contract: lookup(null),
  };
  await assert.rejects(() => assertFixtureOwnership(prisma, 'core1004', 'tenant', 'owner-a', 'owner-b'), /another tenant/);
});
