import { describe, expect, it } from 'vitest';
import { CreateCustomerSchema, UpdateCustomerSchema } from './customers.dto';

describe('customer profile fields', () => {
  const customer = { fullName: 'Local test', phone: '0900000000' };
  it('does not fabricate an ACTIVE status for a new profile', () => {
    expect(CreateCustomerSchema.parse(customer)).not.toHaveProperty('status');
  });
  it.each(['ACTIVE', 'INACTIVE', null])('rejects writable lifecycle status %s', (status) => {
    expect(CreateCustomerSchema.safeParse({ ...customer, status }).success).toBe(false);
    expect(UpdateCustomerSchema.safeParse({ status }).success).toBe(false);
  });
  it('accepts notes and identity images, and supports clearing notes', () => {
    expect(CreateCustomerSchema.parse({ ...customer, notes: 'Ghi chú', idImages: ['/storage/local-test.jpg'] })).toMatchObject({ notes: 'Ghi chú', idImages: ['/storage/local-test.jpg'] });
    expect(UpdateCustomerSchema.parse({ notes: null })).toEqual({ notes: null });
  });
});
