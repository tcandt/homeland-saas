import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { settingsApi, SettingsScope } from '@/lib/api/settings.api';

export function useSettingsSection<T extends Record<string, any>>(
  key: string,
  scope: SettingsScope = 'TENANT',
  fallback: T
) {
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const fetchKey = useMemo(() => ['settings-section', key, scope] as const, [key, scope]);
  const { data, isLoading, mutate } = useSWR(fetchKey, () => settingsApi.getSection<T>(key, scope), {
    revalidateOnFocus: false,
  });

  const [draft, setDraft] = useState<T>(fallback);
  const [isSaving, setIsSaving] = useState(false);

  // Sync draft only when fetched data value changes
  useEffect(() => {
    if (data?.value) {
      setDraft({ ...fallbackRef.current, ...(data.value as T) });
    } else {
      setDraft(fallbackRef.current);
    }
  }, [data?.value]);

  const save = async (nextValue?: T) => {
    setIsSaving(true);
    try {
      const payload = nextValue ?? draft;
      const saved = await settingsApi.saveSection(key, payload, scope);
      await mutate(saved, { revalidate: false });
      toast.success('Đã lưu cài đặt');
      setDraft(saved?.value ? { ...fallbackRef.current, ...(saved.value as T) } : payload);
      return saved;
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu cài đặt');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    data: data?.value ?? fallbackRef.current,
    draft,
    setDraft,
    isLoading,
    isSaving,
    save,
    mutate,
  };
}
