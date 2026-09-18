const { PrismaClient } = require('@prisma/client');
const { readCanonicalInventory, fingerprint } = require('./baseline-v2-inventory');

const EXPECTED_MIGRATIONS = 18;
const FLOW_KEYS = ['booking-hold','deposit-insufficient','deposit-exact','deposit-excess-refund','contract-activation','invoice-payment-retry','shared-room-a-b','renewal','transfer-shared-leave','final-settlement-move-out','reconciliation-drilldown'];

function assertStaticGuards(env) {
  const deploymentEnv = env.DEPLOY_ENV || env.APP_ENV || env.ENVIRONMENT;
  if (deploymentEnv !== 'staging') throw new Error('REFUSED: deployment environment must be staging');
  if (env.ALLOW_UAT_FIXTURE_PROVISION !== 'true') throw new Error('REFUSED: ALLOW_UAT_FIXTURE_PROVISION must be true');
  if (!env.STAGING_DB_ID) throw new Error('REFUSED: STAGING_DB_ID is required');
  if (!env.CORE1004_SCHEMA_FINGERPRINT) throw new Error('REFUSED: CORE1004_SCHEMA_FINGERPRINT is required');
  if (!env.FIXTURE_ID) throw new Error('REFUSED: FIXTURE_ID is required');
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/.test(env.FIXTURE_ID)) throw new Error('REFUSED: FIXTURE_ID format is invalid');
}

async function readIdentity(prisma) {
  const [db] = await prisma.$queryRawUnsafe('SELECT current_database() AS "databaseId"');
  const [migration] = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  return { databaseId: db.databaseId, migrationCount: Number(migration.count), schemaFingerprint: fingerprint(await readCanonicalInventory(prisma)) };
}

function assertDatabaseGuards(identity, env) {
  if (identity.databaseId !== env.STAGING_DB_ID) throw new Error('REFUSED: connected database identity mismatch');
  if (identity.migrationCount !== EXPECTED_MIGRATIONS) throw new Error('REFUSED: migration count mismatch');
  if (identity.schemaFingerprint !== env.CORE1004_SCHEMA_FINGERPRINT) throw new Error('REFUSED: schema fingerprint mismatch');
}

const stableId = (fixtureId, kind, index = '') => `uat-${fixtureId}-${kind}${index ? `-${index}` : ''}`.slice(0, 64);

async function assertFixtureOwnership(prisma, fixtureId, tenantId, ownerAId, ownerBId) {
  const ownerIds = [ownerAId, ownerBId];
  for (const ownerId of ownerIds) {
    const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
    if (owner && owner.tenantId !== tenantId) throw new Error('REFUSED: fixture owner identity belongs to another tenant');
  }
  for (let i = 1; i <= FLOW_KEYS.length; i++) {
    const buildingId = stableId(fixtureId, 'building', i);
    const floorId = stableId(fixtureId, 'floor', i);
    const roomId = stableId(fixtureId, 'room', i);
    const customerId = stableId(fixtureId, 'customer', i);
    const cycleId = stableId(fixtureId, 'cycle', i);
    const contractId = stableId(fixtureId, 'contract', i);
    const expectedOwnerId = i % 2 ? ownerAId : ownerBId;
    const [building, floor, room, customer, cycle, contract] = await Promise.all([
      prisma.building.findUnique({ where: { id: buildingId } }),
      prisma.floor.findUnique({ where: { id: floorId } }),
      prisma.room.findUnique({ where: { id: roomId } }),
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.rentalCycle.findUnique({ where: { id: cycleId } }),
      prisma.contract.findUnique({ where: { id: contractId } }),
    ]);
    if (building && (building.tenantId !== tenantId || building.ownerId !== expectedOwnerId)) throw new Error('REFUSED: fixture building ownership collision');
    if (floor && (floor.tenantId !== tenantId || floor.buildingId !== buildingId)) throw new Error('REFUSED: fixture floor ownership collision');
    if (room && (room.tenantId !== tenantId || room.buildingId !== buildingId || room.floorId !== floorId)) throw new Error('REFUSED: fixture room hierarchy collision');
    if (customer && customer.tenantId !== tenantId) throw new Error('REFUSED: fixture customer identity belongs to another tenant');
    if (customer && customer.roomId && customer.roomId !== roomId) throw new Error('REFUSED: fixture customer room collision');
    if (cycle && (cycle.tenantId !== tenantId || cycle.customerId !== customerId || cycle.roomId !== roomId)) throw new Error('REFUSED: fixture rental cycle relationship collision');
    if (contract && (contract.tenantId !== tenantId || contract.customerId !== customerId || contract.roomId !== roomId || contract.rentalCycleId !== cycleId)) throw new Error('REFUSED: fixture contract relationship collision');
  }
}

function validateProvisionResult(result, env = process.env) {
  if (!result || result.STATUS !== 'PASS') throw new Error('REFUSED: fixture provision did not report PASS');
  if (!result.RUN_ID) throw new Error('REFUSED: fixture output missing RUN_ID');
  if (result.FIXTURE_ID !== env.FIXTURE_ID) throw new Error('REFUSED: fixture identifier mismatch');
  for (const key of ['TENANT_ID', 'OWNER_A_ID', 'OWNER_B_ID', 'BUILDING_IDS', 'FLOOR_IDS', 'ROOM_IDS', 'CUSTOMER_IDS', 'CONTRACT_IDS', 'RENTAL_CYCLE_IDS']) {
    if (!result[key] || (Array.isArray(result[key]) && result[key].length !== FLOW_KEYS.length)) throw new Error(`REFUSED: fixture output missing ${key}`);
  }
  return result;
}

async function provision(prisma, env = process.env) {
  assertStaticGuards(env);
  const identity = await readIdentity(prisma);
  assertDatabaseGuards(identity, env); // Every guard completes before the first transaction/write.
  const fixtureId = env.FIXTURE_ID;
  const tenantId = stableId(fixtureId, 'tenant');
  const ownerAId = stableId(fixtureId, 'owner-a');
  const ownerBId = stableId(fixtureId, 'owner-b');
  const existingTenant = await prisma.tenantOrg.findUnique({ where: { id: tenantId } });
  if (existingTenant && existingTenant.code !== `UAT-${fixtureId}`.slice(0, 50)) throw new Error('REFUSED: fixture tenant identity collision');
  await assertFixtureOwnership(prisma, fixtureId, tenantId, ownerAId, ownerBId);
  const result = await prisma.$transaction(async (tx) => {
    await tx.tenantOrg.upsert({ where: { id: tenantId }, update: {}, create: { id: tenantId, code: `UAT-${fixtureId}`.slice(0, 50), name: `Synthetic UAT ${fixtureId}` } });
    await tx.owner.upsert({ where: { id: ownerAId }, update: {}, create: { id: ownerAId, tenantId, code: 'UAT-OWNER-A', name: 'Synthetic Owner A' } });
    await tx.owner.upsert({ where: { id: ownerBId }, update: {}, create: { id: ownerBId, tenantId, code: 'UAT-OWNER-B', name: 'Synthetic Owner B' } });
    const ids = { buildingIds: [], floorIds: [], roomIds: [], customerIds: [], contractIds: [], rentalCycleIds: [] };
    for (let i = 0; i < FLOW_KEYS.length; i++) {
      const n = i + 1, ownerId = n % 2 ? ownerAId : ownerBId;
      const buildingId = stableId(fixtureId, 'building', n), floorId = stableId(fixtureId, 'floor', n), roomId = stableId(fixtureId, 'room', n);
      const customerId = stableId(fixtureId, 'customer', n), cycleId = stableId(fixtureId, 'cycle', n), contractId = stableId(fixtureId, 'contract', n);
      await tx.building.upsert({ where: { id: buildingId }, update: {}, create: { id: buildingId, tenantId, ownerId, code: `UAT-B${n}`, name: `Synthetic Building ${n}` } });
      await tx.floor.upsert({ where: { id: floorId }, update: {}, create: { id: floorId, tenantId, buildingId, level: 1, name: 'UAT Floor' } });
      await tx.room.upsert({ where: { id: roomId }, update: {}, create: { id: roomId, tenantId, buildingId, floorId, code: `UAT-R${n}`, name: FLOW_KEYS[i], capacity: FLOW_KEYS[i] === 'shared-room-a-b' ? 2 : 1, bedCount: FLOW_KEYS[i] === 'shared-room-a-b' ? 2 : 1, rentalType: FLOW_KEYS[i] === 'shared-room-a-b' ? 'SHARED' : 'WHOLE', monthlyPrice: 1000000 } });
      await tx.customer.upsert({ where: { id: customerId }, update: {}, create: { id: customerId, tenantId, fullName: `Synthetic Customer ${n}`, phone: `000000${String(n).padStart(4, '0')}` } });
      await tx.rentalCycle.upsert({ where: { id: cycleId }, update: {}, create: { id: cycleId, tenantId, customerId, roomId, status: 'PLANNED', expectedMoveInAt: new Date('2030-01-01T00:00:00.000Z') } });
      await tx.contract.upsert({ where: { id: contractId }, update: {}, create: { id: contractId, tenantId, roomId, customerId, rentalCycleId: cycleId, code: `UAT-${fixtureId}-${n}`.slice(0, 64), startDate: new Date('2030-01-01T00:00:00.000Z'), endDate: new Date('2030-12-31T00:00:00.000Z'), monthlyRent: 1000000, depositMoney: n % 3 === 1 ? 500000 : n % 3 === 2 ? 1000000 : 1500000 } });
      ids.buildingIds.push(buildingId); ids.floorIds.push(floorId); ids.roomIds.push(roomId); ids.customerIds.push(customerId); ids.contractIds.push(contractId); ids.rentalCycleIds.push(cycleId);
    }
    return ids;
  });
  return validateProvisionResult({
    STATUS: 'PASS',
    RUN_ID: env.E2E_RUN_ID || `core1004-${Date.now()}`,
    FIXTURE_ID: fixtureId,
    TENANT_ID: tenantId,
    OWNER_A_ID: ownerAId,
    OWNER_B_ID: ownerBId,
    BUILDING_IDS: result.buildingIds,
    FLOOR_IDS: result.floorIds,
    ROOM_IDS: result.roomIds,
    CUSTOMER_IDS: result.customerIds,
    CONTRACT_IDS: result.contractIds,
    RENTAL_CYCLE_IDS: result.rentalCycleIds,
  }, env);
}

async function main() {
  const prisma = new PrismaClient();
  try { console.log(JSON.stringify(await provision(prisma))); }
  finally { await prisma.$disconnect(); }
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });
module.exports = { assertStaticGuards, assertDatabaseGuards, readIdentity, provision, stableId, validateProvisionResult, assertFixtureOwnership };
