import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { getInternalApiBaseUrl, requireRoutePermission } from './route-auth';

describe('route-auth getInternalApiBaseUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.INTERNAL_API_ORIGIN;
    delete process.env.INTERNAL_API_URL;
    delete process.env.API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('uses INTERNAL_API_ORIGIN with /api/v1 appended when missing', () => {
    process.env.INTERNAL_API_ORIGIN = 'http://api:39101';
    expect(getInternalApiBaseUrl()).toBe('http://api:39101/api/v1');
  });

  it('uses INTERNAL_API_ORIGIN without duplicate /api/v1 when already included', () => {
    process.env.INTERNAL_API_ORIGIN = 'http://api:39101/api/v1/';
    expect(getInternalApiBaseUrl()).toBe('http://api:39101/api/v1');
  });

  it('uses NEXT_PUBLIC_API_URL when it starts with http', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/api/v1/';
    expect(getInternalApiBaseUrl()).toBe('https://api.example.com/api/v1');
  });

  it('falls back to 127.0.0.1:3001/api/v1 when NEXT_PUBLIC_API_URL is relative and no internal origin', () => {
    process.env.NEXT_PUBLIC_API_URL = '/api/v1';
    expect(getInternalApiBaseUrl()).toBe('http://127.0.0.1:3001/api/v1');
  });

  it('prioritizes INTERNAL_API_ORIGIN over relative NEXT_PUBLIC_API_URL', () => {
    process.env.NEXT_PUBLIC_API_URL = '/api/v1';
    process.env.INTERNAL_API_ORIGIN = 'http://api:3001';
    expect(getInternalApiBaseUrl()).toBe('http://api:3001/api/v1');
  });
});

describe('requireRoutePermission', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.INTERNAL_API_ORIGIN = 'http://api:3001';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns 401 UNAUTHORIZED if authorization header is missing or invalid', async () => {
    const req = new Request('http://localhost/api/test');
    const result = await requireRoutePermission(req, 'contract.read');
    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(401);
    }
  });

  it('calls auth/me at internal api URL and verifies permissions', async () => {
    const mockUser = {
      roles: ['MANAGER'],
      permissions: ['contract.read'],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockUser }), { status: 200 })
    );

    const req = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer valid_token' },
    });

    const result = await requireRoutePermission(req, 'contract.read');
    expect(fetchSpy).toHaveBeenCalledWith('http://api:3001/api/v1/auth/me', expect.anything());
    expect('user' in result).toBe(true);
    if ('user' in result) {
      expect(result.user.roles).toContain('MANAGER');
    }
  });

  it('returns 403 FORBIDDEN if user lacks required permission and is not ADMIN', async () => {
    const mockUser = {
      roles: ['SALES'],
      permissions: ['other.permission'],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockUser }), { status: 200 })
    );

    const req = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer valid_token' },
    });

    const result = await requireRoutePermission(req, 'contract.read');
    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(403);
    }
  });

  it('allows ADMIN role regardless of individual permission keys', async () => {
    const mockUser = {
      roles: ['ADMIN'],
      permissions: [],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockUser }), { status: 200 })
    );

    const req = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer valid_token' },
    });

    const result = await requireRoutePermission(req, 'contract.read');
    expect('user' in result).toBe(true);
  });
});
