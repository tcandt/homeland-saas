import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../auth/auth-store';
import { authenticatedFetch } from './client';

const defaultClearSession = useAuthStore.getState().clearSession;

describe('authenticatedFetch', () => {
  let storedAuth: string | null;

  beforeEach(() => {
    storedAuth = null;
    const storage = {
      getItem: vi.fn((key: string) => key === 'auth-storage' ? storedAuth : null),
      removeItem: vi.fn((key: string) => {
        if (key === 'auth-storage') storedAuth = null;
      }),
      setItem: vi.fn((key: string, value: string) => {
        if (key === 'auth-storage') storedAuth = value;
      }),
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { location: { pathname: '/dashboard', href: '' }, localStorage: storage });
    useAuthStore.setState({
      user: { id: 'user-1' } as any,
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
      isAuthenticated: true,
      clearSession: defaultClearSession,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('retries with a refreshed token without clearing the session', async () => {
    const clearSession = vi.spyOn(useAuthStore.getState(), 'clearSession');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { accessToken: 'fresh-access-token', refreshToken: 'fresh-refresh-token' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ count: 2 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await authenticatedFetch('/api/v1/notifications/unread-count');

    expect(response.status).toBe(200);
    expect(clearSession).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[2][1]?.headers as Headers).get('Authorization')).toBe('Bearer fresh-access-token');
  });

  it('clears the session when the refresh request fails', async () => {
    const clearSession = vi.spyOn(useAuthStore.getState(), 'clearSession').mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await authenticatedFetch('/api/v1/notifications/unread-count');

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('uses tokens persisted by another tab while waiting for the refresh lock', async () => {
    const clearSession = vi.spyOn(useAuthStore.getState(), 'clearSession');
    const requestLock = vi.fn(async (_name: string, _options: unknown, callback: () => Promise<string | null>) => {
      storedAuth = JSON.stringify({
        state: { accessToken: 'other-tab-access-token', refreshToken: 'other-tab-refresh-token' },
      });
      return callback();
    });
    vi.stubGlobal('navigator', { locks: { request: requestLock } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ count: 2 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await authenticatedFetch('/api/v1/notifications/unread-count');

    expect(response.status).toBe(200);
    expect(requestLock).toHaveBeenCalledWith('homeland-auth-refresh', { mode: 'exclusive' }, expect.any(Function));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1]?.headers as Headers).get('Authorization')).toBe('Bearer other-tab-access-token');
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('clears the session when the one allowed retry is still unauthorized', async () => {
    const clearSession = vi.spyOn(useAuthStore.getState(), 'clearSession').mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { accessToken: 'fresh-access-token', refreshToken: 'fresh-refresh-token' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await authenticatedFetch('/api/v1/notifications/unread-count');

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});
