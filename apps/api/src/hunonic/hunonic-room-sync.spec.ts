import { afterEach, describe, expect, it, vi } from 'vitest';
import { HunonicProvider } from './hunonic.provider';
import { HunonicService } from './hunonic.service';

function fixture(mappings: any[] = [{ id: 'm1', tenantId: 't1', roomId: 'r1',
  providerMeterId: 'provider-1', providerRootId: 'provider-1', buildingCode: 'LK01-31', roomCode: '31-03' }]) {
  const prisma: any = {
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: { enabled: true } }) },
    hunonicMeterMapping: { findMany: vi.fn().mockResolvedValue(mappings), findFirst: vi.fn().mockResolvedValue(mappings[0]) },
    hunonicMeterReading: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const now = new Date().toISOString();
  const fetch = vi.spyOn(HunonicProvider.prototype, 'fetchDashboardData').mockResolvedValue({
    exported_at: now, electric_meters: [
      { provider_meter_id: 'provider-1', energy_month_kwh: 60, money_month_vnd: 240000, updated_at: now },
      { provider_meter_id: 'provider-2', energy_month_kwh: 999, money_month_vnd: 999999, updated_at: now },
    ],
  } as any);
  const history = vi.spyOn(HunonicProvider.prototype, 'fetchRecentMonthlyHistory');
  return { prisma, service: new HunonicService(prisma), fetch, history };
}

afterEach(() => vi.restoreAllMocks());
describe('room-only Hunonic sync', () => {
  it('saves one tenant-scoped meter without any history backfill', async () => {
    const { prisma, service, fetch, history } = fixture();
    expect(await service.syncRoom('t1', 'r1')).toMatchObject({ meterId: 'm1', readingsSaved: 1 });
    expect(prisma.hunonicMeterMapping.findMany).toHaveBeenCalledWith({ where: { tenantId: 't1', roomId: 'r1', enabled: true }, take: 2 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(history).not.toHaveBeenCalled();
    expect(prisma.hunonicMeterReading.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.hunonicMeterReading.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ tenantId: 't1', roomId: 'r1', meterMappingId: 'm1', sourceProviderMeterId: 'provider-1' }),
    ]);
  });
  it('rejects missing and ambiguous room mappings before contacting provider', async () => {
    const { service, fetch } = fixture([]);
    await expect(service.syncRoom('other-tenant', 'r1')).rejects.toThrow('HUNONIC_ROOM_METER_NOT_FOUND');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects two enabled mappings for the same tenant room before contacting provider', async () => {
    const mappings = [
      { id: 'm1', tenantId: 't1', roomId: 'r1', providerMeterId: 'provider-1', providerRootId: 'provider-1', buildingCode: 'LK01-31', roomCode: '31-03' },
      { id: 'm2', tenantId: 't1', roomId: 'r1', providerMeterId: 'provider-2', providerRootId: 'provider-2', buildingCode: 'LK01-31', roomCode: '31-03' },
    ];
    const { service, fetch } = fixture(mappings);
    await expect(service.syncRoom('t1', 'r1')).rejects.toThrow('HUNONIC_ROOM_METER_AMBIGUOUS');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not write when the exact provider meter is missing', async () => {
    const { service, prisma, fetch } = fixture();
    fetch.mockResolvedValue({ exported_at: new Date().toISOString(), electric_meters: [] } as any);
    await expect(service.syncRoom('t1', 'r1')).rejects.toThrow('HUNONIC_ROOM_PROVIDER_METER_MISMATCH');
    expect(prisma.hunonicMeterReading.createMany).not.toHaveBeenCalled();
  });
  it('does not write a prior-period provider reading into the current room period', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-20T10:00:00.000Z'));
      const { service, prisma, fetch } = fixture();
      fetch.mockResolvedValue({
        exported_at: '2026-09-30T16:00:00.000Z',
        electric_meters: [{
          provider_meter_id: 'provider-1', energy_month_kwh: 60, money_month_vnd: 240000,
          current_month: '2026-09', updated_at: '2026-09-30T16:00:00.000Z',
        }],
      } as any);

      await expect(service.syncRoom('t1', 'r1')).rejects.toThrow('HUNONIC_ROOM_READING_STALE');
      expect(prisma.hunonicMeterReading.createMany).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('does not discover all meters when pricing one mapped room', async () => {
    const { service, fetch } = fixture();
    vi.spyOn(HunonicProvider.prototype, 'fetchElectricityRateGroups').mockResolvedValue([]);
    await service.getRoomElectricityPricing('t1', 'r1');
    expect(fetch).not.toHaveBeenCalled();
  });
});
