const assert = require('node:assert/strict');
const test = require('node:test');
const { makePlan, restoreSQL } = require('./restore-buildings.cjs');

function sourceFixture() {
  const codes = ['LK01.31', 'LK01.32', 'LK08.24', 'LK08.25'];
  const Building = codes.map((code, index) => ({
    id: `building-${index + 1}`, tenantId: 'tenant-a', code, name: code,
    deletedAt: null, createdAt: `2026-01-0${index + 1}T00:00:00.000Z`,
  }));
  const Floor = Building.flatMap((building, buildingIndex) => Array.from({ length: 4 }, (_, floorIndex) => ({
    id: `floor-${buildingIndex + 1}-${floorIndex + 1}`, tenantId: 'tenant-a',
    buildingId: building.id, name: `T${floorIndex + 1}`, deletedAt: null,
  })));
  const roomCounts = [9, 9, 8, 8];
  const statuses = ['OCCUPIED', 'RESERVED', 'MAINTENANCE', 'AVAILABLE'];
  const Room = Building.flatMap((building, buildingIndex) => Array.from({ length: roomCounts[buildingIndex] }, (_, roomIndex) => ({
    id: `room-${buildingIndex + 1}-${roomIndex + 1}`, tenantId: 'tenant-a',
    buildingId: building.id, floorId: Floor.find(floor => floor.buildingId === building.id && floor.id.endsWith(`-${roomIndex % 4 + 1}`)).id,
    code: `${building.code}-P${roomIndex + 1}`, status: statuses[roomIndex % statuses.length], deletedAt: null,
  })));
  const HunonicMeterMapping = [
    ...Room.map((room, index) => ({
      id: `mapping-room-${index + 1}`, tenantId: 'tenant-a', providerMeterId: `provider-room-${index + 1}`,
      buildingId: room.buildingId, roomId: room.id, lastStatus: 'ONLINE', raw: { source: 'fixture' },
    })),
    ...Building.slice(2, 4).map((building, index) => ({
      id: `mapping-building-${index + 1}`, tenantId: 'tenant-a', providerMeterId: `provider-building-${index + 1}`,
      buildingId: building.id, roomId: null, roomCode: index === 0 ? 'PN 08-24' : 'PN 08-25', lastStatus: 'ONLINE', raw: { source: 'fixture' },
    })),
    { id: 'mapping-common', tenantId: 'tenant-a', providerMeterId: 'provider-common', buildingId: null, roomId: null, lastStatus: 'ONLINE', raw: { source: 'fixture' } },
  ];
  return { Building, Floor, Room, HunonicMeterMapping };
}

test('makePlan validates the canonical 4/16/34 inventory without mutating source meter records', () => {
  const source = sourceFixture();
  const original = structuredClone(source);
  const plan = makePlan(source);

  assert.deepEqual(plan.Building.map(row => row.code).sort(), ['LK01.31', 'LK01.32', 'LK08.24', 'LK08.25']);
  assert.equal(plan.Building.length, 4);
  assert.equal(plan.Floor.length, 16);
  assert.equal(plan.Room.length, 34);
  assert.deepEqual(source.HunonicMeterMapping
    .filter(mapping => mapping.roomId === null && mapping.buildingId !== null)
    .map(mapping => mapping.roomCode).sort(), ['PN 08-24', 'PN 08-25']);
  assert.deepEqual(source, original, 'planning must not mutate source inventory or meter history/settings');
});

test('makePlan resets only occupied and reserved rooms, preserving maintenance and available', () => {
  const source = sourceFixture();
  const plan = makePlan(source);
  const statusById = new Map(plan.Room.map(room => [room.id, room.status]));
  for (const room of source.Room) {
    const expected = ['OCCUPIED', 'RESERVED'].includes(room.status) ? 'AVAILABLE' : room.status;
    assert.equal(statusById.get(room.id), expected, room.id);
  }
  assert.ok(plan.Room.some(room => room.status === 'MAINTENANCE'));
});

test('makePlan rejects cross-tenant floors and rooms with invalid floor ownership', () => {
  const crossTenant = sourceFixture();
  crossTenant.Floor[0].tenantId = 'tenant-b';
  assert.throws(() => makePlan(crossTenant), assert.AssertionError);

  const badFloor = sourceFixture();
  badFloor.Room[0].floorId = badFloor.Floor.find(floor => floor.buildingId !== badFloor.Room[0].buildingId).id;
  assert.throws(() => makePlan(badFloor), assert.AssertionError);
});

test('restore SQL is transactional, refuses nonempty inventory, and preserves protected data', () => {
  const sql = restoreSQL(makePlan(sourceFixture()));
  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /LOCK TABLE "Building", "Floor", "Room", "HunonicMeterMapping" IN ACCESS EXCLUSIVE MODE;/);
  assert.match(sql, /Refuse nonempty target inventory/);
  assert.match(sql, /Refuse existing meter bindings/);
  assert.match(sql, /protected_before/);
  assert.match(sql, /Protected data changed/);
  assert.match(sql, /mappings_before/);
  assert.match(sql, /Meter settings\/history changed/);
  assert.match(sql, /Meter binding mismatch/);
  assert.match(sql, /Inventory count mismatch/);
  assert.match(sql, /Room meter binding count mismatch/);
  assert.match(sql, /COMMIT;/);
});

test('restore SQL uses JSON recordsets and exact post-restore equality for inventory', () => {
  const sql = restoreSQL(makePlan(sourceFixture()));
  for (const table of ['Building', 'Floor', 'Room']) {
    assert.match(sql, new RegExp(`INSERT INTO "${table}" SELECT \\* FROM jsonb_populate_recordset\\(NULL::"${table}"`));
    assert.match(sql, new RegExp(`Restored ${table} differs`));
  }
  assert.match(sql, /CREATE TEMP TABLE expected_links/);
  assert.match(sql, /"tenantId" text, "providerMeterId" text, "buildingId" text, "roomId" text/);
});

test('restore SQL defers exactly the two protected building-only mappings and updates only unused distinct links', () => {
  const sql = restoreSQL(makePlan(sourceFixture()));
  assert.match(sql, /CREATE TEMP TABLE deferred_links/);
  assert.match(sql, /EXISTS \(SELECT 1 FROM "HunonicMeterReading" r WHERE r\."meterMappingId"=m\.id\)/);
  assert.match(sql, /EXISTS \(SELECT 1 FROM "BillingSnapshot" b WHERE b\."meterMappingId"=m\.id\)/);
  assert.match(sql, /count\(\*\) FROM deferred_links\) <> 2/);
  assert.match(sql, /deferred_links WHERE "roomId" IS NOT NULL OR "buildingId" IS NULL/);
  assert.match(sql, /UPDATE expected_links e SET "buildingId"=m\."buildingId", "roomId"=m\."roomId"/);
  assert.match(sql, /e\.id=d\.id/);
  assert.match(sql, /AND \(m\."buildingId" IS DISTINCT FROM e\."buildingId" OR m\."roomId" IS DISTINCT FROM e\."roomId"\)/);
  assert.match(sql, /count\(\*\) FROM "HunonicMeterMapping" WHERE "roomId" IS NOT NULL\) <> 34/);
});

test('restore SQL preserves the 21-reading/zero-snapshot checkpoint without delete or disable commands', () => {
  const sql = restoreSQL(makePlan(sourceFixture()));
  assert.match(sql, /count\(\*\) FROM "HunonicMeterReading"\) <> 21/);
  assert.match(sql, /count\(\*\) FROM "BillingSnapshot"\) <> 0/);
  assert.match(sql, /Meter history checkpoint changed/);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+"HunonicMeterReading"|DELETE\s+FROM\s+"BillingSnapshot"/i);
  assert.doesNotMatch(sql, /UPDATE\s+"HunonicMeterReading"[\s\S]*?"enabled"\s*=\s*false|UPDATE\s+"BillingSnapshot"[\s\S]*?"enabled"\s*=\s*false/i);
});
