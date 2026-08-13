import { afterEach, describe, expect, it, vi } from 'vitest';
import { HunonicProvider } from './hunonic.provider';
import { HunonicService } from './hunonic.service';

function createService(overrides: Record<string, unknown> = {}) {
  const prisma: any = {
    appSetting: {
      findUnique: vi.fn().mockResolvedValue({ value: {} }),
      upsert: vi.fn(),
    },
    building: { findMany: vi.fn().mockResolvedValue([]) },
    room: { findFirst: vi.fn() },
    hunonicMeterMapping: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    hunonicMeterReading: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides,
  };
  return { prisma, service: new HunonicService(prisma) };
}

describe('HunonicService room and period normalization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats dot, hyphen, and PN room formats as the same locked period', () => {
    const { service } = createService();
    const settings = {
      lockedPeriods: [{ buildingCode: 'LK01.32', roomCode: 'PN 32.01', period: '2026-08' }],
    };

    expect((service as any).isLockedPeriod(settings, 'LK01-32', '32-01', '2026-08')).toBe(true);
    expect((service as any).isLockedPeriod(settings, 'LK01-32', '32-01', '2026-09')).toBe(false);
  });

  it('queries history by every supported room-code alias', async () => {
    const { prisma, service } = createService({
      building: { findMany: vi.fn().mockResolvedValue([{ code: 'LK01.32' }]) },
    });

    await service.getHistory('tenant-1', {
      buildingCode: 'LK01-32',
      roomCode: 'PN 32.01',
      year: '2026',
      month: '8',
    });

    expect(prisma.hunonicMeterReading.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        meterMapping: expect.objectContaining({
          buildingCode: { in: expect.arrayContaining(['LK01-32', 'LK01.32']) },
          roomCode: { in: expect.arrayContaining(['32-01', 'PN 32-01', '32.01']) },
        }),
      }),
    }));
  });

  it('keeps a cached custom rate when database mapping codes use another format', async () => {
    const mapping = {
      id: 'mapping-1',
      buildingCode: 'LK01.32',
      roomCode: 'PN 32-01',
      providerRootId: 'root-1',
      providerMeterId: 'meter-1',
    };
    const { service } = createService({
      appSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: {
            username: '0900000000',
            password: 'secret',
            appliedElectricityRates: {
              legacy: {
                rootId: 'legacy-root',
                buildingCode: 'LK01-32',
                roomCode: '32.01',
                mode: 'custom',
                customRateVnd: 3500,
                updatedAt: '2026-08-13T00:00:00.000Z',
              },
            },
          },
        }),
        upsert: vi.fn(),
      },
      hunonicMeterMapping: { findFirst: vi.fn().mockResolvedValue(mapping), findMany: vi.fn() },
    });
    vi.spyOn(HunonicProvider.prototype, 'fetchDashboardData').mockResolvedValue({
      provider: 'hunonic',
      source: 'mobile',
      schema_version: 1,
      exported_at: '2026-08-13T00:00:00.000Z',
      summary: { homes: 0, rooms: 0, devices: 0, electric_meters: 0 },
      electric_meters: [],
    });
    vi.spyOn(HunonicProvider.prototype, 'fetchElectricityRateGroups').mockResolvedValue([]);

    await expect(service.getRoomElectricityPricing('tenant-1', 'room-1')).resolves.toEqual(expect.objectContaining({
      currentMode: 'custom',
      customRateVnd: 3500,
    }));
  });

  it('preserves the latest saved totals when a dashboard response omits monthly values', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'mapping-1' });
    const { service } = createService({
      hunonicMeterMapping: {
        findUnique: vi.fn().mockResolvedValue({ id: 'mapping-1' }),
        findFirst: vi.fn(),
        update,
        create: vi.fn(),
      },
    });

    await (service as any).upsertMeterMappingByRoom(
      'tenant-1',
      'meter-1',
      { buildingId: 'building-1', roomId: 'room-1' },
      { buildingCode: 'LK01-32', roomCode: '32-01', displayName: 'Văn Phòng' },
      {
        provider_meter_id: 'meter-1',
        provider_device_id: 'device-1',
        provider_root_id: 'root-1',
        provider_home_id: 'home-1',
        provider_room_id: 'provider-room-1',
        home_name: 'LK01-32',
        room_name: 'Văn Phòng',
        name: 'Văn Phòng',
        root_type: 'elmeter',
        status: 'on',
        power_current_w: null,
        energy_month_kwh: null,
        money_month_vnd: null,
        energy_prev_month_kwh: null,
        money_prev_month_vnd: null,
        current_month: null,
        updated_at: null,
      },
      new Date('2026-08-13T00:00:00.000Z'),
    );

    const data = update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('lastReadingKwh');
    expect(data).not.toHaveProperty('lastAmountVnd');
    expect(data).toMatchObject({ roomId: 'room-1', lastStatus: 'on' });
  });
});
