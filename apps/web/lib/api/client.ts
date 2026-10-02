import { useAuthStore } from '../auth/auth-store';
import { shouldRecoverSessionFromUnauthorized } from './auth-unauthorized-policy';
import { clearMobileLoginCredentials, readMobileLoginCredentials, shouldUseMobileSessionRecovery } from '../auth/mobile-session-recovery';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001/api/v1';
const REFRESH_LOCK_NAME = 'homeland-auth-refresh';
let refreshPromise: Promise<string | null> | null = null;

export class ApiError extends Error {
  status: number;
  code: string;
  details: any;

  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Fetch a browser-only protected resource with the current Zustand token.
 *
 * This is intentionally response-based (rather than JSON-based) for callers
 * such as SSE that need to consume a stream. A stale access token is retried
 * once after the shared refresh operation succeeds; a failed refresh or a
 * second 401 is the only case that clears the local session.
 */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let attemptedAccessToken = '';
  const requestWithCurrentToken = () => {
    const headers = new Headers(init.headers);
    const accessToken = useAuthStore.getState().accessToken;
    attemptedAccessToken = accessToken || '';

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    } else {
      headers.delete('Authorization');
    }

    return fetch(input, { ...init, headers });
  };

  let response = await requestWithCurrentToken();
  if (response.status !== 401 || typeof window === 'undefined') return response;

  const refreshedToken = await refreshAccessToken(attemptedAccessToken);
  if (!refreshedToken) {
    clearAuthAndRedirect();
    return response;
  }

  response = await requestWithCurrentToken();
  if (response.status === 401) {
    clearAuthAndRedirect();
  }

  return response;
}

export const apiClient = {
  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { params, headers, ...customConfig } = options;
    
    // Keep the attempted token so a concurrent tab refresh can be detected
    // before this tab spends a one-time refresh token.
    const token = typeof window !== 'undefined'
      ? useAuthStore.getState().accessToken || readStoredTokens()?.accessToken || ''
      : '';

    // Attach X-Correlation-ID if on server
    let correlationId = '';
    if (typeof window === 'undefined') {
      try {
        const { headers: nextHeaders } = require('next/headers');
        correlationId = nextHeaders().get('x-correlation-id') || '';
      } catch (e) {
        // Ignore error if not in Next.js app context or similar
      }
    }

    const mergedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
      ...(headers as Record<string, string>),
    };

    if (mergedHeaders['Content-Type'] === 'multipart/form-data' || mergedHeaders['Content-Type'] === 'undefined' || !mergedHeaders['Content-Type']) {
       delete mergedHeaders['Content-Type'];
    }

    const config: RequestInit = {
      ...customConfig,
      headers: mergedHeaders,
    };

    let url = `${BASE_URL}${endpoint}`;
    
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const query = searchParams.toString();
      if (query) {
        url += `?${query}`;
      }
    }

    let response = await fetch(url, config);

    const unauthorizedCode = response.status === 401
      ? await readApiErrorCode(response)
      : undefined;

    if (response.status === 401 && shouldRecoverSessionFromUnauthorized(endpoint, unauthorizedCode)) {
      const refreshedToken = endpoint !== '/auth/refresh' ? await refreshAccessToken(token) : null;
      if (refreshedToken) {
        response = await fetch(url, {
          ...config,
          headers: {
            ...(config.headers as Record<string, string>),
            Authorization: `Bearer ${refreshedToken}`,
          },
        });
      } else {
        const recoveredToken = await recoverMobileSession();
        if (recoveredToken) {
          response = await fetch(url, {
            ...config,
            headers: {
              ...(config.headers as Record<string, string>),
              Authorization: `Bearer ${recoveredToken}`,
            },
          });
        }
      }

      if (response.status === 401) {
        clearAuthAndRedirect();
        throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
      }
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      // If response is not JSON
      if (!response.ok) {
        throw new ApiError(response.status, 'UNKNOWN_ERROR', 'Có lỗi xảy ra');
      }
      return {} as T;
    }

    if (!response.ok || data.success === false) {
      const code = data.error?.code || 'UNKNOWN_ERROR';
      const message = data.error?.message || data.message || 'Có lỗi xảy ra từ máy chủ';
      const details = data.error?.details || data.details;
      throw new ApiError(response.status, code, message, details);
    }

    return data.data as T;
  },

  get<T>(endpoint: string, options?: Omit<FetchOptions, 'method'>) {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, body?: any, options?: Omit<FetchOptions, 'method' | 'body'>) {
    return this.fetch<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
  },

  postForm<T>(endpoint: string, formData: FormData, options?: Omit<FetchOptions, 'method' | 'body'>) {
    const { headers, ...rest } = options || {};
    return this.fetch<T>(endpoint, {
      ...rest,
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'undefined',
        ...headers,
      },
    });
  },

  patch<T>(endpoint: string, body?: any, options?: Omit<FetchOptions, 'method' | 'body'>) {
    return this.fetch<T>(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) });
  },

  put<T>(endpoint: string, body?: any, options?: Omit<FetchOptions, 'method' | 'body'>) {
    return this.fetch<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
  },

  delete<T>(endpoint: string, options?: Omit<FetchOptions, 'method'>) {
    return this.fetch<T>(endpoint, { ...options, method: 'DELETE' });
  },
};

async function refreshAccessToken(staleAccessToken = '') {
  if (typeof window === 'undefined') return null;

  const lockManager = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (lockManager) {
    return lockManager.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, async () => {
      const tokenFromAnotherTab = syncTokensFromStorage(staleAccessToken);
      return tokenFromAnotherTab || refreshWithinThisTab();
    });
  }

  return refreshWithinThisTab();
}

function refreshWithinThisTab() {
  if (!refreshPromise) {
    refreshPromise = runRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function runRefreshToken() {
  // Persisted state can be newer than this tab's in-memory Zustand state.
  const refreshToken = readStoredTokens()?.refreshToken || useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;

    const payload = await response.json();
    const tokens = payload?.data || payload;
    if (!tokens?.accessToken || !tokens?.refreshToken) return null;

    useAuthStore.getState().updateTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    return tokens.accessToken as string;
  } catch {
    return null;
  }
}

async function recoverMobileSession() {
  if (!shouldUseMobileSessionRecovery()) return null;
  const credentials = readMobileLoginCredentials();
  if (!credentials) return null;

  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrPhone: credentials.emailOrPhone,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      clearMobileLoginCredentials();
      return null;
    }

    const payload = await response.json();
    const tokens = payload?.data || payload;
    if (!tokens?.accessToken || !tokens?.refreshToken || !tokens?.user) {
      clearMobileLoginCredentials();
      return null;
    }

    useAuthStore.getState().setSession({
      user: tokens.user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('homeland:auth-session-restored', {
        detail: { source: 'mobile-recovery' },
      }));
    }

    return tokens.accessToken as string;
  } catch {
    return null;
  }
}

async function readApiErrorCode(response: Response) {
  try {
    const payload = await response.clone().json();
    return payload?.error?.code || payload?.code;
  } catch {
    return undefined;
  }
}

function syncTokensFromStorage(staleAccessToken: string) {
  const storedTokens = readStoredTokens();
  if (!storedTokens?.accessToken || !storedTokens.refreshToken || storedTokens.accessToken === staleAccessToken) {
    return null;
  }

  useAuthStore.getState().updateTokens(storedTokens);
  return storedTokens.accessToken;
}

function readStoredTokens(): { accessToken: string; refreshToken: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const authStore = localStorage.getItem('auth-storage');
    if (!authStore) return null;
    const parsed = JSON.parse(authStore);
    const accessToken = parsed?.state?.accessToken;
    const refreshToken = parsed?.state?.refreshToken;
    return typeof accessToken === 'string' && typeof refreshToken === 'string'
      ? { accessToken, refreshToken }
      : null;
  } catch {
    return null;
  }
}

function clearAuthAndRedirect() {
  if (typeof window === 'undefined') return;
  useAuthStore.getState().clearSession();
  localStorage.removeItem('auth-storage');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}
