import { useQuery } from '@tanstack/react-query';
import { authApi, type CurrentUserProfile } from '../api/auth.api';

export const authKeys = {
  all: ['auth'] as const,
  me: (token?: string | null) => [...authKeys.all, 'me', token ?? 'anonymous'] as const,
};

export function useCurrentUserQuery(accessToken?: string | null, enabled = true) {
  return useQuery<CurrentUserProfile>({
    queryKey: authKeys.me(accessToken),
    queryFn: async () => {
      const response = await authApi.me();
      return response;
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 5 * 60 * 1000,
  });
}
