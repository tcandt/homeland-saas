const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIRMATION, buildBackfillPlan, deterministicCycleId, mapRentalCycleStatus, parseArguments } = require('./backfill-rental-cycles');

function contract(overrides = {}) {
  return {
    id: 'contract-1', tenantId: 'tenant-1', customerId: 'customer-1', roomId: 'room-1', status: 'ACTIVE',
    startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), monthlyRent: 1000, depositMoney: 1000,
    actualMoveOutAt: null, terminationReason: null, deposits: [], occupancies: [], invoices: [], settlement: null,
    ...overrides,
  };
}

test('maps every contract status to a RentalCycle status', () => {
  assert.equal(mapRentalCycleStatus('DRAFT'), 'PLANNED');
  assert.equal(mapRentalCycleStatus('APPROVED'), 'RESERVED');
  assert.equal(mapRentalCycleStatus('ACTIVE'), 'ACTIVE');
  assert.equal(mapRentalCycleStatus('TERMINATED'), 'CLOSED');
  assert.equal(mapRentalCycleStatus('CANCELLED'), 'CANCELLED');
  assert.throws(() => mapRentalCycleStatus('UNKNOWN'), /Unsupported/);
});

test('uses stable cycle IDs and requires apply confirmation', () => {
  assert.equal(deterministicCycleId('contract-1'), deterministicCycleId('contract-1'));
  assert.throws(() => parseArguments(['--apply']), new RegExp(CONFIRMATION));
  assert.equal(parseArguments(['--apply', '--confirm', CONFIRMATION]).apply, true);
});

test('builds a complete contract-linked lifecycle candidate', () => {
  const plan = buildBackfillPlan({
    customers: [{ id: 'customer-1', tenantId: 'tenant-1', phone: '0901', identityNo: 'A1', createdAt: new Date() }],
    contracts: [contract({
      deposits: [{ id: 'deposit-1', tenantId: 'tenant-1', customerId: 'customer-1' }],
      occupancies: [{ id: 'occupancy-1', joinedAt: new Date('2026-01-02'), leftAt: null }],
      invoices: [{ id: 'invoice-1', tenantId: 'tenant-1', customerId: 'customer-1', payments: [{ id: 'payment-1' }] }],
      settlement: { id: 'settlement-1' },
    })],
  });
  assert.equal(plan.candidates.length, 1);
  assert.deepEqual(plan.candidates[0].depositIds, ['deposit-1']);
  assert.deepEqual(plan.candidates[0].paymentIds, ['payment-1']);
  assert.equal(plan.candidates[0].actualMoveInAt.toISOString(), '2026-01-02T00:00:00.000Z');
});

test('quarantines duplicate contract signatures and unbound finance records', () => {
  const baseCustomer = { tenantId: 'tenant-1', phone: '0901', identityNo: 'A1', createdAt: new Date() };
  const plan = buildBackfillPlan({
    customers: [{ ...baseCustomer, id: 'customer-1' }, { ...baseCustomer, id: 'customer-2' }],
    contracts: [contract(), contract({ id: 'contract-2', customerId: 'customer-2' })],
    orphanDeposits: [{ id: 'deposit-x', tenantId: 'tenant-1', customerId: 'customer-1', roomId: 'room-1', type: 'BOOKING', status: 'PAID' }],
    orphanInvoices: [{ id: 'invoice-x', tenantId: 'tenant-1', customerId: 'customer-1', status: 'ISSUED' }],
  });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped.length, 2);
  assert.equal(plan.reviewQueue.orphanDeposits.length, 1);
  assert.equal(plan.reviewQueue.orphanInvoices.length, 1);
});

test('links an orphan deposit only when customer and room resolve to exactly one contract', () => {
  const plan = buildBackfillPlan({
    customers: [],
    contracts: [contract()],
    orphanDeposits: [{ id: 'booking-1', tenantId: 'tenant-1', customerId: 'customer-1', roomId: 'room-1', type: 'BOOKING', status: 'PAID' }],
  });
  assert.deepEqual(plan.candidates[0].depositIds, ['booking-1']);
  assert.equal(plan.reviewQueue.orphanDeposits.length, 0);
});

test('rejects a mismatched financial binding', () => {
  const plan = buildBackfillPlan({
    customers: [],
    contracts: [contract({ invoices: [{ id: 'invoice-1', tenantId: 'tenant-1', customerId: 'other', payments: [] }] })],
  });
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped[0].reason, 'FINANCIAL_BINDING_MISMATCH_REQUIRES_REVIEW');
});
