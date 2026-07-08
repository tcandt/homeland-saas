import { ContractStatus } from '@prisma/client';
import { normalizeContractStatus, isTerminalContractStatus, isActiveLikeContractStatus } from './contracts.adapter';

describe('Contracts Adapter', () => {
  describe('normalizeContractStatus', () => {
    it('returns undefined if status is falsy', () => {
      expect(normalizeContractStatus(undefined)).toBeUndefined();
    });

    it('casts valid string to ContractStatus', () => {
      expect(normalizeContractStatus('ACTIVE')).toBe(ContractStatus.ACTIVE);
      expect(normalizeContractStatus('ENDED')).toBe(ContractStatus.ENDED);
      expect(normalizeContractStatus('PENDING_APPROVAL')).toBe(ContractStatus.PENDING_APPROVAL);
    });
  });

  describe('isTerminalContractStatus', () => {
    it('returns true for terminal states', () => {
      expect(isTerminalContractStatus(ContractStatus.ENDED)).toBe(true);
      expect(isTerminalContractStatus(ContractStatus.EXPIRED)).toBe(true);
      expect(isTerminalContractStatus(ContractStatus.TERMINATED)).toBe(true);
      expect(isTerminalContractStatus(ContractStatus.CANCELLED)).toBe(true);
    });

    it('returns false for non-terminal states', () => {
      expect(isTerminalContractStatus(ContractStatus.DRAFT)).toBe(false);
      expect(isTerminalContractStatus(ContractStatus.ACTIVE)).toBe(false);
      expect(isTerminalContractStatus(ContractStatus.EXPIRING)).toBe(false);
    });
  });

  describe('isActiveLikeContractStatus', () => {
    it('returns true for active states', () => {
      expect(isActiveLikeContractStatus(ContractStatus.ACTIVE)).toBe(true);
      expect(isActiveLikeContractStatus(ContractStatus.EXPIRING)).toBe(true);
    });

    it('returns false for inactive states', () => {
      expect(isActiveLikeContractStatus(ContractStatus.DRAFT)).toBe(false);
      expect(isActiveLikeContractStatus(ContractStatus.ENDED)).toBe(false);
      expect(isActiveLikeContractStatus(ContractStatus.CANCELLED)).toBe(false);
    });
  });
});
