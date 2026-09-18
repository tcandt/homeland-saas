import { afterEach, describe, expect, it, vi } from 'vitest';
import { HunonicProvider } from './hunonic.provider';

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

function formBody(call: unknown[]) {
  const init = call[1] as RequestInit;
  return Object.fromEntries(Array.from((init.body as FormData).entries()).map(([key, value]) => [key, String(value)]));
}

describe('HunonicProvider electricity rates', () => {
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
      .mockResolvedValueOnce(jsonResponse({ status: true, data: { token_id: 'token-2' } }))
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
});
