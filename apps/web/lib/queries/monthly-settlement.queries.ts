import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { monthlySettlementApi } from '../api/monthly-settlement.api';

export const monthlySettlementKeys = {
  all: ['monthly-settlement'] as const,
  overview: (params?: any) => [...monthlySettlementKeys.all, 'overview', params] as const,
  settings: () => [...monthlySettlementKeys.all, 'settings'] as const,
};

export const useMonthlySettlementOverviewQuery = (params?: {
  period?: string;
  buildingId?: string;
  search?: string;
  notificationStatus?: string;
  paymentStatus?: string;
}) => {
  return useQuery({
    queryKey: monthlySettlementKeys.overview(params),
    queryFn: async () => {
      const res = await monthlySettlementApi.getOverview(params);
      return (res as any)?.data || res;
    },
    refetchInterval: 30000,
  });
};

export const useMonthlySettlementSettingsQuery = () => {
  return useQuery({
    queryKey: monthlySettlementKeys.settings(),
    queryFn: async () => {
      const res = await monthlySettlementApi.getSettings();
      return (res as any)?.data || res;
    },
  });
};

export const useCloseMonthMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { period?: string; roomIds?: string[]; autoSend?: boolean }) =>
      monthlySettlementApi.closeMonth(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monthlySettlementKeys.all });
    },
  });
};

export const useSendMonthlyNotificationsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { period?: string; roomIds?: string[]; invoiceIds?: string[] }) =>
      monthlySettlementApi.sendNotifications(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monthlySettlementKeys.all });
    },
  });
};

export const useResendSingleNotificationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, period }: { roomId: string; period?: string }) =>
      monthlySettlementApi.resendSingle(roomId, period),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monthlySettlementKeys.all });
    },
  });
};

export const useSaveSettlementSettingsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: any) => monthlySettlementApi.saveSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monthlySettlementKeys.settings() });
      queryClient.invalidateQueries({ queryKey: monthlySettlementKeys.overview() });
    },
  });
};
