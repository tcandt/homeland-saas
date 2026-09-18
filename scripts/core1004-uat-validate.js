const fs = require('fs');
const { validateProvisionResult, stableId } = require('./core1004-uat-provision');

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/core1004-uat-validate.js <result.json>');
let result;
try { result = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('REFUSED: malformed fixture provision output'); }
validateProvisionResult(result, process.env);
const expected = {
  TENANT_ID: stableId(process.env.FIXTURE_ID, 'tenant'),
  OWNER_A_ID: stableId(process.env.FIXTURE_ID, 'owner-a'),
  OWNER_B_ID: stableId(process.env.FIXTURE_ID, 'owner-b'),
};
for (const [key, value] of Object.entries(expected)) if (result[key] !== value) throw new Error(`REFUSED: fixture output ${key} mismatch`);
process.stdout.write(JSON.stringify({ STATUS: 'PASS', FIXTURE_ID: result.FIXTURE_ID, RUN_ID: result.RUN_ID }));
