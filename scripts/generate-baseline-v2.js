// Maintainer-only generator. Bootstrap never regenerates this artifact.
// It turns the current Prisma schema plus the two immutable custom-DDL sources
// into one reviewable static BASELINE-V2 SQL file.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const schema = path.join(root, 'packages/database/prisma/schema.prisma');
const baselineRoot = path.join(root, 'packages/database/prisma/baseline-v2');
const output = path.join(baselineRoot, 'baseline-v2.sql');
const checks = path.join(root, 'packages/database/prisma/baseline/custom-checks.sql');
const migrationsRoot = path.join(root, 'packages/database/prisma/migrations');

function migrationSql(name) {
  return fs.readFileSync(path.join(migrationsRoot, name, 'migration.sql'), 'utf8');
}

function extractCustomFunctionsAndTriggers(name) {
  const source = migrationSql(name);
  const functions = source.match(/CREATE (?:OR REPLACE )?FUNCTION "[^"]+"\(\)\s*RETURNS TRIGGER[\s\S]*?\$\$(?:\s+LANGUAGE\s+plpgsql)?;/gi) || [];
  const triggers = source.match(/CREATE TRIGGER "[^"]+"[\s\S]*?;/gi) || [];
  if (!functions.length || !triggers.length) throw new Error(`Cannot extract custom DDL from ${name}.`);
  return [...functions, ...triggers].join('\n\n');
}

function extractPaymentProviderReferenceIndex() {
  const source = migrationSql('20260823060000_harden_payment_webhook_processing');
  const match = source.match(/CREATE UNIQUE INDEX IF NOT EXISTS "Payment_tenantId_provider_providerRef_nonempty_key"[\s\S]*?;/i);
  if (!match) throw new Error('Cannot extract Payment provider-reference partial unique index.');
  return match[0];
}

if (!fs.existsSync(baselineRoot)) fs.mkdirSync(baselineRoot, { recursive: true });
if (fs.existsSync(output)) throw new Error(`Refusing to overwrite ${output}. Remove it only through reviewed BASELINE-V2 regeneration.`);

const generated = path.join(baselineRoot, '.generated-prisma.sql');
if (fs.existsSync(generated)) throw new Error(`Refusing to overwrite ${generated}.`);
try {
  execFileSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schema, '--script', '--output', generated], { cwd: root, stdio: 'inherit' });
  const sql = [
    '-- BASELINE-V2: static canonical schema after historical migrations 1..18.',
    '-- Generated only by scripts/generate-baseline-v2.js; bootstrap never derives SQL dynamically.',
    fs.readFileSync(generated, 'utf8').trim(),
    '-- Custom checks omitted by Prisma schema representation.',
    fs.readFileSync(checks, 'utf8').trim(),
    '-- Partial unique index omitted by Prisma schema representation.',
    extractPaymentProviderReferenceIndex(),
    '-- Custom functions and triggers preserved from immutable migration 17.',
    extractCustomFunctionsAndTriggers('20260908190000_add_room_hold_and_deposit_ledger'),
    '-- Custom functions and triggers preserved from immutable migration 18.',
    extractCustomFunctionsAndTriggers('20260909153000_add_billing_snapshot'),
    '',
  ].join('\n\n');
  fs.writeFileSync(output, sql, { flag: 'wx' });
} finally {
  if (fs.existsSync(generated)) fs.unlinkSync(generated);
}
