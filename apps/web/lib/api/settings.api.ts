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

  testEmail: (payload: { recipient: string; title?: string; message?: string }) => {
    return apiClient.post<{ success: true; recipient: string; result: any }>('/notifications/email/test', payload);
  },

  testTelegram: (payload: { recipient?: string; title?: string; message?: string }) => {
    return apiClient.post<{ success: true; recipient: string | null; result: any }>('/notifications/telegram/test', payload);
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
