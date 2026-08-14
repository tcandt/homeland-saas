const AUTH_401_PASSTHROUGH_ENDPOINTS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
]);

export function shouldRecoverSessionFromUnauthorized(endpoint: string, errorCode?: string) {
  if (AUTH_401_PASSTHROUGH_ENDPOINTS.has(endpoint)) return false;

  if (endpoint === '/auth/change-password' && errorCode === 'AUTH_INVALID_CREDENTIALS') {
    return false;
  }

  return true;
}
