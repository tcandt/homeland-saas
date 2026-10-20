import { afterEach, describe, expect, it, vi } from 'vitest';
import { HunonicService } from './hunonic.service';
import { HunonicProvider } from './hunonic.provider';

function fixture() {
  const buildings = ['31', '32', '24', '25'].map((number) => ({
    id: `b${number}`, code: `${Number(number) < 30 ? 'LK08' : 'LK01'}.${number}`, name: number,
    rooms: Array.from({ length: Number(number) < 30 ? 10 : 7 }, (_, index) => ({
      id: `r${number}-${index + 1}`, code: `${Number(number) < 30 ? 'P' : 'PN '}${number}-${String(index + 1).padStart(2, '0')}`, name: '',
    })),
  }));
  const names = buildings.flatMap((building) => building.rooms.map((room) => `P${room.code.match(/\d+-\d+/)![0]}`));
  names.push('Tổng LK08-24', 'Tổng LK08-25', 'Ổ CẮM TRỆT', 'EVN', 'NLMT');
  const meters = names.map((name, index) => ({
    provider_meter_id: `provider-${index}`, provider_root_id: `provider-${index}`, name,
    home_name: index >= 37 ? 'Nhà của Tính' : name.includes('31') || name.includes('32') ? 'LK01 - ÂN PHÚ' : 'LK08 - ÂN PHÚ',
    room_name: 'CÔNG TƠ', status: 'on', energy_month_kwh: 10, money_month_vnd: 35000,
    energy_prev_month_kwh: null, money_prev_month_vnd: null, updated_at: '2026-10-20T01:00:00.000Z',
  }));
  const logs: any[] = [];
  const mappings: any[] = [];
  const messages: any[] = [];
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => row[key] === value);
  const prisma: any = {
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: { enabled: true, autoLockPreviousMonth: false } }) },
    building: { findMany: vi.fn().mockResolvedValue(buildings) },
    hunonicSyncLog: {
      create: vi.fn(async ({ data }) => { const row = { id: `job-${logs.length}`, ...data }; logs.push(row); return { ...row }; }),
      findMany: vi.fn(async ({ where }) => logs.filter((row) => matches(row, where)).map((row) => ({ ...row }))),
      findFirst: vi.fn(async ({ where }) => { const row = logs.find((item) => matches(item, where)); return row ? { ...row } : null; }),
      updateMany: vi.fn(async ({ where, data }) => {
        const rows = logs.filter((row) => matches(row, where));
        for (const row of rows) { Object.assign(row, data); if (data.message) messages.push(JSON.parse(data.message)); }
        return { count: rows.length };
      }),
    },
    hunonicMeterMapping: {
      findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }) => { const row = { id: `mapping-${mappings.length}`, readings: [], ...data }; mappings.push(row); return row; }),
      findMany: vi.fn(async () => mappings), update: vi.fn(),
    },
    hunonicMeterReading: { createMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new HunonicService(prisma), buildings, meters, logs, mappings, messages };
}

afterEach(() => vi.restoreAllMocks());

describe('Hunonic inventory and persisted progress', () => {
  it('syncs all 37 managed devices, excludes 2 private meters and sums only 34 rooms', async () => {
    const f = fixture();
    vi.spyOn(HunonicProvider.prototype, 'fetchRecentMonthlyHistory').mockImplementation(async (_months, options) => {
      await options?.onProgress?.({ completed: 37, total: 37 });
      return { dashboard: { electric_meters: f.meters, exported_at: '2026-10-20T01:00:00Z', source: 'mobile' } as any, history: [], skippedIncompletePoints: 0 };
    });
    await f.service.syncTenant('tenant', undefined, { backfillMonths: 6 });
    const status = await f.service.getSyncStatus('tenant', f.logs[0].id);
    expect(status).toMatchObject({ status: 'SUCCESS', percent: 100, result: { syncedCount: 37, inventory: {
      managed: 37, discovered: 39, excluded: 2, rooms: { 'LK01.31': 7, 'LK01.32': 7, 'LK08.24': 10, 'LK08.25': 10 },
      buildingTotalsByBuilding: { 'LK08.24': 1, 'LK08.25': 1 }, evCharging: 1,
    } } });
    expect(f.mappings).toHaveLength(37);
    expect(f.mappings.filter((mapping) => !mapping.roomId)).toHaveLength(3);
    const overview = await f.service.getOverview('tenant', { allowAutoLock: false });
    expect(overview.summary).toMatchObject({ mappings: 37, roomMeters: 34, totalEnergyMonthKwh: 340, totalMoneyMonthVnd: 1190000 });
    expect(overview.meters[0]).toMatchObject({ roomCode: 'PN 31-01', displayName: 'P31.01' });
    const progress = f.messages.map((message) => message.percent);
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1])).toBe(true);
    expect(progress.slice(0, -1).every((value) => value < 100)).toBe(true);
  });

  it('rejects invalid timestamps before any mapping/reading writes and never reports success', async () => {
    const f = fixture();
    f.meters[0].updated_at = 'invalid';
    vi.spyOn(HunonicProvider.prototype, 'fetchDashboardData').mockResolvedValue({ electric_meters: f.meters, exported_at: '2026-10-20', source: 'mobile' } as any);
    await expect(f.service.syncTenant('tenant', undefined, { backfillMonths: 0 })).rejects.toThrow('HUNONIC_INVALID_READING_TIMESTAMP');
    expect(f.prisma.hunonicMeterMapping.create).not.toHaveBeenCalled();
    expect(f.logs[0].status).toBe('FAILED');
  });

  it('rejects duplicate identities before writes', async () => {
    const f = fixture();
    f.meters[1].provider_meter_id = f.meters[0].provider_meter_id;
    vi.spyOn(HunonicProvider.prototype, 'fetchDashboardData').mockResolvedValue({ electric_meters: f.meters, exported_at: '2026-10-20' } as any);
    await expect(f.service.syncTenant('tenant', undefined, { backfillMonths: 0 })).rejects.toThrow('HUNONIC_DUPLICATE_PROVIDER_METER');
    expect(f.prisma.hunonicMeterMapping.create).not.toHaveBeenCalled();
  });

  it('preserves immutable legacy total scope and refuses a shared meter bound to a billable room', async () => {
    const f = fixture();
    const existing = { id: 'legacy-total', buildingCode: 'LK08.24', roomCode: 'PN 08-25', roomId: null };
    f.prisma.hunonicMeterMapping.findUnique.mockResolvedValue(existing);
    f.prisma.hunonicMeterMapping.update.mockResolvedValue(existing);
    const upsert = (roomId?: string) => (f.service as any).upsertMeterMappingByRoom('tenant', 'provider', {},
      { buildingCode: 'LK08.25', roomCode: 'TOTAL-25', meterKind: 'BUILDING_TOTAL', displayName: 'Total25' },
      { name: 'Tổng LK08-25', status: 'on', energy_month_kwh: 1 }, new Date());
    await upsert();
    const data = f.prisma.hunonicMeterMapping.update.mock.calls[0][0].data;
    for (const key of ['buildingId', 'roomId', 'buildingCode', 'roomCode']) expect(data).not.toHaveProperty(key);
    f.prisma.hunonicMeterMapping.update.mockClear();
    f.prisma.hunonicMeterMapping.findUnique.mockResolvedValue({ ...existing, roomId: 'billable-room' });
    await expect(upsert()).rejects.toThrow('HUNONIC_SHARED_METER_ROOM_BINDING_REQUIRES_REVIEW');
    expect(f.prisma.hunonicMeterMapping.update).not.toHaveBeenCalled();
  });

  it('uses semantic mapping IDs to include legacy total25 in LK08.25 history without changing evidence', async () => {
    const f = fixture();
    const mapping = { id: 'total25', buildingCode: 'LK08.24', roomCode: 'PN 08-25', deviceName: 'Tổng LK08-25', homeName: 'LK08 - ÂN PHÚ', roomName: 'CÔNG TƠ' };
    f.prisma.hunonicMeterMapping.findMany.mockResolvedValue([mapping]);
    f.prisma.hunonicMeterReading.findMany.mockResolvedValue([{ id: 'reading', meterMappingId: 'total25', meterMapping: mapping,
      sourcePeriod: '2026-10', readingAt: new Date(), createdAt: new Date(), energyMonthKwh: 200, moneyMonthVnd: 700000 }]);
    const result = await f.service.getHistory('tenant', { buildingCode: 'LK08.25', year: '2026', month: '10' });
    const where = f.prisma.hunonicMeterReading.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('tenant');
    expect(where.meterMapping.OR[1]).toEqual({ id: { in: ['total25'] } });
    expect(result.monthlyRows[0]).toMatchObject({ buildingCode: 'LK08.25', roomCode: 'TOTAL-25', meterKind: 'BUILDING_TOTAL' });
    expect(result.summary.totalEnergyMonthKwh).toBe(0);
  });

  it('expires a stale job on status, rejects cross-tenant access and fences a retired worker', async () => {
    const f = fixture();
    f.logs.push({ id: 'stale', tenantId: 'tenant', status: 'RUNNING', startedAt: new Date(0), message: null });
    await expect(f.service.getSyncStatus('other', 'stale')).rejects.toThrow('HUNONIC_SYNC_JOB_NOT_FOUND');
    expect(await f.service.getSyncStatus('tenant', 'stale')).toMatchObject({ status: 'FAILED', phase: 'failed', error: 'HUNONIC_SYNC_STALE' });
    await expect((f.service as any).publishSyncProgress('tenant', 'stale', { phase: 'syncing', percent: 10 })).rejects.toThrow('HUNONIC_SYNC_LEASE_LOST');
  });
});
