const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDuplicateComponents, countDuplicateKeys, parseArguments } = require('./customer-duplicate-review');

function customer(overrides) {
  return {
    id: 'customer-1', tenantId: 'tenant-1', fullName: 'Khách A', phone: '', identityNo: null,
    email: null, birthDate: null, address: null, zaloUserId: null, roomId: null,
    createdAt: new Date('2026-01-01'), contracts: [], deposits: [], invoices: [], occupancies: [], rentalCycles: [], contractParties: [],
    ...overrides,
  };
}

test('parses only read-only review arguments', () => {
  assert.deepEqual(parseArguments(['--env-file', '.env', '--tenant-id', 'tenant-1']), { envFile: '.env', tenantId: 'tenant-1' });
  assert.throws(() => parseArguments(['--apply']), /Unknown argument/);
});

test('collapses overlapping phone and identity findings into one component', () => {
  const rows = [
    customer({ id: 'a', phone: '090 111 2222', identityNo: 'AAA-1' }),
    customer({ id: 'b', phone: '0901112222', identityNo: 'BBB-2' }),
    customer({ id: 'c', phone: '0983334444', identityNo: 'BBB2' }),
  ];
  const components = buildDuplicateComponents(rows);
  assert.equal(countDuplicateKeys(rows), 2);
  assert.equal(components.length, 1);
  assert.deepEqual(components[0].customerIds, ['a', 'b', 'c']);
  assert.deepEqual(components[0].matchedBy, ['IDENTITY', 'PHONE']);
  assert.ok(components[0].conflictCodes.includes('PHONE_VALUES_DIFFER'));
  assert.ok(components[0].conflictCodes.includes('IDENTITY_VALUES_DIFFER'));
});

test('blocks a component whose open occupancies point at different rooms', () => {
  const rows = [
    customer({ id: 'a', phone: '0901112222', occupancies: [{ id: 'o1', roomId: 'r1', leftAt: null }] }),
    customer({ id: 'b', phone: '0901112222', occupancies: [{ id: 'o2', roomId: 'r2', leftAt: null }] }),
  ];
  const component = buildDuplicateComponents(rows)[0];
  assert.equal(component.blocked, true);
  assert.ok(component.conflictCodes.includes('BLOCKING_OPEN_OCCUPANCIES_IN_DIFFERENT_ROOMS'));
});

test('never joins duplicate values across tenants', () => {
  const components = buildDuplicateComponents([
    customer({ id: 'a', tenantId: 'tenant-1', phone: '0901112222' }),
    customer({ id: 'b', tenantId: 'tenant-2', phone: '0901112222' }),
  ]);
  assert.equal(components.length, 0);
});
