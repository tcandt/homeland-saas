import { useQuery } from '@tanstack/react-query';
import { settingsApi, type SettingsScope } from '../api/settings.api';

export const settingsKeys = {
  all: ['settings'] as const,
  section: (key: string, scope: SettingsScope = 'TENANT') => [...settingsKeys.all, key, scope] as const,
};

export function useSettingsSectionQuery<T = any>(key: string, scope: SettingsScope = 'TENANT', enabled = true) {
  return useQuery({
    queryKey: settingsKeys.section(key, scope),
    queryFn: () => settingsApi.getSection<T>(key, scope),
    enabled,
    staleTime: 60 * 1000,
  });
}
