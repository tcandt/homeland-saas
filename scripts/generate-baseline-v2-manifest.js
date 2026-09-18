// Maintainer-only capture tool. Run only against an isolated database that has
// just applied enable-pgvector.sql + baseline-v2.sql. Bootstrap only reads this.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { fingerprint, readCanonicalInventory } = require('./baseline-v2-inventory');

const root = path.resolve(__dirname, '..');
const baselineRoot = path.join(root, 'packages/database/prisma/baseline-v2');
const historicalPath = path.join(root, 'packages/database/prisma/baseline/migration-manifest.json');
const baselineSql = path.join(baselineRoot, 'baseline-v2.sql');
const preludeSql = path.join(root, 'packages/database/prisma/baseline/enable-pgvector.sql');
const output = path.join(baselineRoot, 'baseline-v2.manifest.json');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function main() {
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite ${output}.`);
  const historical = JSON.parse(fs.readFileSync(historicalPath, 'utf8'));
  if (historical.migrations?.length !== 18) throw new Error('Historical manifest must cover exactly 18 migrations.');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const inventory = await readCanonicalInventory(prisma);
    if (!inventory.extensions.includes('vector')) throw new Error('Cannot capture BASELINE-V2 without pgvector.');
    fs.writeFileSync(output, `${JSON.stringify({
      version: 'BASELINE-V2',
      sourceCoverage: { historicalMigrationCount: 18, historicalManifest: 'packages/database/prisma/baseline/migration-manifest.json' },
      artifacts: {
        baselineSql: { path: 'packages/database/prisma/baseline-v2/baseline-v2.sql', sha256: sha256(baselineSql) },
        preludeSql: { path: 'packages/database/prisma/baseline/enable-pgvector.sql', sha256: sha256(preludeSql), ownerMigration: '20260706150701_auth_foundation' },
      },
      canonicalFingerprint: fingerprint(inventory),
      inventory,
    }, null, 2)}\n`, { flag: 'wx' });
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
