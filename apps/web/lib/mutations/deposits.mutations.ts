import { useMutation, useQueryClient } from '@tanstack/react-query';
import { depositsApi } from '../api/deposits.api';

export const useCreateDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => depositsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
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
    },
  });
};

export const useCollectDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => depositsApi.collect(id, note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
    },
  });
};

export const useRefundDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, receiptStatus, attachmentUrls, refundAmount }: { id: string; reason: string; receiptStatus?: "PENDING" | "COMPLETED"; attachmentUrls?: string[]; refundAmount?: number }) =>
      depositsApi.refund(id, { reason, receiptStatus, attachmentUrls, refundAmount }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
    },
  });
};

export const useCompletePendingDepositRefundMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => depositsApi.completePendingRefund(id, note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
    },
  });
};

export const useCancelDepositMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      resolutionAction,
      resolutionAmount,
      receiptStatus,
      attachmentUrls,
    }: {
      id: string;
      reason: string;
      resolutionAction?: "REFUND" | "KEEP" | "DEDUCT";
      resolutionAmount?: number;
      receiptStatus?: "PENDING" | "COMPLETED";
      attachmentUrls?: string[];
    }) =>
      depositsApi.cancel(id, {
        reason,
        resolutionAction,
        resolutionAmount,
        receiptStatus,
        attachmentUrls,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.id] });
    },
  });
};

export const useConvertContractMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => depositsApi.convertToContract(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', id] });
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

