import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { settingsApi, SettingsScope } from '@/lib/api/settings.api';

export function useSettingsSection<T extends Record<string, any>>(key: string, scope: SettingsScope = 'TENANT', fallback: T) {
  const fetchKey = useMemo(() => ['settings-section', key, scope] as const, [key, scope]);
  const { data, isLoading, mutate } = useSWR(fetchKey, () => settingsApi.getSection<T>(key, scope), {
    revalidateOnFocus: false,
  });

  const [draft, setDraft] = useState<T>(fallback);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (data?.value) {
      setDraft({ ...fallback, ...(data.value as T) });
    } else {
      setDraft(fallback);
    }
  }, [data, fallback]);

  const save = async (nextValue?: T) => {
    setIsSaving(true);
    try {
      const payload = nextValue ?? draft;
      const saved = await settingsApi.saveSection(key, payload, scope);
      await mutate(saved, { revalidate: false });
      toast.success('Đã lưu cài đặt');
      setDraft(saved?.value ? { ...fallback, ...(saved.value as T) } : payload);
      return saved;
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu cài đặt');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    data: data?.value ?? fallback,
    draft,
    setDraft,
    isLoading,
    isSaving,
    save,
    mutate,
  };
}
