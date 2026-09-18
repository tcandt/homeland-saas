const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeLifecycleData, parseArguments, runDetector } = require('./core-lifecycle-detector');

test('parses read-only detector arguments', () => {
  assert.deepEqual(parseArguments(['--env-file', '.env', '--tenant-id', 'tenant-1']), {
    envFile: '.env',
    tenantId: 'tenant-1',
  });
  assert.throws(() => parseArguments(['--apply']), /Unknown argument/);
});

test('detects lifecycle, duplicate, deposit, and invoice inconsistencies without exposing identifiers', () => {
  const report = analyzeLifecycleData({
    rooms: [
      { id: 'room-1', tenantId: 'tenant-1', status: 'AVAILABLE', rentalType: 'WHOLE', capacity: 1, contracts: [{ id: 'contract-1', status: 'ACTIVE' }], occupancies: [], roommates: [] },
      { id: 'room-2', tenantId: 'tenant-1', status: 'OCCUPIED', rentalType: 'SHARED', capacity: 1, contracts: [], occupancies: [], roommates: [] },
    ],
    occupancies: [{ id: 'occupancy-1', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-1', customer: { roomId: null }, contract: { id: 'contract-old', status: 'TERMINATED' } }],
    customers: [
      { id: 'customer-1', tenantId: 'tenant-1', phone: '090 123 4567', identityNo: 'ABC-1' },
      { id: 'customer-2', tenantId: 'tenant-1', phone: '0901234567', identityNo: 'ABC1' },
    ],
    contracts: [
      { id: 'contract-1', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-1', rentalCycleId: null, status: 'ACTIVE', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      { id: 'contract-2', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-2', rentalCycleId: 'cycle-2', rentalCycle: { tenantId: 'tenant-1', customerId: 'customer-2', roomId: 'room-1' }, status: 'APPROVED', startDate: new Date('2026-06-01'), endDate: new Date('2027-05-31') },
    ],
    deposits: [{ id: 'deposit-1', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-1', contractId: 'contract-1', rentalCycleId: null, amount: 100, status: 'PAID', contract: { id: 'contract-1', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-1', rentalCycleId: 'cycle-1', status: 'ACTIVE', depositMoney: 500 } }],
    invoices: [{ id: 'invoice-1', tenantId: 'tenant-1', contractId: 'contract-1', rentalCycleId: null, paidAmount: 700, contract: { rentalCycleId: 'cycle-1' }, allocations: [{ amount: 300, payment: { status: 'CONFIRMED', deletedAt: null } }] }],
    payments: [{ id: 'payment-1', tenantId: 'tenant-1', invoiceId: 'invoice-1', rentalCycleId: null, invoice: { rentalCycleId: 'cycle-1' } }],
  });

  assert.equal(report.readOnly, true);
  assert.ok(report.countsByCode.ROOM_AVAILABLE_WITH_ACTIVE_BINDINGS);
  assert.ok(report.countsByCode.ROOM_OCCUPIED_WITHOUT_ACTIVE_BINDINGS);
  assert.ok(report.countsByCode.OPEN_OCCUPANCY_WITH_TERMINAL_CONTRACT);
  assert.ok(report.countsByCode.DUPLICATE_CUSTOMER_PHONE);
  assert.ok(report.countsByCode.DUPLICATE_CUSTOMER_IDENTITY);
  assert.ok(report.countsByCode.OVERLAPPING_ROOM_CONTRACTS);
  assert.ok(report.countsByCode.CONTRACT_DEPOSIT_BALANCE_MISMATCH);
  assert.ok(report.countsByCode.INVOICE_PAID_AMOUNT_ALLOCATION_MISMATCH);
  assert.ok(report.countsByCode.CONTRACT_WITHOUT_RENTAL_CYCLE);
  assert.ok(report.countsByCode.DEPOSIT_RENTAL_CYCLE_BINDING_MISMATCH);
  assert.ok(report.countsByCode.INVOICE_RENTAL_CYCLE_BINDING_MISMATCH);
  assert.ok(report.countsByCode.PAYMENT_RENTAL_CYCLE_BINDING_MISMATCH);
  assert.equal(JSON.stringify(report).includes('0901234567'), false);
  assert.equal(JSON.stringify(report).includes('ABC1'), false);
});

test('queries only read models and supports tenant scoping', async () => {
  const calls = [];
  const model = (name) => ({ findMany: async (args) => { calls.push([name, args]); return []; } });
  const prisma = {
    room: model('room'), occupancy: model('occupancy'), customer: model('customer'),
    contract: model('contract'), deposit: model('deposit'), invoice: model('invoice'), payment: model('payment'),
  };
  const report = await runDetector({ envFile: null, tenantId: 'tenant-1' }, { prisma });
  assert.equal(report.totalFindings, 0);
  assert.equal(calls.length, 7);
  for (const [, args] of calls) assert.equal(args.where.tenantId, 'tenant-1');
});
