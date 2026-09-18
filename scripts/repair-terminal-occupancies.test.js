const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIRMATION, buildRepairPlan, parseArguments, runRepair } = require('./repair-terminal-occupancies');

test('defaults to dry-run and protects apply with an exact confirmation', () => {
  assert.deepEqual(parseArguments(['--tenant-id', 'tenant-1']), { envFile: null, tenantId: 'tenant-1', apply: false, confirm: '' });
  assert.throws(() => parseArguments(['--apply']), /requires --confirm/);
  assert.equal(parseArguments(['--apply', '--confirm', CONFIRMATION]).apply, true);
});

test('plans only terminal occupancies with consistent bindings', () => {
  const base = {
    id: 'occupancy-1', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-1', contractId: 'contract-1',
    contract: { id: 'contract-1', tenantId: 'tenant-1', roomId: 'room-1', customerId: 'customer-1', coRepresentativeIds: [], status: 'TERMINATED', actualMoveOutAt: new Date('2026-09-01'), endDate: new Date('2026-09-02'), updatedAt: new Date('2026-09-03') },
  };
  const plan = buildRepairPlan([base, { ...base, id: 'bad-1', roomId: 'room-other' }]);
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.candidates[0].leftAt.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.deepEqual(plan.skipped, [{ occupancyId: 'bad-1', tenantId: 'tenant-1', reason: 'BINDING_MISMATCH_REQUIRES_REVIEW' }]);
});

test('dry-run performs no transaction or writes', async () => {
  const prisma = {
    occupancy: { findMany: async () => [] },
    $transaction: async () => { throw new Error('must not write'); },
  };
  const result = await runRepair({ envFile: null, tenantId: '', apply: false, confirm: '' }, { prisma });
  assert.equal(result.mode, 'DRY_RUN');
  assert.equal(result.candidateCount, 0);
});
