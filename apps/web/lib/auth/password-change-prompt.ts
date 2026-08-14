const STORAGE_PREFIX = 'homeland:password-change-deferred:';

export function getPasswordChangePromptKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function isPasswordChangePromptDeferred(userId: string) {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(getPasswordChangePromptKey(userId)) === '1';
}

export function deferPasswordChangePrompt(userId: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(getPasswordChangePromptKey(userId), '1');
}

export function clearPasswordChangePromptDeferral(userId: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(getPasswordChangePromptKey(userId));
}

export function shouldShowPasswordChangePrompt(
  mustChangePassword: boolean,
  deferredForSession: boolean,
  pathname: string,
) {
  return mustChangePassword && !deferredForSession && pathname !== '/change-password';
}
