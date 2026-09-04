import { useAuthStore } from "./auth-store";

export function getAuthorizationHeader(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
