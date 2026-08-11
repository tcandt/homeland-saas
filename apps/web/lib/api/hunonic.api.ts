import { apiClient } from './client';

export type HunonicSettingsPayload = {
  enabled?: boolean;
  mode?: 'mobile' | 'website';
  username?: string;
  password?: string;
  baseUrl?: string;
  websiteBaseUrl?: string;
  websiteToken?: string;
  websiteCookie?: string;
  timeoutMs?: number;
  syncIntervalMinutes?: number;
  retentionYears?: number;
};

export type HunonicHistoryParams = {
  search?: string;
  buildingCode?: string;
  roomCode?: string;
  year?: string;
  month?: string;
  page?: number;
  limit?: number;
};

export type HunonicRateApplyPayload = {
  meterIds: string[];
  mode: 'residential' | 'custom';
  customRateVnd?: number;
};

export type HunonicLockedPeriodRow = {
  buildingCode: string;
  roomCode: string;
  period: string;
  note?: string;
};

export const hunonicApi = {
  overview: () => apiClient.get('/hunonic/overview'),
  rates: () => apiClient.get('/hunonic/rates'),
  applyRates: (payload: HunonicRateApplyPayload) => apiClient.post('/hunonic/rates/apply', payload),
  history: (params?: HunonicHistoryParams) => apiClient.get('/hunonic/history', { params }),
  reconciliation: (params?: HunonicHistoryParams) => apiClient.get('/hunonic/reconciliation', { params }),
  lockPeriods: (rows: HunonicLockedPeriodRow[]) => apiClient.post('/hunonic/history/lock', { rows }),
  unlockPeriods: (rows: HunonicLockedPeriodRow[]) => apiClient.post('/hunonic/history/unlock', { rows }),
  roomElectricity: (roomId: string) => apiClient.get(`/hunonic/rooms/${roomId}/electricity`),
  sync: () => apiClient.post('/hunonic/sync'),
  test: (settings: HunonicSettingsPayload) => apiClient.post('/hunonic/test', settings),
};
