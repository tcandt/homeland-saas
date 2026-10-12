const fs = require('node:fs');
const path = require('node:path');

function expectedMigrationCount(root = path.resolve(__dirname, '../packages/database/prisma/migrations')) {
  const count = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'migration.sql'))).length;
  if (count < 1) throw new Error('BLOCKED: release migration inventory is empty');
  return count;
}

function unwrapApiPayload(body, label) {
  if (body && Object.prototype.hasOwnProperty.call(body, 'success')) {
    if (body.success !== true || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      throw new Error(`BLOCKED: ${label} returned an invalid API envelope`);
    }
    return body.data;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(`BLOCKED: ${label} returned an invalid API payload`);
  }
  return body;
}

function assertStagingDiagnostics(body, env = process.env) {
  const expectedSha = env.E2E_EXPECTED_BUILD_SHA;
  const expectedFingerprint = env.CORE1004_SCHEMA_FINGERPRINT;
  if (!/^[a-f0-9]{40}$/.test(expectedSha || '')) throw new Error('BLOCKED: expected immutable Git SHA is required');
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint || '')) throw new Error('BLOCKED: approved schema fingerprint is required');
  if (!env.E2E_TARGET_DB_ID) throw new Error('BLOCKED: target database identity is required');
  const diagnostics = unwrapApiPayload(body, 'staging diagnostics');
  if (diagnostics.environment !== 'staging') throw new Error('BLOCKED: diagnostic environment must be staging');
  if (diagnostics.databaseId !== env.E2E_TARGET_DB_ID) throw new Error('BLOCKED: database identity mismatch');
  if (diagnostics.buildCommit !== expectedSha) throw new Error('BLOCKED: diagnostic build SHA mismatch');
  if (diagnostics.schemaFingerprint !== expectedFingerprint) throw new Error('BLOCKED: schema fingerprint mismatch');
  if (diagnostics.migrationCount !== expectedMigrationCount()) throw new Error('BLOCKED: release migration count mismatch');
  return diagnostics;
}

if (require.main === module) {
  try {
    assertStagingDiagnostics(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    console.log('PASS: staging database/build/schema identity matches approved release');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { assertStagingDiagnostics, expectedMigrationCount, unwrapApiPayload };
