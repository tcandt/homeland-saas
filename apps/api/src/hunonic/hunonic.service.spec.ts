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
    invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
    hunonicMeterMapping: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    hunonicMeterReading: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), create: vi.fn(), createMany: vi.fn() },
    ...overrides,
  };
  return { prisma, service: new HunonicService(prisma) };
}

describe('HunonicService room and period normalization', () => {
  it('exposes unknown pricing and the original provider timestamp independently of a new fetch', async () => {
    const { service } = createService({
      hunonicMeterMapping: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'm', buildingCode: 'A', roomCode: '101', providerMeterId: 'meter',
          raw: { timeupdate: '2026-09-18T01:00:00Z' },
          lastSyncedAt: new Date('2026-09-19T01:00:00Z'),
          lastStatus: 'on', lastReadingKwh: 0, lastAmountVnd: 0, readings: [],
        }]),
      },
      hunonicSyncLog: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const result = await service.getOverview('tenant', { allowAutoLock: false });
    expect(result.meters[0]).toMatchObject({
      rateMode: 'unknown', customRateVnd: null,
      providerObservedAt: '2026-09-18T01:00:00Z',
      lastSyncedAt: new Date('2026-09-19T01:00:00Z'),
      energyMonthKwh: 0, moneyMonthVnd: 0,
    });
  });

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

  it('filters and labels a backfilled observation by sourcePeriod, not observed month', async () => {
    const reading = {
      id: 'reading-1', meterMappingId: 'mapping-1', sourcePeriod: '2026-08', currentMonth: '2026-08',
      readingAt: new Date('2026-09-02T00:00:00.000Z'), createdAt: new Date('2026-09-02T00:00:00.000Z'),
      energyMonthKwh: 12, moneyMonthVnd: 42000,
      meterMapping: { id: 'mapping-1', buildingCode: 'A', roomCode: '101', displayName: '101', deviceName: 'Meter', providerMeterId: 'meter-1' },
    };
    const findMany = vi.fn().mockResolvedValue([reading]);
    const { service } = createService({
      hunonicMeterReading: { findMany, findFirst: vi.fn(), createMany: vi.fn() },
      hunonicMeterMapping: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    });

    const result = await service.getHistory('tenant-1', { year: '2026', month: '8' });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sourcePeriod: '2026-08' }),
    }));
    expect(result.monthlyRows).toEqual([expect.objectContaining({ period: '2026-08', energyMonthKwh: 12 })]);
  });

  it('does not write a synthetic reading while serving history', async () => {
    const create = vi.fn();
    const { service } = createService({
      hunonicMeterReading: { findMany: vi.fn().mockResolvedValue([]), create, findFirst: vi.fn() },
    });

    await service.getHistory('tenant-1', {});

    expect(create).not.toHaveBeenCalled();
  });

  it('honors read-only overview callers by never auto-locking or saving settings', async () => {
    const upsert = vi.fn();
    const { service } = createService({
      appSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: { autoLockPreviousMonth: true } }),
        upsert,
      },
      hunonicMeterMapping: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'mapping-1', buildingCode: 'A', roomCode: '101',
          raw: { root_extra: JSON.stringify({ power_of_prev_month: 1 }) },
          lastStatus: 'on', lastReadingKwh: 1, lastAmountVnd: 1,
          room: { id: 'room-1', code: '101', name: '101', status: 'OCCUPIED' },
          building: { id: 'building-1', code: 'A', name: 'A' }, readings: [],
        }]),
      },
      hunonicSyncLog: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await service.getOverview('tenant-1', { allowAutoLock: false } as any);

    expect(upsert).not.toHaveBeenCalled();
  });

  it('skips the scheduled sync before reading tenants when another worker holds the lock', async () => {
    const findMany = vi.fn();
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ locked: false }]) };
    const { prisma, service } = createService({
      appSetting: { findMany },
      $transaction: vi.fn((callback: any) => callback(tx)),
    });
    const syncTenant = vi.spyOn(service, 'syncTenant');

    await expect(service.syncEnabledTenantsEvery15Minutes()).resolves.toEqual({
      skipped: true,
      reason: 'HUNONIC_SYNC_LOCK_HELD',
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ timeout: 14 * 60 * 1000 }));
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(findMany).not.toHaveBeenCalled();
    expect(syncTenant).not.toHaveBeenCalled();
  });

  it('runs scheduled tenant sync only after acquiring the distributed lock', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { tenantId: 'tenant-enabled', value: { enabled: true } },
      { tenantId: 'tenant-disabled', value: { enabled: false } },
    ]);
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]) };
    const { service } = createService({
      appSetting: { findMany },
      $transaction: vi.fn((callback: any) => callback(tx)),
    });
    const syncTenant = vi.spyOn(service, 'syncTenant').mockResolvedValue({ skipped: false } as any);

    await service.syncEnabledTenantsEvery15Minutes();

    expect(findMany).toHaveBeenCalledWith({ where: { key: 'hunonic', scope: 'TENANT' } });
    expect(syncTenant).toHaveBeenCalledTimes(1);
    expect(syncTenant).toHaveBeenCalledWith('tenant-enabled', { enabled: true });
  });

  it('retries transient Hunonic provider failures before returning a result', async () => {
    const { service } = createService();
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('temporary provider timeout'))
      .mockResolvedValueOnce({ ok: true });

    await expect((service as any).withProviderRetry(operation, 'dashboard test')).resolves.toEqual({ ok: true });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('uses the numeric root_extra group and provider unit price in the overview', async () => {
    const { service } = createService({
      hunonicMeterMapping: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'mapping-1', buildingCode: 'A', roomCode: '101', providerRootId: 'root-1', providerMeterId: 'meter-1',
          raw: { root_extra: JSON.stringify({ electricity_group_id: 1, rate: 4200 }) },
          lastStatus: 'on', lastReadingKwh: 1, lastAmountVnd: 4200,
          room: { id: 'room-1', code: '101', name: '101', status: 'OCCUPIED' },
          building: { id: 'building-1', code: 'A', name: 'A' }, readings: [],
        }]),
      },
      hunonicSyncLog: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    const result = await service.getOverview('tenant-1', { allowAutoLock: false });

    expect(result.meters[0]).toMatchObject({ rateMode: 'custom', customRateVnd: 4200 });
  });

  it('does not invent a custom unit price when Hunonic did not provide one', async () => {
    const { service } = createService({
      hunonicMeterMapping: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'mapping-1', buildingCode: 'A', roomCode: '101', providerRootId: 'root-1', providerMeterId: 'meter-1',
          raw: { root_extra: { electricity_group_id: 1 } },
          lastStatus: 'on', lastReadingKwh: 0, lastAmountVnd: 0,
          room: { id: 'room-1', code: '101', name: '101', status: 'OCCUPIED' },
          building: { id: 'building-1', code: 'A', name: 'A' }, readings: [],
        }]),
      },
      hunonicSyncLog: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    const result = await service.getOverview('tenant-1', { allowAutoLock: false });

    expect(result.meters[0]).toMatchObject({ rateMode: 'custom', customRateVnd: null });
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
        findUnique: vi.fn().mockResolvedValue({
          id: 'mapping-1',
          buildingId: 'building-1',
          roomId: 'room-1',
          buildingCode: 'LK01-32',
          roomCode: '32-01',
        }),
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
    expect(data).not.toHaveProperty('roomId');
    expect(data).toMatchObject({ lastStatus: 'on' });
  });

  it('creates a new disabled/replacement mapping instead of rewriting a room\'s former provider identity', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'old-mapping' });
    const create = vi.fn().mockResolvedValue({ id: 'new-mapping' });
    const { service } = createService({
      hunonicMeterMapping: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue({ id: 'old-mapping' }),
        update,
        create,
      },
    });

    await (service as any).upsertMeterMappingByRoom(
      'tenant-1', 'meter-replacement', { buildingId: 'building-1', roomId: 'room-1' },
      { buildingCode: 'A', roomCode: '101', displayName: '101' },
      { provider_meter_id: 'meter-replacement', name: '101', status: 'on' } as any, new Date('2026-09-01T00:00:00.000Z'),
    );

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ enabled: false }) }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ providerMeterId: 'meter-replacement' }),
    }));
  });

  it('fails closed when the same provider meter is reassigned to another room', async () => {
    const update = vi.fn();
    const { service } = createService({
      hunonicMeterMapping: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'mapping-1',
          buildingId: 'building-1',
          roomId: 'room-1',
          buildingCode: 'A',
          roomCode: '101',
        }),
        update,
      },
    });

    await expect((service as any).upsertMeterMappingByRoom(
      'tenant-1', 'meter-1', { buildingId: 'building-1', roomId: 'room-2' },
      { buildingCode: 'A', roomCode: '102', displayName: '102' },
      { provider_meter_id: 'meter-1', name: '102', status: 'on' } as any,
      new Date('2026-09-01T00:00:00.000Z'),
    )).rejects.toThrow('HUNONIC_MAPPING_SCOPE_CHANGE_REQUIRES_REVIEW');
    expect(update).not.toHaveBeenCalled();
  });

  it('appends an exact-payload observation once and never updates an existing reading', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn().mockResolvedValue(null);
    const { prisma, service } = createService({ hunonicMeterReading: { findMany: vi.fn(), findFirst, createMany } });
    const queryRaw = vi.fn();
    prisma.$transaction = vi.fn(async (callback: any) => callback({ ...prisma, $queryRaw: queryRaw }));

    await (service as any).upsertMonthlyReading(
      'tenant-1', { id: 'mapping-1', buildingCode: 'A', roomCode: '101', providerMeterId: 'meter-1' },
      'room-1', '2026-08', new Date('2026-08-31T17:00:00.000Z'),
      { provider_meter_id: 'meter-1', energy_month_kwh: 12, money_month_vnd: 42000, status: 'on' } as any,
    );

    expect(findFirst).not.toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ sourcePeriod: '2026-08', aggregateBasis: 'MONTHLY_AGGREGATE_V1' })],
      skipDuplicates: true,
    }));
    expect(queryRaw.mock.calls[0][0].values).toContain('tenant-1:billing-evidence:room-1:2026-08');
  });

  it('appends observations with different payloads even when readingAt is identical', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const { service } = createService({
      hunonicMeterReading: { findMany: vi.fn(), findFirst: vi.fn(), createMany },
    });
    const readingAt = new Date('2026-08-31T17:00:00.000Z');
    const mapping = { id: 'mapping-1', buildingCode: 'A', roomCode: '101', providerMeterId: 'meter-1' };

    await expect((service as any).upsertMonthlyReading(
      'tenant-1', mapping, 'room-1', '2026-08', readingAt,
      { provider_meter_id: 'meter-1', energy_month_kwh: 12, money_month_vnd: 42000, status: 'on' } as any,
    )).resolves.toBe(true);
    await expect((service as any).upsertMonthlyReading(
      'tenant-1', mapping, 'room-1', '2026-08', readingAt,
      { provider_meter_id: 'meter-1', energy_month_kwh: 13, money_month_vnd: 45500, status: 'on' } as any,
    )).resolves.toBe(true);

    expect(createMany).toHaveBeenCalledTimes(2);
    expect(createMany.mock.calls[0][0].data[0].readingAt).toEqual(createMany.mock.calls[1][0].data[0].readingAt);
    expect(createMany.mock.calls[0][0].data[0].payloadHash).not.toEqual(createMany.mock.calls[1][0].data[0].payloadHash);
  });

  it('retains a partial provider graph point for history with the canonical DB aggregate basis', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const { service } = createService({
      hunonicMeterReading: { findMany: vi.fn(), findFirst: vi.fn(), createMany },
    });

    await (service as any).upsertMonthlyReading(
      'tenant-1', { id: 'mapping-1', buildingCode: 'A', roomCode: '101', providerMeterId: 'meter-1' },
      'room-1', '2026-08', new Date('2026-08-31T17:00:00.000Z'),
      { provider_meter_id: 'meter-1', energy_month_kwh: 12, money_month_vnd: null, status: 'on' } as any,
    );

    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({
      energyMonthKwh: expect.anything(), moneyMonthVnd: null,
      aggregateBasis: 'MONTHLY_AGGREGATE_V1',
    });
  });

  it('fails closed when createMany skips a row but the exact payload is absent', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const { service } = createService({
      hunonicMeterReading: { findMany: vi.fn(), findFirst, createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    });

    await expect((service as any).upsertMonthlyReading(
      'tenant-1', { id: 'mapping-1', buildingCode: 'A', roomCode: '101', providerMeterId: 'meter-1' },
      'room-1', '2026-08', new Date('2026-08-31T17:00:00.000Z'),
      { provider_meter_id: 'meter-1', energy_month_kwh: 12, money_month_vnd: 42000, status: 'on' } as any,
    )).rejects.toThrow('HUNONIC_READING_UNEXPECTED_UNIQUE_CONFLICT');
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('treats a skipped createMany row as idempotent only after finding the exact payload hash', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'reading-1' });
    const { service } = createService({
      hunonicMeterReading: { findMany: vi.fn(), findFirst, createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    });

    await expect((service as any).upsertMonthlyReading(
      'tenant-1', { id: 'mapping-1', buildingCode: 'A', roomCode: '101', providerMeterId: 'meter-1' },
      'room-1', '2026-08', new Date('2026-08-31T17:00:00.000Z'),
      { provider_meter_id: 'meter-1', energy_month_kwh: 12, money_month_vnd: 42000, status: 'on' } as any,
    )).resolves.toBe(false);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('reconciles invoice electricity by snapshot meter and service period, not invoice due date', async () => {
    const invoiceItemFindMany = vi.fn().mockResolvedValue([
      {
        amount: 42000,
        servicePeriod: '2026-08',
        invoice: { id: 'invoice-1' },
        billingSnapshot: {
          tenantId: 'tenant-1',
          usagePeriod: '2026-08',
          meterMappingId: 'mapping-1',
          room: { code: '101', building: { code: 'A' } },
        },
      },
    ]);
    const { service } = createService({ invoiceItem: { findMany: invoiceItemFindMany } });
    vi.spyOn(service, 'getHistory').mockResolvedValue({
      monthlyRows: [{
        buildingCode: 'A', roomCode: '101', period: '2026-08',
        meterMappingId: 'mapping-1', moneyMonthVnd: 42000,
      }],
    } as any);

    const result = await service.getReconciliation('tenant-1', {});

    expect(invoiceItemFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        servicePeriod: { in: ['2026-08'] },
        billingSnapshotId: { not: null },
      }),
    }));
    expect(result.rows[0]).toMatchObject({
      invoiceAmountVnd: 42000,
      reconciliationStatus: 'MATCHED',
    });
  });
});
