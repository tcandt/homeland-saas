import { apiClient } from './client';

export type SettingsScope = 'TENANT' | 'USER';

export interface SettingsSectionResponse<T = any> {
  key: string;
  scope: SettingsScope;
  value: T;
  updatedAt: string;
}

export type PublicAccessControl = {
  registrationEnabled: boolean;
  maintenanceEnabled: boolean;
};

export const settingsApi = {
  getPublicAccessControl: () => {
    return apiClient.get<PublicAccessControl>('/settings/public/access-control');
  },

  getSection: <T = any>(key: string, scope: SettingsScope = 'TENANT') => {
    return apiClient.get<SettingsSectionResponse<T>>(`/settings/${key}`, { params: { scope } });
  },

  saveSection: <T = any>(key: string, value: T, scope: SettingsScope = 'TENANT') => {
    return apiClient.patch<SettingsSectionResponse<T>>(`/settings/${key}`, { scope, value });
  },

  testZalo: (payload: { recipient: string; title?: string; message?: string }) => {
    return apiClient.post<{ success: true; recipient: string; result: any }>('/notifications/zalo/test', payload);
  },

  getZaloStatus: () => {
    return apiClient.get<{ success: true; status: any }>('/notifications/zalo/status');
  },

  testZaloBot: () => {
    return apiClient.post<{ success: true; result: any }>('/notifications/zalo/test-bot', {});
  },

  testZaloAdminGroup: (payload?: { message?: string }) => {
    return apiClient.post<{ success: true; recipient: string; result: any }>('/notifications/zalo/test-admin-group', payload || {});
  },

  autoDetectZaloAdminGroup: () => {
    return apiClient.post<{ success: true; chat: any }>('/notifications/zalo/auto-detect-admin-group', {});
  },

  generateZaloAdminGroupSetupCode: () => {
    return apiClient.post<{ success: true; code: string; expiresAt: string; command: string }>('/notifications/zalo/admin-group/setup-code', {});
  },

  clearZaloAdminGroup: () => {
    return apiClient.delete<{ success: true }>('/notifications/zalo/admin-group');
  },

  connectZaloWebhook: () => {
    return apiClient.post<{ success: true; webhookUrl: string; result: any }>('/notifications/zalo/connect-webhook', {});
  },

  testZaloEndpoint: () => {
    return apiClient.post<{ success: boolean; webhookUrl: string; webhookSecretConfigured: boolean; botTokenConfigured: boolean }>('/notifications/zalo/test-endpoint', {});
  },

  testEmail: (payload: { recipient: string; title?: string; message?: string }) => {
    return apiClient.post<{ success: true; recipient: string; result: any }>('/notifications/email/test', payload);
  },

  testTelegram: (payload: { recipient?: string; title?: string; message?: string }) => {
    return apiClient.post<{ success: true; recipient: string | null; result: any }>('/notifications/telegram/test', payload);
  },

  getSePayStatus: () => {
    return apiClient.get<{ success: true; status: any }>('/payments/sepay/status');
  },

  getSePayAdminConfig: () => {
    return apiClient.get<{ success: true; config: any }>('/payments/sepay/admin-config');
  },

  saveSePayRouting: (payload: { assignments: Array<{ roomId: string; bankAccountId: string; validFrom?: string | null; validTo?: string | null; note?: string | null }> }) => {
    return apiClient.post<{ success: true; config: any }>('/payments/sepay/routing', payload);
  },

  testSePayQr: (payload?: { amount?: number; memo?: string; roomId?: string; bankAccountId?: string }) => {
    return apiClient.post<{ success: true; preview: any }>('/payments/sepay/test-qr', payload || {});
  },

  sendSePayQrToAdmin: (payload?: { amount?: number; memo?: string; roomId?: string; bankAccountId?: string }) => {
    return apiClient.post<{ success: true; preview: any; recipient: string }>('/payments/sepay/test-qr/send-admin', payload || {});
  },

  testSePayReconciliation: (payload: any) => {
    return apiClient.post<{ success: true; result: any }>('/payments/sepay/test-reconciliation', payload);
  },

  uploadAsset: async (file: File, params: { folder: string; purpose?: string; scope?: SettingsScope }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', params.folder);
    if (params.purpose) formData.append('purpose', params.purpose);
    if (params.scope) formData.append('scope', params.scope);
    return apiClient.postForm<{ url: string; dataUrl: string; size: number; mimeType: string; scope: SettingsScope; folder: string }>('/settings/upload', formData);
  },
};
