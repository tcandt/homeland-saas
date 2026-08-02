import { apiClient } from './client';

export type SettingsScope = 'TENANT' | 'USER';

export interface SettingsSectionResponse<T = any> {
  key: string;
  scope: SettingsScope;
  value: T;
  updatedAt: string;
}

export const settingsApi = {
  getSection: <T = any>(key: string, scope: SettingsScope = 'TENANT') => {
    return apiClient.get<SettingsSectionResponse<T>>(`/settings/${key}`, { params: { scope } });
  },

  saveSection: <T = any>(key: string, value: T, scope: SettingsScope = 'TENANT') => {
    return apiClient.patch<SettingsSectionResponse<T>>(`/settings/${key}`, { scope, value });
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
