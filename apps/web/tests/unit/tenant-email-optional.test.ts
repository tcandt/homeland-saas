import { describe, it, expect } from 'vitest';
import { CreateCustomerSchema, UpdateCustomerSchema } from '@homeland/shared';

export function normalizeTenantFormPayload(input: {
  fullName: string;
  phone: string;
  email?: string | null;
  citizenId?: string | null;
}) {
  return {
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    email: input.email ? (input.email.trim() === '' ? null : input.email.trim()) : null,
    citizenId: input.citizenId ? (input.citizenId.trim() === '' ? null : input.citizenId.trim()) : null,
  };
}

describe('D2-FIX-05: Optional Email & Form Normalization', () => {
  it('allows creating customer with empty email string (preprocessed to null)', () => {
    const raw = {
      fullName: 'Nguyen Van A',
      phone: '0987654321',
      email: '',
    };
    const parsed = CreateCustomerSchema.parse(raw);
    expect(parsed.email).toBeNull();
  });

  it('allows creating customer with whitespace-only email (preprocessed to null)', () => {
    const raw = {
      fullName: 'Nguyen Van B',
      phone: '0987654322',
      email: '   ',
    };
    const parsed = CreateCustomerSchema.parse(raw);
    expect(parsed.email).toBeNull();
  });

  it('allows creating customer with valid email', () => {
    const raw = {
      fullName: 'Nguyen Van C',
      phone: '0987654323',
      email: 'customer.valid@example.com',
    };
    const parsed = CreateCustomerSchema.parse(raw);
    expect(parsed.email).toBe('customer.valid@example.com');
  });

  it('rejects invalid email format with error', () => {
    const raw = {
      fullName: 'Nguyen Van D',
      phone: '0987654324',
      email: 'invalid-email-string',
    };
    const result = CreateCustomerSchema.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Email không hợp lệ');
    }
  });

  it('allows updating customer to remove email by passing empty string or null', () => {
    const raw = {
      email: '',
    };
    const parsed = UpdateCustomerSchema.parse(raw);
    expect(parsed.email).toBeNull();
  });

  it('normalizes roommate form payload without inheriting primary representative email', () => {
    const primaryRepEmail = 'rep.owner@example.com';
    const roommateInput = {
      fullName: 'Roommate Independent',
      phone: '0912345678',
      email: '', // roommate has no email
    };

    const normalized = normalizeTenantFormPayload(roommateInput);
    expect(normalized.email).toBeNull();
    expect(normalized.email).not.toBe(primaryRepEmail);
  });
});
