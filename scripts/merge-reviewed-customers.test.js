const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIRMATION, buildPrimaryProfile, parseArguments, validateMergeDecisions } = require('./merge-reviewed-customers');

const component = {
  componentId: 'component-1', tenantId: 'tenant-1', customerIds: ['a', 'b'],
  conflictCodes: ['PHONE_VALUES_DIFFER'], blocked: false,
};

function decision(overrides = {}) {
  return {
    componentId: 'component-1', tenantId: 'tenant-1', action: 'MERGE', primaryCustomerId: 'a',
    duplicateCustomerIds: ['b'], approvedBy: 'operator-1', evidence: ['CCCD đối chiếu trực tiếp'],
    acknowledgedConflictCodes: ['PHONE_VALUES_DIFFER'], ...overrides,
  };
}

test('requires explicit confirmation only in apply mode', () => {
  assert.deepEqual(parseArguments(['--decision-file', 'decision.json']), {
    envFile: null, tenantId: '', decisionFile: 'decision.json', apply: false, confirm: '',
  });
  assert.throws(() => parseArguments(['--decision-file', 'decision.json', '--apply']), new RegExp(CONFIRMATION));
  assert.equal(parseArguments(['--decision-file', 'decision.json', '--apply', '--confirm', CONFIRMATION]).apply, true);
});

test('validates complete reviewed decisions and rejects unacknowledged conflicts', () => {
  const review = { components: [component] };
  assert.equal(validateMergeDecisions(review, { decisions: [decision()] }).length, 1);
  assert.throws(
    () => validateMergeDecisions(review, { decisions: [decision({ acknowledgedConflictCodes: [] })] }),
    /has not been acknowledged/,
  );
});

test('rejects partial and blocking merge plans', () => {
  const review = { components: [{ ...component, customerIds: ['a', 'b', 'c'] }] };
  assert.throws(() => validateMergeDecisions(review, { decisions: [decision()] }), /every non-primary member/);
  assert.throws(
    () => validateMergeDecisions({ components: [{ ...component, blocked: true }] }, { decisions: [decision()] }),
    /must be repaired before merge/,
  );
});

test('fills only missing primary fields and unions image references', () => {
  const patch = buildPrimaryProfile(
    { email: '', identityNo: 'PRIMARY', idImages: ['a.jpg'] },
    [{ email: 'guest@example.com', identityNo: 'DUPLICATE', idImages: ['a.jpg', 'b.jpg'] }],
  );
  assert.equal(patch.email, 'guest@example.com');
  assert.equal(patch.identityNo, undefined);
  assert.deepEqual(patch.idImages, ['a.jpg', 'b.jpg']);
});
