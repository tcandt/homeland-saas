import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { buildDepositCancellationPlan, buildDepositConversionPlan } from './deposit-core.policy';

describe('deposit core policy', () => {
  describe('booking to security conversion', () => {
    it('handles B < C without changing the original booking amount', () => {
      expect(buildDepositConversionPlan(2_000_000, 5_000_000)).toEqual({
        bookingBalance: 2_000_000,
        securityRequired: 5_000_000,
        transferAmount: 2_000_000,
        additionalCashRequired: 3_000_000,
        excessAmount: 0,
        excessAction: null,
      });
    });

    it('handles B = C without extra cash or refund', () => {
      expect(buildDepositConversionPlan(5_000_000, 5_000_000)).toEqual({
        bookingBalance: 5_000_000,
        securityRequired: 5_000_000,
        transferAmount: 5_000_000,
        additionalCashRequired: 0,
        excessAmount: 0,
        excessAction: null,
      });
    });

    it('handles B > C with credit', () => {
      expect(buildDepositConversionPlan(7_000_000, 5_000_000, 'CREDIT')).toMatchObject({
        transferAmount: 5_000_000,
        additionalCashRequired: 0,
        excessAmount: 2_000_000,
        excessAction: 'CREDIT',
      });
    });

    it('handles B > C with refund', () => {
      expect(buildDepositConversionPlan(7_000_000, 5_000_000, 'REFUND')).toMatchObject({
        transferAmount: 5_000_000,
        excessAmount: 2_000_000,
        excessAction: 'REFUND',
      });
    });

    it('requires an explicit disposition for excess money', () => {
      expect(() => buildDepositConversionPlan(7_000_000, 5_000_000)).toThrow(BadRequestException);
    });

    it('rejects zero security requirement', () => {
      expect(() => buildDepositConversionPlan(1_000_000, 0)).toThrow('DEPOSIT_SECURITY_REQUIRED_INVALID');
    });
  });

  describe('cancellation allocation', () => {
    it('accepts a full refund', () => {
      expect(buildDepositCancellationPlan({ availableBalance: 5_000_000, refundAmount: 5_000_000 })).toEqual({
        availableBalance: 5_000_000,
        refundAmount: 5_000_000,
        keepAmount: 0,
        deductAmount: 0,
      });
    });

    it('accepts an exact refund keep deduct split', () => {
      expect(buildDepositCancellationPlan({
        availableBalance: 5_000_000,
        refundAmount: 3_000_000,
        keepAmount: 1_000_000,
        deductAmount: 1_000_000,
      })).toMatchObject({ refundAmount: 3_000_000, keepAmount: 1_000_000, deductAmount: 1_000_000 });
    });

    it('rejects unresolved money', () => {
      expect(() => buildDepositCancellationPlan({
        availableBalance: 5_000_000,
        refundAmount: 3_000_000,
      })).toThrow('DEPOSIT_RESOLUTION_MUST_EQUAL_AVAILABLE_BALANCE');
    });

    it('rejects over-allocation', () => {
      expect(() => buildDepositCancellationPlan({
        availableBalance: 5_000_000,
        refundAmount: 5_000_001,
      })).toThrow('DEPOSIT_RESOLUTION_MUST_EQUAL_AVAILABLE_BALANCE');
    });
  });
});
