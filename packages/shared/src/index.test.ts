import { describe, it, expect } from 'vitest';
import { CreateCustomerSchema } from './customers/customers.dto';

describe('Shared Workspace', () => {
  it('should pass a basic sanity check', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('Customer schemas', () => {
  it('normalizes an empty optional email to null', () => {
    const customer = CreateCustomerSchema.parse({
      fullName: 'Nguyễn Văn A',
      phone: '0900000000',
      email: '   ',
    });

    expect(customer.email).toBeNull();
  });

  it('keeps rejecting a non-empty invalid email', () => {
    const result = CreateCustomerSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '0900000000',
      email: 'khong-hop-le',
    });

    expect(result.success).toBe(false);
  });
});
