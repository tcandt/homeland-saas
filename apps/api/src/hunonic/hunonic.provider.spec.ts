import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let HunonicProvider: typeof import('./hunonic.provider').HunonicProvider;

const mobileSigning = {
  mobileAccessKey: 'test-access-key',
  mobileSecretKey: 'test-secret-key',
};

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function response(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formBody(call: unknown[]) {
  const init = call[1] as RequestInit;
  return Object.fromEntries(Array.from((init.body as FormData).entries()).map(([key, value]) => [key, String(value)]));
}

describe('HunonicProvider electricity rates', () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ HunonicProvider } = await import('./hunonic.provider'));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reuses one login and sends a complete custom-rate payload', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, data: { token_id: 'token-1' } }))
      .mockResolvedValueOnce(jsonResponse({
        status: true,
        data: [{
          id: 1,
          name: 'Tự thiết lập',
          electricity_rate: [{ id: 11, min_rate: 0, max_rate: 0, name: 'Giá riêng', price: 3000 }],
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ status: true }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new HunonicProvider({ username: '0900000000', password: 'secret', ...mobileSigning });
    await expect(provider.applyElectricityRate('root-1', 'custom', 3500)).resolves.toEqual({ status: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/user/login');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/atmwifi/electricityRate');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/atmwifi/addElectricityRate');

    const payload = formBody(fetchMock.mock.calls[2]);
    expect(payload).toMatchObject({
      token_id: 'token-1',
      root_id: 'root-1',
      electricity_group_id: '1',
      electricity_group_name: 'Tự thiết lập',
      rate: '3500',
      price: '3500',
      money: '3500',
    });
    expect(JSON.parse(payload.electricity_rate)).toEqual([
      expect.objectContaining({ id: '11', min_rate: 0, max_rate: 0, price: 3500 }),
    ]);
    expect(JSON.parse(payload.root_extra)).toEqual(expect.objectContaining({
      electricity_group_id: '1',
      rate: 3500,
      price: 3500,
      money: 3500,
    }));
  });

  it('preserves the provider residential steps when switching to EVN mode', async () => {
    const residentialRates = [
      { id: 21, min_rate: 0, max_rate: 50, name: 'Bậc 1', price: 1984 },
      { id: 22, min_rate: 51, max_rate: 100, name: 'Bậc 2', price: 2050 },
    ];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'token-2' }))
      .mockResolvedValueOnce(jsonResponse({
        status: true,
        data: [{ id: 2, name: 'Sinh hoạt', electricity_rate: residentialRates }],
      }))
      .mockResolvedValueOnce(jsonResponse({ status: true }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new HunonicProvider({ username: '0900000000', password: 'secret', ...mobileSigning });
    await provider.applyElectricityRate('root-2', 'residential');

    const payload = formBody(fetchMock.mock.calls[2]);
    expect(payload.electricity_group_id).toBe('2');
    expect(payload.electricity_group_name).toBe('Sinh hoạt');
    expect(payload).not.toHaveProperty('price');
    expect(JSON.parse(payload.electricity_rate)).toEqual([
      expect.objectContaining({ id: '21', min_rate: 0, max_rate: 50, price: 1984 }),
      expect.objectContaining({ id: '22', min_rate: 51, max_rate: 100, price: 2050 }),
    ]);
  });

  it('does not overwrite EVN pricing when Hunonic omits the residential group', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'token-3' }))
      .mockResolvedValueOnce(jsonResponse({ status: true, data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new HunonicProvider({ username: '0900000000', password: 'secret', ...mobileSigning });
    await expect(provider.applyElectricityRate('root-3', 'residential')).rejects.toThrow(
      'Hunonic residential electricity rate group was not found.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite EVN pricing when the residential group has no rate steps', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'token-4' }))
      .mockResolvedValueOnce(jsonResponse({
        status: true,
        data: [{ id: 2, name: 'Sinh hoạt', electricity_rate: [] }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new HunonicProvider({ username: '0900000000', password: 'secret', ...mobileSigning });
    await expect(provider.applyElectricityRate('root-4', 'residential')).rejects.toThrow(
      'Hunonic residential electricity rates are empty.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a zero-valued graph point as a Hunonic monthly observation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T00:00:00.000Z'));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, data: { token_id: 'token-1' } }))
      .mockResolvedValueOnce(jsonResponse({
        status: true,
        data: [{ id: 'home-1', rooms: [{ id: 'room-1', devices: [{ id: 'device-1', root_id: 'root-1', root_type: 'elmeter', name: 'Meter 1' }] }] }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: true,
        data: { graph_data: [{ label: '2026-07', value: 1.5 }, { label: '2026-08', value: 0, amount: 0 }, { label: '2026-09', value: 2.5, amount: 10000 }] },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new HunonicProvider({ username: '0900000000', password: 'secret', ...mobileSigning });
    const result = await provider.fetchRecentMonthlyHistory(3);

    expect(result.history).toEqual(expect.arrayContaining([
      expect.objectContaining({ period: '2026-08', energy_month_kwh: 0, money_month_vnd: 0 }),
      expect.objectContaining({ period: '2026-09', energy_month_kwh: 2.5, money_month_vnd: 10000 }),
    ]));
    expect(result.skippedIncompletePoints).toBe(1);
  });

  it('shares one login across concurrent instances, 37 sequential rate reads, and concurrent history graph/rate reads', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/user/login')) return Promise.resolve(jsonResponse({ status: true, token_id: 'shared-token' }));
      if (url.includes('/device/listDeviceByHome')) return Promise.resolve(jsonResponse({
        status: true,
        data: [{ id: 'home', rooms: [{ id: 'room', devices: [{ id: 'device', root_id: 'graph-root', root_type: 'elmeter', name: 'Meter' }] }] }],
      }));
      if (url.includes('/atmwifi/getDataGraph')) return Promise.resolve(jsonResponse({ status: true, data: { graph_data: [] } }));
      return Promise.resolve(jsonResponse({ status: true, data: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const first = new HunonicProvider({ username: 'shared', password: 'secret', ...mobileSigning });
    const second = new HunonicProvider({ username: 'shared', password: 'secret', ...mobileSigning });

    await Promise.all([first.fetchElectricityRateGroups('root-a'), second.fetchElectricityRateGroups('root-b')]);
    for (let index = 0; index < 37; index += 1) await first.fetchElectricityRateGroups(`root-${index}`);
    await Promise.all([first.fetchRecentMonthlyHistory(1), second.fetchElectricityRateGroups('root-final')]);

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/user/login'))).toHaveLength(1);
    const graphCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/atmwifi/getDataGraph'));
    const rateCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/atmwifi/electricityRate'));
    expect(graphCall).toBeDefined();
    expect(formBody(graphCall!)).toMatchObject({ token_id: 'shared-token', root_id: 'graph-root' });
    expect(rateCalls.every((call) => formBody(call).token_id === 'shared-token')).toBe(true);
  });

  it('expires the shared session at the 30-minute TTL and isolates credential and endpoint fingerprints', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T00:00:00.000Z'));
    let loginCount = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/user/login')) return Promise.resolve(jsonResponse({ status: true, token_id: `token-${++loginCount}` }));
      return Promise.resolve(jsonResponse({ status: true, data: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const options = { username: 'same', password: 'secret', ...mobileSigning };
    const primary = new HunonicProvider(options);
    await primary.fetchElectricityRateGroups('root');
    await primary.fetchElectricityRateGroups('root');
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    await primary.fetchElectricityRateGroups('root');
    await Promise.all([
      new HunonicProvider({ ...options, username: 'other' }).fetchElectricityRateGroups('root'),
      new HunonicProvider({ ...options, password: 'other' }).fetchElectricityRateGroups('root'),
      new HunonicProvider({ ...options, baseUrl: 'https://alternate.example/v2' }).fetchElectricityRateGroups('root'),
      new HunonicProvider({ ...options, mobileAccessKey: 'other-key' }).fetchElectricityRateGroups('root'),
      new HunonicProvider({ ...options, mobileSecretKey: 'other-secret' }).fetchElectricityRateGroups('root'),
      new HunonicProvider({ ...options, accountKey: 'email' }).fetchElectricityRateGroups('root'),
    ]);
    expect(loginCount).toBe(8);
  });

  it.each([
    ['HTTP 401', () => response(401, { status: false })],
    ['HTTP 403', () => response(403, { status: false })],
    ['provider error_code 40', () => jsonResponse({ status: false, error_code: 40 })],
  ])('replays an auth-invalid read exactly once for %s', async (_name, staleResponse) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'old' }))
      .mockResolvedValueOnce(staleResponse())
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'new' }))
      .mockResolvedValueOnce(jsonResponse({ status: true, data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new HunonicProvider({ username: 'retry', password: 'secret', ...mobileSigning })
      .fetchElectricityRateGroups('root')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(formBody(fetchMock.mock.calls[1]).token_id).toBe('old');
    expect(formBody(fetchMock.mock.calls[3]).token_id).toBe('new');
  });

  it('stops after the second auth-invalid read without a third login or replay', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'old' }))
      .mockResolvedValueOnce(jsonResponse({ status: false, error_code: 40 }))
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'new' }))
      .mockResolvedValueOnce(response(401, { status: false }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new HunonicProvider({ username: 'retry-twice', password: 'secret', ...mobileSigning })
      .fetchElectricityRateGroups('root')).rejects.toThrow('Hunonic electricityRate failed');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/user/login'))).toHaveLength(2);
  });

  it('coalesces concurrent stale-token refreshes and a delayed old failure cannot evict the newer token', async () => {
    let firstStale!: (value: Response) => void;
    let secondStale!: (value: Response) => void;
    const firstPending = new Promise<Response>((resolve) => { firstStale = resolve; });
    const secondPending = new Promise<Response>((resolve) => { secondStale = resolve; });
    let rateCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/user/login')) return Promise.resolve(jsonResponse({ status: true, token_id: fetchMock.mock.calls.filter(([call]) => String(call).includes('/user/login')).length === 1 ? 'old' : 'new' }));
      rateCalls += 1;
      if (rateCalls === 1) return firstPending;
      if (rateCalls === 2) return secondPending;
      return Promise.resolve(jsonResponse({ status: true, data: [] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const a = new HunonicProvider({ username: 'race', password: 'secret', ...mobileSigning });
    const b = new HunonicProvider({ username: 'race', password: 'secret', ...mobileSigning });
    const pendingA = a.fetchElectricityRateGroups('a');
    const pendingB = b.fetchElectricityRateGroups('b');
    await vi.waitFor(() => expect(rateCalls).toBe(2));
    firstStale(jsonResponse({ status: false, error_code: 40 }));
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/user/login'))).toHaveLength(2));
    secondStale(jsonResponse({ status: false, error_code: 40 }));
    await expect(Promise.all([pendingA, pendingB])).resolves.toEqual([[], []]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/user/login'))).toHaveLength(2);
  });

  it('removes a failed refresh so a later read can recover, while a non-auth HTTP failure is not replayed', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'old' }))
      .mockResolvedValueOnce(jsonResponse({ status: false, error_code: 40 }))
      .mockResolvedValueOnce(jsonResponse({ status: false, message: 'refresh rejected' }))
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'recovered' }))
      .mockResolvedValueOnce(jsonResponse({ status: true, data: [] }))
      .mockResolvedValueOnce(response(500, { status: false }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new HunonicProvider({ username: 'recover', password: 'secret', ...mobileSigning });
    await expect(provider.fetchElectricityRateGroups('root')).rejects.toThrow('Hunonic login failed');
    await expect(provider.fetchElectricityRateGroups('root')).resolves.toEqual([]);
    await expect(provider.fetchElectricityRateGroups('root')).rejects.toThrow('Hunonic electricityRate failed');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('does not replay a transport rejection', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'transport-token' }))
      .mockRejectedValueOnce(new Error('socket reset'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new HunonicProvider({ username: 'transport', password: 'secret', ...mobileSigning })
      .fetchElectricityRateGroups('root')).rejects.toThrow('Hunonic request failed: socket reset');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never retries writes after auth failure, while a write following a read refresh uses the new token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'old' }))
      .mockResolvedValueOnce(jsonResponse({ status: false, error_code: 40 }))
      .mockResolvedValueOnce(jsonResponse({ status: true, token_id: 'new' }))
      .mockResolvedValueOnce(jsonResponse({ status: true, data: [{ id: 1, name: 'Tự thiết lập', electricity_rate: [] }] }))
      .mockResolvedValueOnce(jsonResponse({ status: false, error_code: 40 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new HunonicProvider({ username: 'writer', password: 'secret', ...mobileSigning });
    await expect(provider.applyElectricityRate('root', 'custom', 3000)).rejects.toThrow('Hunonic addElectricityRate failed');
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(formBody(fetchMock.mock.calls[4]).token_id).toBe('new');
    expect(String(fetchMock.mock.calls[4][0])).toContain('/atmwifi/addElectricityRate');
  });
});
