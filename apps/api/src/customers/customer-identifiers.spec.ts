import { describe, expect, it } from 'vitest';
import { normalizeCustomerIdentityNo, normalizeCustomerPhone } from './customer-identifiers';

describe('customer identifier normalization', () => {
  it('uses Unicode compatibility normalization before canonicalizing identity numbers', () => {
    expect(normalizeCustomerIdentityNo(' Mã-\uFF21\uFF22\uFF11\uFF12\uFF13 ')).toBe('MÃAB123');
  });

  it('keeps phone canonicalization limited to ASCII digits', () => {
    expect(normalizeCustomerPhone('0901 (234) 567')).toBe('0901234567');
  });
});
