export const LOGIN_VERSION_CHECK_REQUEST_KEY = "homeland_system_update_check_after_login";

export function requestLoginVersionCheck(userId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    LOGIN_VERSION_CHECK_REQUEST_KEY,
    JSON.stringify({ userId, requestedAt: new Date().toISOString() }),
  );
}
