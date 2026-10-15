const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const prefix = 'finrec-20261015';
const id = (name) => `${prefix}-${name}`;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function seed(prisma) {
  const tenantId = id('tenant');
  const ownerId = id('owner');
  const buildingId = id('building');
  const floorId = id('floor');
  const roomId = id('room');
  const customerId = id('customer');
  const cycleId = id('cycle');
  const contractId = id('contract');
  const depositId = id('deposit');
  const operationId = id('deposit-operation');
  const ledgerId = id('deposit-ledger');
  const invoiceId = id('invoice');
  const itemId = id('invoice-item');
  const paymentId = id('payment');
  const allocationId = id('payment-allocation');
  await prisma.tenantOrg.upsert({ where: { id: tenantId }, update: {}, create: { id: tenantId, code: 'FINREC-20261015', name: 'Financial recovery synthetic tenant' } });
  await prisma.owner.upsert({ where: { id: ownerId }, update: {}, create: { id: ownerId, tenantId, code: 'FINREC-OWNER', name: 'Financial recovery owner' } });
  await prisma.building.upsert({ where: { id: buildingId }, update: {}, create: { id: buildingId, tenantId, ownerId, code: 'FINREC-BUILDING', name: 'Financial recovery building' } });
  await prisma.floor.upsert({ where: { id: floorId }, update: {}, create: { id: floorId, tenantId, buildingId, level: 1, name: 'Financial recovery floor' } });
  await prisma.room.upsert({ where: { id: roomId }, update: {}, create: { id: roomId, tenantId, buildingId, floorId, code: 'FINREC-ROOM', name: 'Financial recovery room', capacity: 1, bedCount: 1, monthlyPrice: 3000000, rentalType: 'WHOLE' } });
  await prisma.customer.upsert({ where: { id: customerId }, update: {}, create: { id: customerId, tenantId, fullName: 'Financial recovery customer', phone: '000001015', phoneNormalized: '000001015', roomId } });
  await prisma.rentalCycle.upsert({ where: { id: cycleId }, update: {}, create: { id: cycleId, tenantId, customerId, roomId, status: 'ACTIVE', actualMoveInAt: new Date('2026-10-01T00:00:00.000Z') } });
  await prisma.contract.upsert({ where: { id: contractId }, update: { attachments: ['attachments/finrec-20261015.bin'] }, create: { id: contractId, tenantId, roomId, customerId, rentalCycleId: cycleId, code: 'FINREC-20261015-CONTRACT', status: 'ACTIVE', startDate: new Date('2026-10-01T00:00:00.000Z'), endDate: new Date('2027-09-30T00:00:00.000Z'), monthlyRent: 3000000, depositMoney: 2000000, attachments: ['attachments/finrec-20261015.bin'] } });
  await prisma.deposit.upsert({ where: { id: depositId }, update: {}, create: { id: depositId, tenantId, code: 'FINREC-20261015-DEP', type: 'SECURITY', roomId, customerId, contractId, rentalCycleId: cycleId, amount: 2000000, status: 'PAID', note: 'Synthetic financial recovery fixture' } });
  await prisma.depositOperation.upsert({ where: { id: operationId }, update: {}, create: { id: operationId, tenantId, rentalCycleId: cycleId, sourceDepositId: depositId, contractId, type: 'COLLECT', status: 'COMPLETED', idempotencyKey: 'finrec-20261015-collect', requestHash: sha256('finrec-20261015-collect'), result: { fixture: true }, completedAt: new Date('2026-10-01T00:00:00.000Z') } });
  await prisma.depositLedgerEntry.upsert({ where: { id: ledgerId }, update: {}, create: { id: ledgerId, tenantId, rentalCycleId: cycleId, depositId, contractId, operationId, type: 'CASH_IN', amount: 2000000, balanceEffect: 2000000, idempotencyKey: 'finrec-20261015-ledger', sourceType: 'SYNTHETIC_FIXTURE', sourceId: depositId, metadata: { fixture: 'finrec-20261015' } } });
  await prisma.invoice.upsert({ where: { id: invoiceId }, update: {}, create: { id: invoiceId, tenantId, contractId, rentalCycleId: cycleId, customerId, code: 'FINREC-20261015-INV', period: '2026-10', status: 'PARTIALLY_PAID', dueDate: new Date('2026-10-10T00:00:00.000Z'), subtotal: 3000000, discount: 0, total: 3000000, paidAmount: 1250000 } });
  await prisma.invoiceItem.upsert({ where: { id: itemId }, update: {}, create: { id: itemId, tenantId, invoiceId, type: 'RENT', description: 'Synthetic October rent', quantity: 1, unitPrice: 3000000, amount: 3000000, servicePeriod: '2026-10' } });
  await prisma.payment.upsert({ where: { id: paymentId }, update: {}, create: { id: paymentId, tenantId, invoiceId, rentalCycleId: cycleId, amount: 1250000, provider: 'MANUAL', providerRef: 'FINREC-20261015-PAY', status: 'CONFIRMED', paidAt: new Date('2026-10-05T00:00:00.000Z') } });
  await prisma.paymentAllocation.upsert({ where: { id: allocationId }, update: {}, create: { id: allocationId, tenantId, paymentId, invoiceId, amount: 1250000 } });
  await prisma.$executeRawUnsafe('CREATE SEQUENCE IF NOT EXISTS public.finrec_recovery_seq START WITH 101 INCREMENT BY 7');
  await prisma.$queryRawUnsafe("SELECT nextval('public.finrec_recovery_seq')");
  await prisma.$queryRawUnsafe("SELECT nextval('public.finrec_recovery_seq')");
  return { tenantId, depositId, invoiceId, paymentId, ledgerId, attachment: 'attachments/finrec-20261015.bin' };
}

async function audit(prisma) {
  const tables = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const records = [];
  for (const { tablename } of tables) {
    const table = `"${tablename.replaceAll('"', '""')}"`;
    const rows = await prisma.$queryRawUnsafe(`SELECT row_to_json(t)::text AS row FROM public.${table} t`);
    const hashes = rows.map((row) => sha256(row.row)).sort();
    records.push({ table: tablename, count: rows.length, digest: sha256(hashes.join('')) });
  }
  const columns = await prisma.$queryRawUnsafe("SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,coalesce(column_default,'') AS column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position");
  const constraints = await prisma.$queryRawUnsafe("SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname");
  const indexes = await prisma.$queryRawUnsafe("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
  const functions = await prisma.$queryRawUnsafe("SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)");
  const triggers = await prisma.$queryRawUnsafe("SELECT event_object_table AS table_name,trigger_name,event_manipulation,action_statement FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table,trigger_name,event_manipulation");
  const enums = await prisma.$queryRawUnsafe("SELECT n.nspname AS schema_name,t.typname,e.enumsortorder,e.enumlabel FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder");
  const extensions = await prisma.$queryRawUnsafe("SELECT e.extname,e.extversion,n.nspname AS schema_name FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY e.extname");
  const sequences = await prisma.$queryRawUnsafe("SELECT schemaname,sequencename,sequenceowner,data_type::text,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename");
  const sequenceStates = [];
  for (const sequence of sequences) {
    const quoted = `"${sequence.sequencename.replaceAll('"', '""')}"`;
    const [state] = await prisma.$queryRawUnsafe(`SELECT last_value::text,is_called FROM public.${quoted}`);
    sequenceStates.push({ name: sequence.sequencename, ...state });
  }
  const schemaSha256 = sha256(JSON.stringify({ columns, constraints, indexes, functions, triggers, enums, extensions, sequences }));
  const sequenceStateSha256 = sha256(JSON.stringify(sequenceStates));
  const financial = await prisma.$queryRawUnsafe(`SELECT
      (SELECT count(*)::int FROM "Deposit" WHERE "tenantId" = $1) AS deposits,
      (SELECT COALESCE(sum("amount"),0)::text FROM "Deposit" WHERE "tenantId" = $1) AS deposit_amount,
      (SELECT count(*)::int FROM "DepositLedgerEntry" WHERE "tenantId" = $1) AS ledger_entries,
      (SELECT COALESCE(sum("balanceEffect"),0)::text FROM "DepositLedgerEntry" WHERE "tenantId" = $1) AS ledger_balance,
      (SELECT count(*)::int FROM "Invoice" WHERE "tenantId" = $1) AS invoices,
      (SELECT COALESCE(sum("total"),0)::text FROM "Invoice" WHERE "tenantId" = $1) AS invoice_total,
      (SELECT COALESCE(sum("paidAmount"),0)::text FROM "Invoice" WHERE "tenantId" = $1) AS invoice_paid,
      (SELECT count(*)::int FROM "Payment" WHERE "tenantId" = $1) AS payments,
      (SELECT COALESCE(sum("amount"),0)::text FROM "Payment" WHERE "tenantId" = $1) AS payment_amount,
      (SELECT count(*)::int FROM "PaymentAllocation" WHERE "tenantId" = $1) AS allocations,
      (SELECT COALESCE(sum("amount"),0)::text FROM "PaymentAllocation" WHERE "tenantId" = $1) AS allocation_amount`, id('tenant'));
  const result = { tables: records, fullDataSha256: sha256(JSON.stringify(records)), schemaSha256, sequenceStateSha256, schemaCoverage: { enums: enums.length, extensions: extensions.length, sequences: sequences.length }, financial: financial[0] };
  return result;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = process.argv[2] === 'seed' ? await seed(prisma) : await audit(prisma);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch((error) => { process.stderr.write(`fixture failed: ${error.message}\n`); process.exitCode = 1; });
module.exports = { seed, audit };
