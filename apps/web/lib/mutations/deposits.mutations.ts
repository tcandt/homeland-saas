import { useMutation, useQueryClient } from '@tanstack/react-query';
import { depositsApi } from '../api/deposits.api';
import { financeKeys } from '../queries/finance.queries';

export const useCreateDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: any; idempotencyKey: string }) => depositsApi.create(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
};

export const useUpdateDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => depositsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
};

export const useDeleteDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => depositsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
};

export const useCollectDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note, holdExpiresAt, idempotencyKey }: { id: string; note?: string; holdExpiresAt?: string; idempotencyKey: string }) =>
      depositsApi.collect(id, { note, holdExpiresAt }, idempotencyKey),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
};

export const useRefundDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, receiptStatus, attachmentUrls, refundAmount, idempotencyKey }: { id: string; reason: string; receiptStatus?: "PENDING" | "COMPLETED"; attachmentUrls?: string[]; refundAmount?: number; idempotencyKey: string }) =>
      depositsApi.refund(id, { reason, receiptStatus, attachmentUrls, refundAmount }, idempotencyKey),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
};

export interface CompletePendingRefundVariables {
  operationId: string;
  depositId?: string;
  note?: string;
  attachmentUrls?: string[];
  idempotencyKey: string;
}

export const useCompletePendingDepositRefundMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ operationId, note, attachmentUrls, idempotencyKey }: CompletePendingRefundVariables) =>
      depositsApi.completePendingRefund(operationId, note, idempotencyKey, attachmentUrls),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
      if (variables.depositId) {
        queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      }
    },
  });
};

export interface CancelDepositVariables {
  id: string;
  reason: string;
  availableBalance: number;
  refundAmount: number;
  keepAmount: number;
  deductAmount: number;
  receiptStatus?: 'PENDING' | 'COMPLETED';
  attachmentUrls?: string[];
  idempotencyKey: string;
}

const toMoney = (value: number) => Math.round(value * 100) / 100;

export function buildCancelDepositPayload({
  availableBalance,
  refundAmount,
  keepAmount,
  deductAmount,
  reason,
  receiptStatus,
  attachmentUrls,
}: Omit<CancelDepositVariables, 'id' | 'idempotencyKey'>) {
  const allocations = [availableBalance, refundAmount, keepAmount, deductAmount];
  if (allocations.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('DEPOSIT_ALLOCATION_INVALID');
  }
  if (toMoney(refundAmount + keepAmount + deductAmount) !== toMoney(availableBalance)) {
    throw new Error('DEPOSIT_RESOLUTION_MUST_EQUAL_AVAILABLE_BALANCE');
  }
  const normalizedAttachmentUrls = Array.isArray(attachmentUrls)
    ? [...new Set(attachmentUrls.map((url) => url.trim()).filter(Boolean))]
    : [];

  return {
    reason: reason.trim() || 'Hủy phiếu cọc',
    refundAmount: toMoney(refundAmount),
    keepAmount: toMoney(keepAmount),
    deductAmount: toMoney(deductAmount),
    refundStatus: refundAmount > 0 ? receiptStatus : undefined,
    ...(normalizedAttachmentUrls.length ? { attachmentUrls: normalizedAttachmentUrls } : {}),
  };
}

export const useCancelDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      availableBalance,
      refundAmount,
      keepAmount,
      deductAmount,
      receiptStatus,
      attachmentUrls,
      idempotencyKey,
    }: CancelDepositVariables) => {
      return depositsApi.cancel(
        id,
        buildCancelDepositPayload({
          reason,
          availableBalance,
          refundAmount,
          keepAmount,
          deductAmount,
          receiptStatus,
          attachmentUrls,
        }),
        idempotencyKey,
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
};

export const useCancelUnpaidDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, idempotencyKey }: { id: string; reason: string; idempotencyKey: string }) =>
      depositsApi.cancelUnpaid(id, { reason }, idempotencyKey),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
};

export interface ConvertContractVariables {
  id: string;
  securityRequired: number;
  contractId?: string;
  securityDepositId?: string;
  excessAction?: 'CREDIT' | 'REFUND';
  refundStatus?: 'PENDING' | 'COMPLETED';
  idempotencyKey: string;
}

export const useConvertContractMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      securityRequired,
      contractId,
      securityDepositId,
      excessAction,
      refundStatus,
      idempotencyKey,
    }: ConvertContractVariables) =>
      depositsApi.convertToContract(
        id,
        {
          securityRequired,
          contractId,
          securityDepositId,
          excessAction,
          refundStatus,
        },
        idempotencyKey,
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
};

export const useCleanupOrphanDepositsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => depositsApi.cleanupOrphans(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
    },
  });
};
