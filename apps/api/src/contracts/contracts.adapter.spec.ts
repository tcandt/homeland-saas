import { describe, it, expect } from 'vitest';
import { ContractStatus } from '@prisma/client';
import { normalizeContractStatus, isTerminalContractStatus, isActiveLikeContractStatus, ROOM_VISIBLE_CONTRACT_STATUSES } from './contracts.adapter';

describe('Contracts Adapter', () => {
  describe('normalizeContractStatus', () => {
    it('returns undefined if status is falsy', () => {
      expect(normalizeContractStatus(undefined)).toBeUndefined();
    });

    it('casts valid string to ContractStatus', () => {
      expect(normalizeContractStatus('ACTIVE')).toBe(ContractStatus.ACTIVE);

      expect(normalizeContractStatus('PENDING_APPROVAL')).toBe(ContractStatus.PENDING_APPROVAL);
    });
  });

  describe('isTerminalContractStatus', () => {
    it('returns true for terminal states', () => {

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

      expect(isActiveLikeContractStatus(ContractStatus.CANCELLED)).toBe(false);
    });
  });

  describe('ROOM_VISIBLE_CONTRACT_STATUSES', () => {
    it('includes pending contracts for room profile display but excludes terminal history', () => {
      expect(ROOM_VISIBLE_CONTRACT_STATUSES).toEqual(expect.arrayContaining([
        ContractStatus.DRAFT,
        ContractStatus.PENDING_APPROVAL,
        ContractStatus.APPROVED,
        ContractStatus.ACTIVE,
        ContractStatus.EXPIRING,
      ]));
      expect(ROOM_VISIBLE_CONTRACT_STATUSES).not.toContain(ContractStatus.TERMINATED);
      expect(ROOM_VISIBLE_CONTRACT_STATUSES).not.toContain(ContractStatus.EXPIRED);
      expect(ROOM_VISIBLE_CONTRACT_STATUSES).not.toContain(ContractStatus.CANCELLED);
    });
  });
});
