import { apiClient } from './client';

export type HunonicSettingsPayload = {
  enabled?: boolean;
  mode?: 'mobile' | 'website';
  username?: string;
  password?: string;
  passwordConfigured?: boolean;
  baseUrl?: string;
  websiteBaseUrl?: string;
  websiteToken?: string;
  websiteTokenConfigured?: boolean;
  websiteCookie?: string;
  websiteCookieConfigured?: boolean;
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

export type HunonicMeterKind = 'ROOM' | 'BUILDING_TOTAL' | 'EV_CHARGING';

export type HunonicSyncInventory = {
  discovered: number;
  excluded: number;
  rooms: Record<string, number>;
  buildingTotalsByBuilding: Record<string, number>;
  evCharging: number;
  managed: number;
};

export type HunonicSyncStatus = {
  jobId: string;
  status: 'RUNNING' | 'FAILED' | 'SUCCESS';
  percent: number;
  phase: string;
  processed: number;
  total: number;
  result?: {
    metersFound: number;
    metersMatched: number;
    syncedCount: number;
    readingsSaved: number;
    backfillMonths?: number;
    skippedIncompletePoints?: number;
    backfillWarning?: string;
    inventory: HunonicSyncInventory;
  };
  error?: string;
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
  startSync: () => apiClient.post<HunonicSyncStatus>('/hunonic/sync/start'),
  syncStatus: (jobId: string) => apiClient.get<HunonicSyncStatus>('/hunonic/sync/status', { params: { jobId } }),
  syncLogs: (params?: { page?: number; limit?: number }) => apiClient.get('/hunonic/sync-logs', { params }),
  test: (settings: HunonicSettingsPayload) => apiClient.post('/hunonic/test', settings),
};
