import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const { invalidateQueries } = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useQueryClient: vi.fn(() => ({ invalidateQueries })),
    useMutation: vi.fn((options) => options),
  };
});

vi.mock('../../lib/api/deposits.api', () => ({
  depositsApi: {
    create: vi.fn(),
    collect: vi.fn(),
    refund: vi.fn(),
    cancel: vi.fn(),
  },
}));

import { financeKeys } from '../../lib/queries/finance.queries';
import {
  useCreateDepositMutation,
  useCollectDepositMutation,
  useRefundDepositMutation,
  useCancelDepositMutation,
  buildCancelDepositPayload,
} from '../../lib/mutations/deposits.mutations';

describe('P5: Finance Cross-Tab Query Invalidation & Authoritative Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('P5.1: Mutation Invalidation triggers finance sync', () => {
    it('invalidates financeKeys.all on deposit creation', () => {
      const mutation: any = useCreateDepositMutation();
      mutation.onSuccess();

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: financeKeys.all,
      });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['deposits'],
      });
    });

    it('invalidates financeKeys.all on deposit collection (cash-in)', () => {
      const mutation: any = useCollectDepositMutation();
      mutation.onSuccess(undefined, { id: 'dep-1' });

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: financeKeys.all,
      });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['deposit', 'dep-1'],
      });
    });

    it('invalidates financeKeys.all on deposit refund', () => {
      const mutation: any = useRefundDepositMutation();
      mutation.onSuccess(undefined, { id: 'dep-2' });

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: financeKeys.all,
      });
    });

    it('invalidates financeKeys.all on deposit cancellation', () => {
      const mutation: any = useCancelDepositMutation();
      mutation.onSuccess(undefined, { id: 'dep-3' });

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: financeKeys.all,
      });
    });
  });

  describe('P5.2: Multi-tab background/foreground synchronization via React Query', () => {
    it('invalidates cache so background data is marked stale and refetched on focus', async () => {
      const queryClient = new QueryClient();
      queryClient.setQueryData(financeKeys.all, { balance: 5_000_000 });

      expect(queryClient.getQueryState(financeKeys.all)?.isInvalidated).toBe(false);

      await queryClient.invalidateQueries({ queryKey: financeKeys.all });

      expect(queryClient.getQueryState(financeKeys.all)?.isInvalidated).toBe(true);
    });
  });

  describe('P5.3: Authoritative Balance Verification & Conservation Invariant', () => {
    it('enforces that allocations strictly equal available balance without divergence', () => {
      const payload = buildCancelDepositPayload({
        availableBalance: 5_000_000,
        refundAmount: 2_000_000,
        keepAmount: 2_000_000,
        deductAmount: 1_000_000,
        reason: 'Khách dọn đi',
      });

      expect(payload.refundAmount + payload.keepAmount + payload.deductAmount).toBe(5_000_000);
    });

    it('rejects allocation divergence where allocations do not match available balance', () => {
      expect(() =>
        buildCancelDepositPayload({
          availableBalance: 5_000_000,
          refundAmount: 2_000_000,
          keepAmount: 2_000_000,
          deductAmount: 500_000,
          reason: 'Lệch số dư',
        }),
      ).toThrow('DEPOSIT_RESOLUTION_MUST_EQUAL_AVAILABLE_BALANCE');

      expect(() =>
        buildCancelDepositPayload({
          availableBalance: 5_000_000,
          refundAmount: 3_000_000,
          keepAmount: 2_000_000,
          deductAmount: 1_000_000,
          reason: 'Vượt số dư',
        }),
      ).toThrow('DEPOSIT_RESOLUTION_MUST_EQUAL_AVAILABLE_BALANCE');
    });
  });
});
