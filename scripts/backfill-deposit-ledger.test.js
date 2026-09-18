const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONFIRMATION,
  buildReviewQueue,
  deterministicId,
  parseArguments,
  parseReviewDecisions,
} = require('./backfill-deposit-ledger');

function deposit(overrides = {}) {
  return {
    id: 'deposit-1',
    tenantId: 'tenant-1',
    rentalCycleId: 'cycle-1',
    contractId: null,
    customerId: 'customer-1',
    roomId: 'room-1',
    code: 'DEP-1',
    type: 'BOOKING',
    status: 'PAID',
    amount: 2_000_000,
    ledgerEntries: [],
    ...overrides,
  };
}

test('is read-only by default and requires explicit apply confirmation plus review file', () => {
  assert.equal(parseArguments([]).apply, false);
  assert.throws(() => parseArguments(['--apply']), new RegExp(CONFIRMATION));
  assert.throws(
    () => parseArguments(['--apply', '--confirm', CONFIRMATION]),
    /review-file/,
  );
  assert.equal(parseArguments([
    '--apply', '--confirm', CONFIRMATION, '--review-file', 'review.json', '--tenant-id', 'tenant-1',
  ]).tenantId, 'tenant-1');
});

test('never infers an opening balance from deposit status', () => {
  const plan = buildReviewQueue([deposit()]);
  assert.equal(plan.reviewQueue.length, 1);
  assert.equal(plan.reviewQueue[0].approvedBalance, null);
  assert.equal(plan.reviewQueue[0].decision, 'REVIEW_REQUIRED');
});

test('quarantines deposits that still lack RentalCycle and skips an existing ledger', () => {
  const plan = buildReviewQueue([
    deposit({ id: 'missing-cycle', rentalCycleId: null }),
    deposit({ id: 'existing', ledgerEntries: [{ id: 'ledger-1' }] }),
  ]);
  assert.match(plan.reviewQueue[0].reason, /RENTAL_CYCLE_REQUIRED/);
  assert.equal(plan.alreadyBackfilled[0].depositId, 'existing');
});

test('accepts only tenant-matched, evidenced balances within the immutable original amount', () => {
  const plan = buildReviewQueue([deposit()]);
  const approved = parseReviewDecisions({ decisions: [{
    depositId: 'deposit-1',
    tenantId: 'tenant-1',
    decision: 'APPROVE',
    approvedBalance: 1_500_000,
    evidenceRef: 'receipt-2026-001',
  }] }, plan.reviewQueue);
  assert.equal(approved[0].approvedBalance, 1_500_000);
  assert.throws(() => parseReviewDecisions({ decisions: [{
    depositId: 'deposit-1', tenantId: 'other', decision: 'APPROVE', approvedBalance: 1, evidenceRef: 'abc',
  }] }, plan.reviewQueue), /Tenant mismatch/);
  assert.throws(() => parseReviewDecisions({ decisions: [{
    depositId: 'deposit-1', tenantId: 'tenant-1', decision: 'APPROVE', approvedBalance: 2_000_001, evidenceRef: 'abc',
  }] }, plan.reviewQueue), /exceeds original/);
});

test('uses deterministic operation and ledger identifiers for safe replay', () => {
  assert.equal(deterministicId('dop_open', 'deposit-1'), deterministicId('dop_open', 'deposit-1'));
  assert.notEqual(deterministicId('dop_open', 'deposit-1'), deterministicId('dop_open', 'deposit-2'));
});

test('accepts the same reviewed decision on rerun so apply can verify an idempotent replay', () => {
  const plan = buildReviewQueue([deposit({ ledgerEntries: [{ id: deterministicId('dle_open', 'deposit-1') }] })]);
  const approved = parseReviewDecisions({ decisions: [{
    depositId: 'deposit-1', tenantId: 'tenant-1', decision: 'APPROVE',
    approvedBalance: 2_000_000, evidenceRef: 'receipt-2026-001',
  }] }, [...plan.reviewQueue, ...plan.alreadyBackfilled]);
  assert.equal(approved[0].depositId, 'deposit-1');
});
