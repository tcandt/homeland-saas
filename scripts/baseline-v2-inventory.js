const crypto = require('node:crypto');

const NORMALIZE_WHITESPACE = /\s+/g;
const normalize = (value) => String(value ?? '').replace(NORMALIZE_WHITESPACE, ' ').trim();

async function rows(prisma, sql) {
  return prisma.$queryRawUnsafe(sql);
}

async function readCanonicalInventory(prisma) {
  const [extensions, tables, columns, enums, constraints, indexes, functions, triggers] = await Promise.all([
    rows(prisma, `SELECT extname AS name FROM pg_extension WHERE extname = 'vector' ORDER BY extname`),
    rows(prisma, `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name`),
    rows(prisma, `SELECT table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default, is_identity, identity_generation FROM information_schema.columns WHERE table_schema = 'public' AND table_name <> '_prisma_migrations' ORDER BY table_name, ordinal_position`),
    rows(prisma, `SELECT t.typname AS type_name, e.enumlabel AS enum_label, e.enumsortorder::text AS sort_order FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace JOIN pg_enum e ON e.enumtypid = t.oid WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder`),
    rows(prisma, `SELECT c.conname AS name, c.contype AS type, pg_get_constraintdef(c.oid, true) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace LEFT JOIN pg_class r ON r.oid = c.conrelid WHERE n.nspname = 'public' AND COALESCE(r.relname, '') <> '_prisma_migrations' ORDER BY c.conname`),
    rows(prisma, `SELECT i.relname AS name, pg_get_indexdef(i.oid, 0, true) AS definition FROM pg_class i JOIN pg_namespace n ON n.oid = i.relnamespace WHERE n.nspname = 'public' AND i.relkind = 'i' AND i.relname NOT LIKE '_prisma_migrations%' ORDER BY i.relname`),
    rows(prisma, `SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') ORDER BY p.proname, p.oid`),
    rows(prisma, `SELECT t.tgname AS name, pg_get_triggerdef(t.oid, true) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY t.tgname`),
  ]);
  return {
    extensions: extensions.map((row) => row.name),
    tables: tables.map((row) => row.name),
    columns: columns.map((row) => ({ ...row, column_default: normalize(row.column_default) })),
    enums: enums.map((row) => ({ ...row })),
    constraints: constraints.map((row) => ({ ...row, definition: normalize(row.definition) })),
    indexes: indexes.map((row) => ({ ...row, definition: normalize(row.definition) })),
    functions: functions.map((row) => ({ ...row, definition: normalize(row.definition) })),
    triggers: triggers.map((row) => ({ ...row, definition: normalize(row.definition) })),
  };
}

function fingerprint(inventory) {
  return crypto.createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
}

module.exports = { fingerprint, readCanonicalInventory };
