import { describe, expect, it } from 'vitest';
import { remainingContractDays } from './contract-days';

describe('contract calendar days in Vietnam', () => {
  it('uses the same calendar day for date-only and database ISO dates', () => {
    const now = new Date('2026-10-20T18:30:00Z');
    expect(remainingContractDays('2026-10-22', now)).toBe(1);
    expect(remainingContractDays('2026-10-22T00:00:00.000Z', now)).toBe(1);
    expect(remainingContractDays('2026-10-21', now)).toBe(0);
    expect(remainingContractDays('2026-10-01', now)).toBe(0);
  });
});
