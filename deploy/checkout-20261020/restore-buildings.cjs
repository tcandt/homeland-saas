const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const ROOT = '/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457';
const OLD = 'homeland_release_320_postgres';
const NEW = 'homeland_checkout_87aa2457_postgres';
const quote = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
function makePlan(source) {
  assert.deepEqual(source.Building.map(x => x.code).sort(), ['LK01.31', 'LK01.32', 'LK08.24', 'LK08.25']);
  assert.equal(source.Building.length, 4);
  assert.equal(source.Floor.length, 16);
  assert.equal(source.Room.length, 34);
  const buildings = new Map(source.Building.map(x => [x.id, x]));
  assert.ok(source.Building.every(x => x.tenantId && !x.deletedAt));
  const floors = new Map(source.Floor.map(x => [x.id, x]));
  for (const floor of source.Floor) {
    const building = buildings.get(floor.buildingId);
    assert.ok(building && floor.tenantId === building.tenantId && !floor.deletedAt);
  }
  for (const room of source.Room) {
    const building = buildings.get(room.buildingId), floor = floors.get(room.floorId);
    assert.ok(building && floor && floor.buildingId === building.id);
    assert.ok(room.tenantId === building.tenantId && room.tenantId === floor.tenantId && !room.deletedAt);
  }
  const rooms = new Map(source.Room.map(x => [x.id, x]));
  assert.equal(source.HunonicMeterMapping.length, 37);
  const buildingOnly = source.HunonicMeterMapping.filter(x => x.roomId === null && x.buildingId !== null);
  assert.deepEqual(buildingOnly.map(x => x.roomCode).sort(), ['PN 08-24', 'PN 08-25']);
  const links = source.HunonicMeterMapping.map(x => {
    const building = x.buildingId === null ? null : buildings.get(x.buildingId);
    if (x.buildingId !== null) assert.ok(building && building.tenantId === x.tenantId);
    if (x.roomId !== null) {
      const room = rooms.get(x.roomId);
      assert.ok(room && x.buildingId === room.buildingId && x.tenantId === room.tenantId);
    }
    return { id: x.id, tenantId: x.tenantId, providerMeterId: x.providerMeterId, buildingId: x.buildingId, roomId: x.roomId };
  });
  return {
    Building: source.Building,
    Floor: source.Floor,
    Room: source.Room.map(x => ({ ...x, status: ['OCCUPIED', 'RESERVED'].includes(x.status) ? 'AVAILABLE' : x.status })),
    links,
  };
}
function restoreSQL(plan) {
  const inserts = ['Building', 'Floor', 'Room'].map(table => `INSERT INTO "${table}" SELECT * FROM jsonb_populate_recordset(NULL::"${table}", ${quote(plan[table])});`).join('\n');
  const checks = ['Building', 'Floor', 'Room'].map(table => `IF EXISTS ((SELECT to_jsonb(t) FROM "${table}" t EXCEPT ALL SELECT value FROM jsonb_array_elements(${quote(plan[table])})) UNION ALL (SELECT value FROM jsonb_array_elements(${quote(plan[table])}) EXCEPT ALL SELECT to_jsonb(t) FROM "${table}" t)) THEN RAISE EXCEPTION 'Restored ${table} differs'; END IF;`).join('\n');
  return `BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SET LOCAL standard_conforming_strings = on;
LOCK TABLE "Building", "Floor", "Room", "HunonicMeterMapping" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF (SELECT count(*) FROM "Building") <> 0 OR (SELECT count(*) FROM "Floor") <> 0 OR (SELECT count(*) FROM "Room") <> 0 THEN
    RAISE EXCEPTION 'Refuse nonempty target inventory';
  END IF;
  IF EXISTS (SELECT 1 FROM "HunonicMeterMapping" WHERE "roomId" IS NOT NULL OR "buildingId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Refuse existing meter bindings';
  END IF;
END $$;
CREATE TEMP TABLE protected_before(name text PRIMARY KEY, digest text) ON COMMIT DROP;
DO $$ DECLARE t text; h text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('Building','Floor','Room','HunonicMeterMapping') LOOP
    EXECUTE format('SELECT md5(COALESCE(string_agg(to_jsonb(t)::text, E''\\n'' ORDER BY to_jsonb(t)::text), '''')) FROM %I t', t) INTO h;
    INSERT INTO protected_before VALUES (t,h);
  END LOOP;
END $$;
CREATE TEMP TABLE mappings_before ON COMMIT DROP AS SELECT to_jsonb(m) - 'buildingId' - 'roomId' AS data FROM "HunonicMeterMapping" m;
${inserts}
CREATE TEMP TABLE expected_links ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset(${quote(plan.links)}) AS x(id text, "tenantId" text, "providerMeterId" text, "buildingId" text, "roomId" text);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM expected_links e LEFT JOIN "HunonicMeterMapping" m ON m.id=e.id AND m."tenantId"=e."tenantId" AND m."providerMeterId"=e."providerMeterId" WHERE m.id IS NULL) THEN
    RAISE EXCEPTION 'Meter identity mismatch';
  END IF;
  IF (SELECT count(*) FROM "HunonicMeterMapping") <> (SELECT count(*) FROM expected_links) THEN RAISE EXCEPTION 'Meter inventory mismatch'; END IF;
END $$;
CREATE TEMP TABLE deferred_links ON COMMIT DROP AS SELECT e.* FROM expected_links e JOIN "HunonicMeterMapping" m ON m.id=e.id
  WHERE (m."buildingId" IS DISTINCT FROM e."buildingId" OR m."roomId" IS DISTINCT FROM e."roomId")
    AND (EXISTS (SELECT 1 FROM "HunonicMeterReading" r WHERE r."meterMappingId"=m.id) OR EXISTS (SELECT 1 FROM "BillingSnapshot" b WHERE b."meterMappingId"=m.id));
DO $$ BEGIN
  IF (SELECT count(*) FROM deferred_links) <> 2 OR EXISTS (SELECT 1 FROM deferred_links WHERE "roomId" IS NOT NULL OR "buildingId" IS NULL) THEN
    RAISE EXCEPTION 'Unexpected protected meter bindings';
  END IF;
  IF (SELECT count(*) FROM "HunonicMeterReading") <> 21 OR (SELECT count(*) FROM "BillingSnapshot") <> 0 THEN RAISE EXCEPTION 'Meter history checkpoint changed'; END IF;
END $$;
UPDATE expected_links e SET "buildingId"=m."buildingId", "roomId"=m."roomId" FROM "HunonicMeterMapping" m, deferred_links d WHERE e.id=m.id AND e.id=d.id;
UPDATE "HunonicMeterMapping" m SET "buildingId"=e."buildingId", "roomId"=e."roomId" FROM expected_links e WHERE m.id=e.id AND m."tenantId"=e."tenantId" AND m."providerMeterId"=e."providerMeterId" AND (m."buildingId" IS DISTINCT FROM e."buildingId" OR m."roomId" IS DISTINCT FROM e."roomId");
DO $$ DECLARE row record; h text; BEGIN
  ${checks}
  IF EXISTS (SELECT 1 FROM expected_links e JOIN "HunonicMeterMapping" m ON m.id=e.id WHERE m."buildingId" IS DISTINCT FROM e."buildingId" OR m."roomId" IS DISTINCT FROM e."roomId") THEN RAISE EXCEPTION 'Meter binding mismatch'; END IF;
  FOR row IN SELECT * FROM protected_before LOOP
    EXECUTE format('SELECT md5(COALESCE(string_agg(to_jsonb(t)::text, E''\\n'' ORDER BY to_jsonb(t)::text), '''')) FROM %I t', row.name) INTO h;
    IF h IS DISTINCT FROM row.digest THEN RAISE EXCEPTION 'Protected data changed: %', row.name; END IF;
  END LOOP;
  IF EXISTS ((SELECT data FROM mappings_before EXCEPT ALL SELECT to_jsonb(m)-'buildingId'-'roomId' FROM "HunonicMeterMapping" m)
    UNION ALL (SELECT to_jsonb(m)-'buildingId'-'roomId' FROM "HunonicMeterMapping" m EXCEPT ALL SELECT data FROM mappings_before)) THEN
    RAISE EXCEPTION 'Meter settings/history changed';
  END IF;
  IF (SELECT count(*) FROM "Building") <> 4 OR (SELECT count(*) FROM "Floor") <> 16 OR (SELECT count(*) FROM "Room") <> 34 THEN
    RAISE EXCEPTION 'Inventory count mismatch';
  END IF;
  IF (SELECT count(*) FROM "HunonicMeterMapping" WHERE "roomId" IS NOT NULL) <> 34 THEN RAISE EXCEPTION 'Room meter binding count mismatch'; END IF;
END $$;
COMMIT;
SELECT json_build_object('status','PASS','buildings',(SELECT count(*) FROM "Building"),'floors',(SELECT count(*) FROM "Floor"),'rooms',(SELECT count(*) FROM "Room"),'linkedMeters',(SELECT count(*) FROM "HunonicMeterMapping" WHERE "roomId" IS NOT NULL),'deferredBuildingBindings',2,'preservedReadings',(SELECT count(*) FROM "HunonicMeterReading"),'customers',(SELECT count(*) FROM "Customer"),'contracts',(SELECT count(*) FROM "Contract"));
`;
}
function main() {
  assert.equal(process.argv[2], '--apply');
  assert.equal(fs.statSync(ROOT).mode & 0o777, 0o700);
  const docker = args => cp.execFileSync('/usr/local/bin/docker', args, { encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  const query = (pg, sql) => cp.execFileSync('/usr/local/bin/docker', ['exec', '-i', pg, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'homeland_staging', '-d', 'homeland_staging'], { input: sql, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  const sourceSQL = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT json_build_object(${['Building', 'Floor', 'Room', 'HunonicMeterMapping'].map(t => `'${t}',(SELECT COALESCE(json_agg(to_jsonb(t)), '[]'::json) FROM "${t}" t)`).join(',')}); COMMIT;`;
  const source = JSON.parse(query(OLD, sourceSQL).trim());
  const plan = makePlan(source);
  const prefix = path.join(ROOT, 'inventory-restore-20261021');
  const started = `${prefix}.started`;
  fs.writeFileSync(started, new Date().toISOString(), { flag: 'wx', mode: 0o600 });
  let stopped = false;
  try {
    stopped = true;
    docker(['stop', 'homeland_checkout_87aa2457_worker', 'homeland_checkout_87aa2457_api']);
    const backup = fs.openSync(`${prefix}.private.dump`, 'wx', 0o600);
    try {
      cp.execFileSync('/usr/local/bin/docker', ['exec', NEW, 'pg_dump', '-U', 'homeland_staging', '-d', 'homeland_staging', '-Fc'], { stdio: ['ignore', backup, 'pipe'], timeout: 120000 });
    } finally { fs.closeSync(backup); }
    fs.writeFileSync(`${prefix}.private.json`, JSON.stringify(plan), { flag: 'wx', mode: 0o600 });
    const result = query(NEW, restoreSQL(plan));
    fs.writeFileSync(`${prefix}.result.json`, result, { flag: 'wx', mode: 0o600 });
    console.log(result);
  } finally {
    if (stopped) docker(['start', 'homeland_checkout_87aa2457_api', 'homeland_checkout_87aa2457_worker']);
  }
}
module.exports = { makePlan, restoreSQL };
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
