import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, SettingScope } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { HunonicElectricMeter, HunonicElectricityRateMode, HunonicMonthlyHistoryPoint, HunonicProvider, HunonicProviderOptions } from './hunonic.provider';

type HunonicSettings = {
  enabled?: boolean;
  mode?: 'mobile' | 'website';
  username?: string;
  password?: string;
  baseUrl?: string;
  websiteBaseUrl?: string;
  websiteToken?: string;
  websiteCookie?: string;
  timeoutMs?: number;
  syncIntervalMinutes?: number;
  retentionYears?: number;
  managedBuildingCodes?: string[];
  lockedPeriods?: HunonicLockedPeriod[];
};

type HunonicLockedPeriod = {
  buildingCode: string;
  roomCode: string;
  period: string;
  lockedAt?: string;
  note?: string;
  meterMappingId?: string;
};

type HunonicHistoryQuery = {
  search?: string;
  buildingCode?: string;
  roomCode?: string;
  year?: string;
  month?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
};

type HunonicApplyRateInput = {
  meterIds?: string[];
  mode?: HunonicElectricityRateMode;
  customRateVnd?: number;
};

type HunonicLockPeriodsInput = {
  rows?: Array<{
    buildingCode?: string;
    roomCode?: string;
    period?: string;
    note?: string;
  }>;
};

const HUNONIC_SETTING_KEY = 'hunonic';
const MANAGED_BUILDINGS = ['LK01-31', 'LK01-32'];

@Injectable()
export class HunonicService {
  private readonly logger = new Logger(HunonicService.name);
  private readonly prismaAny: any;

  constructor(private readonly prisma: PrismaService) {
    this.prismaAny = prisma as any;
  }

  async getOverview(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    const lockedPeriods = normalizeLockedPeriods(settings.lockedPeriods);
    const rawMappings = await this.prismaAny.hunonicMeterMapping.findMany({
      where: { tenantId, buildingCode: { in: MANAGED_BUILDINGS } },
      include: {
        room: { select: { id: true, code: true, name: true, status: true } },
        building: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ buildingCode: 'asc' }, { roomCode: 'asc' }],
    });
    const mappings = dedupeMappingsByRoom(rawMappings);

    const latestLog = await this.prismaAny.hunonicSyncLog.findFirst({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
    });

    return {
      managedBuildingCodes: MANAGED_BUILDINGS,
      summary: {
        mappings: mappings.length,
        online: mappings.filter((item: any) => item.lastStatus === 'on').length,
        totalEnergyMonthKwh: sumDecimal(mappings, 'lastReadingKwh'),
        totalMoneyMonthVnd: sumDecimal(mappings, 'lastAmountVnd'),
      },
      latestLog,
      lockedPeriods,
      meters: mappings.map(mapMeterMapping),
    };
  }

  async getElectricityRates(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    const provider = new HunonicProvider(this.toProviderOptions({ ...settings, mode: 'mobile' }));
    const dashboard = await provider.fetchDashboardData();
    const mobileRootByRoom = new Map<string, HunonicElectricMeter>();
    for (const meter of dashboard.electric_meters) {
      const fixed = resolveFixedRoomMapping(meter);
      const rootId = meter.provider_root_id || meter.provider_meter_id;
      if (fixed && rootId) mobileRootByRoom.set(`${fixed.buildingCode}:${fixed.roomCode}`, meter);
    }
    const rawMappings = await this.prismaAny.hunonicMeterMapping.findMany({
      where: { tenantId, buildingCode: { in: MANAGED_BUILDINGS }, enabled: true },
      orderBy: [{ buildingCode: 'asc' }, { roomCode: 'asc' }],
    });
    const mappings = dedupeMappingsByRoom(rawMappings);
    const rows = [];

    for (const mapping of mappings) {
      const mobileMeter = mobileRootByRoom.get(`${mapping.buildingCode}:${mapping.roomCode}`);
      const rootId = mobileMeter?.provider_root_id || mobileMeter?.provider_meter_id || mapping.providerRootId || mapping.providerMeterId;
      if (!rootId) continue;
      try {
        const groups = await provider.fetchElectricityRateGroups(rootId);
        const custom = groups.find((group) => group.id === '1' || group.name.toLowerCase().includes('tự') || group.name.toLowerCase().includes('tu'));
        const residential = groups.find((group) => group.id === '2' || group.name.toLowerCase().includes('sinh'));
        const activeGroupId = getActiveElectricityGroupId(mobileMeter);
        const currentMode = activeGroupId === '1'
          ? 'custom'
          : activeGroupId === '2'
            ? 'residential'
            : custom && custom.rates.length > 0
              ? 'custom'
              : 'residential';
        const inferredCustomRate = currentMode === 'custom'
          ? custom?.rates?.[0]?.price || inferCustomUnitRate(mobileMeter, mapping)
          : null;
        rows.push({
          id: mapping.id,
          buildingCode: mapping.buildingCode,
          roomCode: mapping.roomCode,
          displayName: mapping.displayName,
          deviceName: mobileMeter?.name || mapping.deviceName,
          providerRootId: rootId,
          providerMeterId: mobileMeter?.provider_meter_id || mapping.providerMeterId,
          currentMode,
          customRateVnd: inferredCustomRate,
          residentialSteps: residential?.rates || [],
          groups,
          lastSyncedAt: mapping.lastSyncedAt,
        });
      } catch (error: any) {
        rows.push({
          id: mapping.id,
          buildingCode: mapping.buildingCode,
          roomCode: mapping.roomCode,
          displayName: mapping.displayName,
          deviceName: mobileMeter?.name || mapping.deviceName,
          providerRootId: rootId,
          providerMeterId: mobileMeter?.provider_meter_id || mapping.providerMeterId,
          currentMode: 'unknown',
          customRateVnd: null,
          residentialSteps: [],
          groups: [],
          error: error?.message || 'Cannot read Hunonic electricity rate.',
          lastSyncedAt: mapping.lastSyncedAt,
        });
      }
    }

    const residentialTemplate = rows.find((row) => row.residentialSteps?.length > 0)?.residentialSteps || [];
    return {
      rows,
      residentialTemplate,
      summary: {
        totalMeters: rows.length,
        residentialMeters: rows.filter((row) => row.currentMode === 'residential').length,
        customMeters: rows.filter((row) => row.currentMode === 'custom').length,
        errorMeters: rows.filter((row) => row.error).length,
      },
    };
  }

  async applyElectricityRates(tenantId: string, input: HunonicApplyRateInput) {
    const meterIds = Array.isArray(input.meterIds) ? input.meterIds.filter(Boolean) : [];
    const mode = input.mode;
    const customRateVnd = Number(input.customRateVnd);

    if (meterIds.length === 0) {
      throw new BadRequestException('Select at least one Hunonic meter.');
    }
    if (mode !== 'residential' && mode !== 'custom') {
      throw new BadRequestException('Invalid Hunonic electricity rate mode.');
    }
    if (mode === 'custom' && (!Number.isFinite(customRateVnd) || customRateVnd <= 0)) {
      throw new BadRequestException('Invalid custom electricity rate.');
    }

    const settings = await this.getSettings(tenantId);
    const provider = new HunonicProvider(this.toProviderOptions({ ...settings, mode: 'mobile' }));
    const dashboard = await provider.fetchDashboardData();
    const mobileRootByRoom = new Map<string, HunonicElectricMeter>();
    for (const meter of dashboard.electric_meters) {
      const fixed = resolveFixedRoomMapping(meter);
      const rootId = meter.provider_root_id || meter.provider_meter_id;
      if (fixed && rootId) mobileRootByRoom.set(`${fixed.buildingCode}:${fixed.roomCode}`, meter);
    }

    const mappings = await this.prismaAny.hunonicMeterMapping.findMany({
      where: {
        tenantId,
        id: { in: meterIds },
        buildingCode: { in: MANAGED_BUILDINGS },
        enabled: true,
      },
      orderBy: [{ buildingCode: 'asc' }, { roomCode: 'asc' }],
    });

    const updated = [];
    const errors = [];

    for (const mapping of mappings) {
      const mobileMeter = mobileRootByRoom.get(`${mapping.buildingCode}:${mapping.roomCode}`);
      const rootId = mobileMeter?.provider_root_id || mobileMeter?.provider_meter_id || mapping.providerRootId || mapping.providerMeterId;
      if (!rootId) {
        errors.push({
          id: mapping.id,
          room: `${mapping.buildingCode} / ${mapping.displayName}`,
          message: 'Missing Hunonic root_id.',
        });
        continue;
      }

      try {
        const result = await provider.applyElectricityRate(
          rootId,
          mode,
          mode === 'custom' ? customRateVnd : undefined,
        );
        updated.push({
          id: mapping.id,
          room: `${mapping.buildingCode} / ${mapping.displayName}`,
          rootId,
          result,
        });
      } catch (error: any) {
        errors.push({
          id: mapping.id,
          room: `${mapping.buildingCode} / ${mapping.displayName}`,
          rootId,
          message: error?.message || 'Cannot update Hunonic electricity rate.',
        });
      }
    }

    return {
      mode,
      customRateVnd: mode === 'custom' ? customRateVnd : null,
      requested: meterIds.length,
      matched: mappings.length,
      updated: updated.length,
      failed: errors.length,
      errors,
    };
  }

  async getRoomElectricity(tenantId: string, roomId: string) {
    const mapping = await this.prismaAny.hunonicMeterMapping.findFirst({
      where: { tenantId, roomId, enabled: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        readings: {
          orderBy: { readingAt: 'desc' },
          take: 12,
        },
      },
    });

    if (!mapping) return null;

    return {
      ...mapMeterMapping(mapping),
      readings: mapping.readings.map(mapReading),
    };
  }

  async getHistory(tenantId: string, query: HunonicHistoryQuery) {
    const settings = await this.getSettings(tenantId);
    const lockedPeriods = normalizeLockedPeriods(settings.lockedPeriods);
    const page = clampNumber(Number(query.page || 1), 1, 9999);
    const limit = clampNumber(Number(query.limit || 25), 5, 200);
    const dateRange = resolveHistoryDateRange(query);
    const search = String(query.search || '').trim();
    const relationFilter: any = {
      buildingCode: query.buildingCode && query.buildingCode !== 'all'
        ? query.buildingCode
        : { in: MANAGED_BUILDINGS },
    };

    if (query.roomCode && query.roomCode !== 'all') relationFilter.roomCode = query.roomCode;
    if (search) {
      relationFilter.OR = [
        { buildingCode: { contains: search, mode: 'insensitive' } },
        { roomCode: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { deviceName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const where = {
      tenantId,
      readingAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
      meterMapping: relationFilter,
    };

    const [allForSummary, rawMappings] = await Promise.all([
      this.prismaAny.hunonicMeterReading.findMany({
        where,
        orderBy: [{ readingAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          meterMapping: {
            select: {
              id: true,
              buildingCode: true,
              roomCode: true,
              displayName: true,
              deviceName: true,
              providerMeterId: true,
            },
          },
        },
      }),
      this.prismaAny.hunonicMeterMapping.findMany({
        where: { tenantId, buildingCode: { in: MANAGED_BUILDINGS } },
        select: { buildingCode: true, roomCode: true, displayName: true },
        orderBy: [{ buildingCode: 'asc' }, { roomCode: 'asc' }],
      }),
    ]);

    const duplicateCountByKey = countReadingsByRoomPeriod(allForSummary);
    const dedupedReadings = dedupeHistoryReadings(allForSummary);
    const total = dedupedReadings.length;
    const readings = dedupedReadings.slice((page - 1) * limit, page * limit);
    const monthlyRows = buildMonthlyRows(dedupedReadings, lockedPeriods, duplicateCountByKey);
    const roomsWithData = countRoomsWithData(monthlyRows);
    const mappings = dedupeMappingsByRoom(rawMappings);
    const dataQuality = buildDataQualitySummary(monthlyRows);

    return {
      filters: {
        from: dateRange.from,
        to: dateRange.to,
        page,
        limit,
        availableYears: getThreeYearOptions(),
        rooms: mappings.map((item: any) => ({
          buildingCode: item.buildingCode,
          roomCode: item.roomCode,
          displayName: item.displayName,
        })),
        lockedPeriods,
      },
      summary: {
        totalReadings: total,
        monthlyRows: monthlyRows.length,
        roomsWithData,
        totalEnergyMonthKwh: monthlyRows.reduce((sum, item) => sum + item.energyMonthKwh, 0),
        totalMoneyMonthVnd: monthlyRows.reduce((sum, item) => sum + item.moneyMonthVnd, 0),
        dataQuality,
      },
      monthlyRows,
      qualityAlerts: dataQuality.alerts,
      readings: readings.map(mapHistoryReading),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async lockPeriods(tenantId: string, input: HunonicLockPeriodsInput) {
    const rows = Array.isArray(input?.rows) ? input.rows : [];
    if (rows.length === 0) {
      throw new BadRequestException('No Hunonic periods selected for lock.');
    }

    const settings = await this.getSettings(tenantId);
    const current = normalizeLockedPeriods(settings.lockedPeriods);
    const map = new Map(current.map((item) => [lockedPeriodKey(item), item]));

    for (const row of rows) {
      const locked = normalizeLockedPeriod(row);
      if (!locked) continue;
      map.set(lockedPeriodKey(locked), {
        ...locked,
        lockedAt: new Date().toISOString(),
      });
    }

    const nextSettings: HunonicSettings = {
      ...settings,
      lockedPeriods: Array.from(map.values()).sort(compareLockedPeriods),
    };
    await this.saveSettings(tenantId, nextSettings);
    return { lockedPeriods: nextSettings.lockedPeriods || [] };
  }

  async unlockPeriods(tenantId: string, input: HunonicLockPeriodsInput) {
    const rows = Array.isArray(input?.rows) ? input.rows : [];
    if (rows.length === 0) {
      throw new BadRequestException('No Hunonic periods selected for unlock.');
    }

    const settings = await this.getSettings(tenantId);
    const current = normalizeLockedPeriods(settings.lockedPeriods);
    const removeKeys = new Set(
      rows
        .map((row) => normalizeLockedPeriod(row))
        .filter(Boolean)
        .map((item) => lockedPeriodKey(item!)),
    );

    const nextSettings: HunonicSettings = {
      ...settings,
      lockedPeriods: current.filter((item) => !removeKeys.has(lockedPeriodKey(item))),
    };
    await this.saveSettings(tenantId, nextSettings);
    return { lockedPeriods: nextSettings.lockedPeriods || [] };
  }

  async getReconciliation(tenantId: string, query: HunonicHistoryQuery) {
    const history = await this.getHistory(tenantId, query);
    const monthlyRows = Array.isArray((history as any).monthlyRows) ? (history as any).monthlyRows : [];
    if (monthlyRows.length === 0) {
      return { rows: [], summary: { totalRows: 0, matchedRows: 0, mismatchedRows: 0, missingInvoiceRows: 0 } };
    }

    const periods = Array.from(new Set(monthlyRows.map((row: any) => String(row.period)))) as string[];
    const roomKeys = Array.from(new Set(monthlyRows.map((row: any) => `${row.buildingCode}:${row.roomCode}`)));

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        dueDate: {
          gte: getPeriodStart(periods[periods.length - 1]),
          lte: getPeriodEnd(periods[0]),
        },
        items: {
          some: {
            type: 'UTILITY_ELECTRICITY' as any,
          },
        },
      },
      include: {
        items: {
          where: { type: 'UTILITY_ELECTRICITY' as any },
          select: { amount: true, description: true, type: true },
        },
        contract: {
          select: {
            room: {
              select: {
                code: true,
                building: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    const invoiceByRoomPeriod = new Map<string, { invoiceAmount: number; invoiceCount: number }>();
    for (const invoice of invoices) {
      const buildingCode = invoice.contract?.room?.building?.code;
      const roomCode = invoice.contract?.room?.code;
      if (!buildingCode || !roomCode) continue;
      const roomPeriodKey = `${buildingCode}:${roomCode}:${getReadingPeriod(new Date(invoice.dueDate))}`;
      if (!roomKeys.includes(`${buildingCode}:${roomCode}`)) continue;
      const current = invoiceByRoomPeriod.get(roomPeriodKey) || { invoiceAmount: 0, invoiceCount: 0 };
      current.invoiceAmount += invoice.items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      current.invoiceCount += 1;
      invoiceByRoomPeriod.set(roomPeriodKey, current);
    }

    const rows = monthlyRows.map((row: any) => {
      const key = `${row.buildingCode}:${row.roomCode}:${row.period}`;
      const invoice = invoiceByRoomPeriod.get(key);
      const hunonicAmount = Number(row.moneyMonthVnd || 0);
      const invoiceAmount = Number(invoice?.invoiceAmount || 0);
      const diffAmount = invoice ? invoiceAmount - hunonicAmount : null;
      return {
        ...row,
        invoiceAmountVnd: invoice ? invoiceAmount : null,
        invoiceCount: invoice?.invoiceCount || 0,
        diffAmountVnd: diffAmount,
        reconciliationStatus: !invoice
          ? 'MISSING_INVOICE'
          : Math.abs(diffAmount || 0) <= 1
            ? 'MATCHED'
            : 'MISMATCHED',
      };
    });

    return {
      rows,
      summary: {
        totalRows: rows.length,
        matchedRows: rows.filter((row: any) => row.reconciliationStatus === 'MATCHED').length,
        mismatchedRows: rows.filter((row: any) => row.reconciliationStatus === 'MISMATCHED').length,
        missingInvoiceRows: rows.filter((row: any) => row.reconciliationStatus === 'MISSING_INVOICE').length,
      },
    };
  }

  async syncTenant(tenantId: string, overrideSettings?: HunonicSettings, options: { backfillMonths?: number } = {}) {
    const settings = overrideSettings || await this.getSettings(tenantId);
    if (!settings.enabled && !overrideSettings) {
      return { skipped: true, reason: 'Hunonic integration is disabled.' };
    }

    const preferredMode = this.resolveProviderMode(settings);
    const startedAt = new Date();
    const log = await this.prismaAny.hunonicSyncLog.create({
      data: { tenantId, status: 'RUNNING', source: preferredMode, startedAt },
    });

    try {
      const backfillMonths = options.backfillMonths || 0;
      const canBackfillFromWebsite = backfillMonths > 0
        && preferredMode === 'website'
        && Boolean(settings.websiteToken || settings.websiteCookie);
      const providerSettings = canBackfillFromWebsite
        ? { ...settings, mode: 'website' as const }
        : { ...settings, mode: preferredMode };
      const provider = new HunonicProvider(this.toProviderOptions(providerSettings));
      const backfill = canBackfillFromWebsite
        ? await provider.fetchRecentMonthlyHistory(backfillMonths)
        : null;
      const dashboard = backfill?.dashboard || await provider.fetchDashboardData();
      const buildings = await this.prisma.building.findMany({
        where: { tenantId, code: { in: MANAGED_BUILDINGS }, deletedAt: null },
        include: { rooms: { where: { deletedAt: null } } },
      });
      const roomIndex = createRoomIndex(buildings);
      let readingsSaved = 0;
      const mappingByProviderMeterId = new Map<string, any>();

      for (const meter of dashboard.electric_meters) {
        const fixed = resolveFixedRoomMapping(meter);
        if (!fixed) continue;

        const roomMatch = roomIndex.get(`${fixed.buildingCode}:${fixed.roomCode}`);
        const readingAt = meter.updated_at ? new Date(meter.updated_at) : new Date(dashboard.exported_at);
        const providerMeterId = meter.provider_meter_id || meter.provider_device_id;
        if (!providerMeterId || Number.isNaN(readingAt.getTime())) continue;

        const mapping = await this.upsertMeterMappingByRoom(
          tenantId,
          providerMeterId,
          roomMatch,
          fixed,
          meter,
          new Date(dashboard.exported_at),
        );
        mappingByProviderMeterId.set(providerMeterId, { mapping, roomId: roomMatch?.roomId, meter, fixed });

        const upserted = await this.upsertMonthlyReading(
          tenantId,
          mapping,
          roomMatch?.roomId,
          getReadingPeriod(readingAt),
          readingAt,
          meter,
        );
        if (upserted) readingsSaved += 1;
      }

      for (const point of backfill?.history || []) {
        const providerMeterId = point.provider_meter_id || point.provider_device_id;
        const match = providerMeterId ? mappingByProviderMeterId.get(providerMeterId) : null;
        if (!match) continue;
        const readingAt = getPeriodReadingAt(point.period);
        const meter = monthlyPointToMeter(match.meter, point);
        const upserted = await this.upsertMonthlyReading(
          tenantId,
          match.mapping,
          match.roomId,
          point.period,
          readingAt,
          meter,
        );
        if (upserted) readingsSaved += 1;
      }

      await this.prismaAny.hunonicSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          metersFound: dashboard.electric_meters.length,
          readingsSaved,
          message: backfill
            ? `Backfilled ${backfillMonths} months and updated ${readingsSaved} Hunonic monthly readings.`
            : `Updated ${readingsSaved} Hunonic current-month readings.`,
        },
      });

      return {
        skipped: false,
        source: dashboard.source,
        metersFound: dashboard.electric_meters.length,
        readingsSaved,
        backfillMonths: backfill ? backfillMonths : 0,
      };
    } catch (error: any) {
      await this.prismaAny.hunonicSyncLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', finishedAt: new Date(), error: error?.message || 'Hunonic sync failed.' },
      });
      throw error;
    }
  }

  async testConnection(tenantId: string, settings: HunonicSettings) {
    const savedSettings = await this.getSettings(tenantId);
    const provider = new HunonicProvider(this.toProviderOptions(mergeSavedHunonicSecrets(savedSettings, settings)));
    const dashboard = await provider.fetchDashboardData();
    return {
      source: dashboard.source,
      summary: dashboard.summary,
      matchedMeters: dashboard.electric_meters
        .map((meter) => ({ meter, fixed: resolveFixedRoomMapping(meter) }))
        .filter((item) => item.fixed)
        .map(({ meter, fixed }) => ({
          providerMeterId: meter.provider_meter_id,
          name: meter.name,
          buildingCode: fixed?.buildingCode,
          roomCode: fixed?.roomCode,
          moneyMonthVnd: meter.money_month_vnd,
          energyMonthKwh: meter.energy_month_kwh,
        })),
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncEnabledTenantsHourly() {
    const records = await this.prismaAny.appSetting.findMany({
      where: { key: HUNONIC_SETTING_KEY, scope: SettingScope.TENANT },
    });

    for (const record of records) {
      const value = (record.value || {}) as HunonicSettings;
      if (!value.enabled) continue;
      try {
        await this.syncTenant(record.tenantId, value);
      } catch (error: any) {
        this.logger.error(`Hunonic hourly sync failed for tenant ${record.tenantId}: ${error?.message}`);
      }
    }
  }

  private async getSettings(tenantId: string): Promise<HunonicSettings> {
    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: HUNONIC_SETTING_KEY,
        },
      },
    });
    return ((record?.value || {}) as HunonicSettings);
  }

  private async saveSettings(tenantId: string, settings: HunonicSettings) {
    await this.prisma.appSetting.upsert({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: HUNONIC_SETTING_KEY,
        },
      },
      update: {
        value: settings as any,
      },
      create: {
        tenantId,
        scope: SettingScope.TENANT,
        ownerId: tenantId,
        key: HUNONIC_SETTING_KEY,
        value: settings as any,
      },
    });
  }

  private toProviderOptions(settings: HunonicSettings): HunonicProviderOptions {
    return {
      mode: this.resolveProviderMode(settings),
      username: settings.username,
      password: settings.password,
      baseUrl: settings.baseUrl,
      websiteBaseUrl: settings.websiteBaseUrl,
      websiteToken: settings.websiteToken,
      websiteCookie: settings.websiteCookie,
      timeoutMs: settings.timeoutMs,
    };
  }

  private resolveProviderMode(settings: HunonicSettings): 'mobile' | 'website' {
    return settings.mode || (settings.websiteToken || settings.websiteCookie ? 'website' : 'mobile');
  }

  private async upsertMeterMappingByRoom(
    tenantId: string,
    providerMeterId: string,
    roomMatch: { buildingId: string; roomId: string } | undefined,
    fixed: { buildingCode: string; roomCode: string; displayName: string },
    meter: HunonicElectricMeter,
    exportedAt: Date,
  ) {
    const data = {
      buildingId: roomMatch?.buildingId,
      roomId: roomMatch?.roomId,
      buildingCode: fixed.buildingCode,
      roomCode: fixed.roomCode,
      displayName: fixed.displayName,
      providerMeterId,
      providerDeviceId: meter.provider_device_id,
      providerRootId: meter.provider_root_id,
      providerHomeId: meter.provider_home_id,
      providerRoomId: meter.provider_room_id,
      homeName: meter.home_name,
      roomName: meter.room_name,
      deviceName: meter.name || fixed.displayName,
      rootType: meter.root_type,
      enabled: true,
      lastStatus: meter.status,
      lastReadingKwh: decimalOrNull(meter.energy_month_kwh),
      lastAmountVnd: decimalOrNull(meter.money_month_vnd),
      lastSyncedAt: exportedAt,
      raw: sanitizeRaw(meter),
    };

    const existingByProvider = await this.prismaAny.hunonicMeterMapping.findUnique({
      where: { tenantId_providerMeterId: { tenantId, providerMeterId } },
    });
    if (existingByProvider) {
      return this.prismaAny.hunonicMeterMapping.update({
        where: { id: existingByProvider.id },
        data,
      });
    }

    const existingByRoom = await this.prismaAny.hunonicMeterMapping.findFirst({
      where: {
        tenantId,
        buildingCode: fixed.buildingCode,
        roomCode: fixed.roomCode,
      },
      orderBy: [{ enabled: 'desc' }, { lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    if (existingByRoom) {
      return this.prismaAny.hunonicMeterMapping.update({
        where: { id: existingByRoom.id },
        data,
      });
    }

    return this.prismaAny.hunonicMeterMapping.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  private async upsertMonthlyReading(
    tenantId: string,
    meterMapping: { id: string; buildingCode: string; roomCode: string },
    roomId: string | undefined,
    period: string,
    readingAt: Date,
    meter: HunonicElectricMeter,
  ) {
    if (this.isLockedPeriod(await this.getSettings(tenantId), meterMapping.buildingCode, meterMapping.roomCode, period)) {
      return false;
    }

    const existing = await this.prismaAny.hunonicMeterReading.findFirst({
      where: {
        tenantId,
        meterMappingId: meterMapping.id,
        currentMonth: period,
      },
      orderBy: { readingAt: 'desc' },
    });

    const data = {
          tenantId,
          meterMappingId: meterMapping.id,
          roomId,
          readingAt,
          status: meter.status,
          powerCurrentW: decimalOrNull(meter.power_current_w),
          energyMonthKwh: decimalOrNull(meter.energy_month_kwh),
          moneyMonthVnd: decimalOrNull(meter.money_month_vnd),
          energyPrevMonthKwh: decimalOrNull(meter.energy_prev_month_kwh),
          moneyPrevMonthVnd: decimalOrNull(meter.money_prev_month_vnd),
          currentMonth: period,
          raw: sanitizeRaw(meter),
    };

    if (existing) {
      await this.prismaAny.hunonicMeterReading.update({
        where: { id: existing.id },
        data,
      });
      return false;
    }

    await this.prismaAny.hunonicMeterReading.create({ data });
    return true;
  }

  private isLockedPeriod(settings: HunonicSettings, buildingCode: string, roomCode: string, period: string) {
    const lockedPeriods = normalizeLockedPeriods(settings.lockedPeriods);
    return lockedPeriods.some((item) => item.period === period && item.buildingCode === buildingCode && item.roomCode === roomCode);
  }
}

function resolveFixedRoomMapping(meter: HunonicElectricMeter) {
  const name = String(meter.name || '').trim();
  const roomName = String(meter.room_name || '').trim();
  const candidates = [name, roomName].filter(Boolean);
  const officeMatch = candidates.some((value) => value.toLowerCase() === 'văn phòng' || value.toLowerCase() === 'van phong');
  if (officeMatch) return { buildingCode: 'LK01-32', roomCode: '32-01', displayName: 'Văn Phòng' };

  const code = candidates.map(extractRoomCode).find(Boolean);
  if (!code) return null;
  const prefix = code.split('-')[0];
  if (prefix === '31') return { buildingCode: 'LK01-31', roomCode: code, displayName: code };
  if (prefix === '32') return { buildingCode: 'LK01-32', roomCode: code, displayName: code };
  return null;
}

function extractRoomCode(value: string) {
  const match = value.match(/(?:ĐIỆN|DIEN|\b)?\s*(31|32)[.\-\s]?(\d{2})/i);
  return match ? `${match[1]}-${match[2]}` : null;
}

function createRoomIndex(buildings: Array<any>) {
  const index = new Map<string, { buildingId: string; roomId: string }>();
  for (const building of buildings) {
    for (const room of building.rooms || []) {
      index.set(`${building.code}:${room.code}`, { buildingId: building.id, roomId: room.id });
    }
  }
  return index;
}

function decimalOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? new Prisma.Decimal(number) : null;
}

function sumDecimal(items: any[], key: string) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function sanitizeRaw(meter: HunonicElectricMeter) {
  const { raw, ...safe } = meter;
  return (raw || safe) as Prisma.InputJsonValue;
}

function dedupeMappingsByRoom<T extends Record<string, any>>(mappings: T[]): T[] {
  const bestByRoom = new Map<string, T>();
  for (const mapping of mappings) {
    const key = `${mapping.buildingCode}:${mapping.roomCode}`;
    const current = bestByRoom.get(key);
    if (!current || compareMappingFreshness(mapping, current) > 0) {
      bestByRoom.set(key, mapping);
    }
  }
  return mappings.filter((mapping) => bestByRoom.get(`${mapping.buildingCode}:${mapping.roomCode}`) === mapping);
}

function compareMappingFreshness(left: { enabled?: boolean; lastSyncedAt?: Date | string | null; updatedAt?: Date | string | null }, right: { enabled?: boolean; lastSyncedAt?: Date | string | null; updatedAt?: Date | string | null }) {
  if (Boolean(left.enabled) !== Boolean(right.enabled)) return left.enabled ? 1 : -1;
  const leftSynced = dateTimeValue(left.lastSyncedAt);
  const rightSynced = dateTimeValue(right.lastSyncedAt);
  if (leftSynced !== rightSynced) return leftSynced - rightSynced;
  return dateTimeValue(left.updatedAt) - dateTimeValue(right.updatedAt);
}

function dateTimeValue(value: Date | string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function mapMeterMapping(mapping: any) {
  return {
    id: mapping.id,
    buildingId: mapping.buildingId,
    roomId: mapping.roomId,
    buildingCode: mapping.buildingCode,
    roomCode: mapping.roomCode,
    displayName: mapping.displayName,
    deviceName: mapping.deviceName,
    status: mapping.lastStatus,
    energyMonthKwh: Number(mapping.lastReadingKwh || 0),
    moneyMonthVnd: Number(mapping.lastAmountVnd || 0),
    lastSyncedAt: mapping.lastSyncedAt,
    providerMeterId: mapping.providerMeterId,
    providerDeviceId: mapping.providerDeviceId,
    homeName: mapping.homeName,
    sourceRoomName: mapping.roomName,
    room: mapping.room,
    building: mapping.building,
  };
}

function mapReading(reading: any) {
  return {
    id: reading.id,
    readingAt: reading.readingAt,
    status: reading.status,
    powerCurrentW: Number(reading.powerCurrentW || 0),
    energyMonthKwh: Number(reading.energyMonthKwh || 0),
    moneyMonthVnd: Number(reading.moneyMonthVnd || 0),
    currentMonth: reading.currentMonth,
  };
}

function getReadingPeriod(readingAt: Date) {
  const date = Number.isNaN(readingAt.getTime()) ? new Date() : readingAt;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getPeriodReadingAt(period: string) {
  const [yearValue, monthValue] = period.split('-').map(Number);
  if (!Number.isFinite(yearValue) || !Number.isFinite(monthValue)) return new Date();
  return new Date(yearValue, monthValue, 0, 23, 59, 59, 999);
}

function monthlyPointToMeter(base: HunonicElectricMeter, point: HunonicMonthlyHistoryPoint): HunonicElectricMeter {
  return {
    ...base,
    energy_month_kwh: point.energy_month_kwh,
    money_month_vnd: point.money_month_vnd,
    current_month: point.period,
    updated_at: getPeriodReadingAt(point.period).toISOString(),
    raw: point.raw || base.raw,
  };
}

function getActiveElectricityGroupId(meter?: HunonicElectricMeter) {
  const raw = meter?.raw as any;
  const groupId = raw?.data_extra?.electricity_group_id ?? raw?.electricity_group_id;
  return groupId === null || groupId === undefined || groupId === '' ? null : String(groupId);
}

function inferCustomUnitRate(meter: HunonicElectricMeter | undefined, mapping: any) {
  const energy = Number(meter?.energy_month_kwh ?? mapping?.lastReadingKwh ?? 0);
  const money = Number(meter?.money_month_vnd ?? mapping?.lastAmountVnd ?? 0);
  if (!Number.isFinite(energy) || !Number.isFinite(money) || energy <= 0 || money <= 0) return null;
  return Math.round(money / energy);
}

function resolveHistoryDateRange(query: HunonicHistoryQuery) {
  const now = new Date();
  const threeYearsAgo = new Date(now);
  threeYearsAgo.setFullYear(now.getFullYear() - 3);

  if (query.year && query.year !== 'all') {
    const year = Number(query.year);
    const month = query.month && query.month !== 'all' ? Number(query.month) : null;
    if (Number.isFinite(year) && month && month >= 1 && month <= 12) {
      return {
        from: new Date(year, month - 1, 1, 0, 0, 0, 0),
        to: new Date(year, month, 0, 23, 59, 59, 999),
      };
    }
    if (Number.isFinite(year)) {
      return {
        from: new Date(year, 0, 1, 0, 0, 0, 0),
        to: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }
  }

  const from = query.from ? new Date(query.from) : threeYearsAgo;
  const to = query.to ? new Date(query.to) : now;
  return {
    from: Number.isNaN(from.getTime()) ? threeYearsAgo : from,
    to: Number.isNaN(to.getTime()) ? now : to,
  };
}

function buildMonthlyRows(
  readings: any[],
  lockedPeriods: HunonicLockedPeriod[] = [],
  duplicateCountByKey: Map<string, number> = new Map(),
) {
  const lockedKeys = new Set(lockedPeriods.map((item) => lockedPeriodKey(item)));
  const latestByRoomMonth = new Map<string, any>();
  for (const reading of readings) {
    const mapping = reading.meterMapping;
    if (!mapping) continue;
    const date = new Date(reading.readingAt);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const key = `${mapping.buildingCode}:${mapping.roomCode}:${year}:${month}`;
    if (!latestByRoomMonth.has(key)) {
      latestByRoomMonth.set(key, {
        buildingCode: mapping.buildingCode,
        roomCode: mapping.roomCode,
        displayName: mapping.displayName,
        deviceName: mapping.deviceName,
        year,
        month,
        period,
        status: reading.status,
        powerCurrentW: Number(reading.powerCurrentW || 0),
        energyMonthKwh: Number(reading.energyMonthKwh || 0),
        moneyMonthVnd: Number(reading.moneyMonthVnd || 0),
        readingAt: reading.readingAt,
        duplicateReadings: duplicateCountByKey.get(lockedPeriodKey({ buildingCode: mapping.buildingCode, roomCode: mapping.roomCode, period })) || 1,
        isLocked: lockedKeys.has(lockedPeriodKey({ buildingCode: mapping.buildingCode, roomCode: mapping.roomCode, period })),
      });
    }
  }
  return Array.from(latestByRoomMonth.values()).sort((a, b) => {
    if (a.period !== b.period) return a.period < b.period ? 1 : -1;
    return `${a.buildingCode}:${a.roomCode}`.localeCompare(`${b.buildingCode}:${b.roomCode}`);
  });
}

function countRoomsWithData(rows: Array<{ buildingCode: string; roomCode: string }>) {
  return new Set(rows.map((row) => `${row.buildingCode}:${row.roomCode}`)).size;
}

function countReadingsByRoomPeriod(readings: any[]) {
  const counts = new Map<string, number>();
  for (const reading of readings) {
    const mapping = reading.meterMapping;
    if (!mapping?.buildingCode || !mapping?.roomCode) continue;
    const period = normalizeReadingPeriod(reading.currentMonth, new Date(reading.readingAt));
    const key = lockedPeriodKey({ buildingCode: mapping.buildingCode, roomCode: mapping.roomCode, period });
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function buildDataQualitySummary(monthlyRows: any[]) {
  const alerts: Array<Record<string, any>> = [];
  const grouped = new Map<string, any[]>();

  for (const row of monthlyRows) {
    const roomKey = `${row.buildingCode}:${row.roomCode}`;
    const current = grouped.get(roomKey) || [];
    current.push(row);
    grouped.set(roomKey, current);

    if (Number(row.duplicateReadings || 1) > 1) {
      alerts.push({
        type: "DUPLICATE",
        period: row.period,
        buildingCode: row.buildingCode,
        roomCode: row.roomCode,
        displayName: row.displayName,
        duplicateReadings: row.duplicateReadings,
        message: `${row.buildingCode} / ${row.displayName} có ${row.duplicateReadings} bản ghi trong kỳ ${row.period}.`,
      });
    }
  }

  let missingPeriods = 0;
  let abnormalPeriods = 0;

  for (const rows of grouped.values()) {
    const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
    const periods = new Set(sorted.map((row) => row.period));

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const previousEnergy = Number(previous.energyMonthKwh || 0);
      const currentEnergy = Number(current.energyMonthKwh || 0);
      const delta = currentEnergy - previousEnergy;

      if (previousEnergy >= 10 && currentEnergy >= previousEnergy * 2.5 && delta >= 30) {
        abnormalPeriods += 1;
        alerts.push({
          type: "ABNORMAL",
          period: current.period,
          buildingCode: current.buildingCode,
          roomCode: current.roomCode,
          displayName: current.displayName,
          previousEnergyKwh: previousEnergy,
          currentEnergyKwh: currentEnergy,
          message: `${current.buildingCode} / ${current.displayName} tăng từ ${previousEnergy.toLocaleString("vi-VN")} lên ${currentEnergy.toLocaleString("vi-VN")} kWh.`,
        });
      }
    }

    const firstPeriod = sorted[0]?.period;
    const lastPeriod = sorted[sorted.length - 1]?.period;
    if (!firstPeriod || !lastPeriod) continue;

    for (const period of enumeratePeriods(firstPeriod, lastPeriod)) {
      if (periods.has(period)) continue;
      missingPeriods += 1;
      alerts.push({
        type: "MISSING",
        period,
        buildingCode: sorted[0].buildingCode,
        roomCode: sorted[0].roomCode,
        displayName: sorted[0].displayName,
        message: `${sorted[0].buildingCode} / ${sorted[0].displayName} thiếu dữ liệu kỳ ${period}.`,
      });
    }
  }

  return {
    duplicatePeriods: alerts.filter((item) => item.type === "DUPLICATE").length,
    abnormalPeriods,
    missingPeriods,
    alerts: alerts
      .sort((left, right) => `${right.period}:${right.buildingCode}:${right.roomCode}`.localeCompare(`${left.period}:${left.buildingCode}:${left.roomCode}`))
      .slice(0, 120),
  };
}

function dedupeHistoryReadings(readings: any[]) {
  const latestByRoomPeriod = new Map<string, any>();
  for (const reading of readings) {
    const mapping = reading.meterMapping;
    if (!mapping?.buildingCode || !mapping?.roomCode) continue;
    const date = new Date(reading.readingAt);
    const period = normalizeReadingPeriod(reading.currentMonth, date);
    const key = `${mapping.buildingCode}:${mapping.roomCode}:${period}`;
    const current = latestByRoomPeriod.get(key);
    if (!current || compareReadingFreshness(reading, current) > 0) {
      latestByRoomPeriod.set(key, reading);
    }
  }
  return Array.from(latestByRoomPeriod.values()).sort((a, b) => {
    const left = new Date(a.readingAt).getTime();
    const right = new Date(b.readingAt).getTime();
    if (left !== right) return right - left;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function compareReadingFreshness(left: any, right: any) {
  const leftReadingAt = dateTimeValue(left.readingAt);
  const rightReadingAt = dateTimeValue(right.readingAt);
  if (leftReadingAt !== rightReadingAt) return leftReadingAt - rightReadingAt;
  return dateTimeValue(left.createdAt) - dateTimeValue(right.createdAt);
}

function enumeratePeriods(fromPeriod: string, toPeriod: string) {
  const from = getPeriodStart(fromPeriod);
  const to = getPeriodStart(toPeriod);
  if (from.getTime() > to.getTime()) return [];
  const periods: string[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    periods.push(getReadingPeriod(cursor));
    cursor.setMonth(cursor.getMonth() + 1, 1);
  }
  return periods;
}

function normalizeReadingPeriod(value: unknown, fallbackDate: Date) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  if (/^\d{1,2}$/.test(text)) {
    const month = Number(text);
    const year = Number.isNaN(fallbackDate.getTime()) ? new Date().getFullYear() : fallbackDate.getFullYear();
    return `${year}-${String(month).padStart(2, '0')}`;
  }
  return getReadingPeriod(fallbackDate);
}

function mapHistoryReading(reading: any) {
  const mapping = reading.meterMapping || {};
  return {
    id: reading.id,
    buildingCode: mapping.buildingCode,
    roomCode: mapping.roomCode,
    displayName: mapping.displayName,
    deviceName: mapping.deviceName,
    providerMeterId: mapping.providerMeterId,
    status: reading.status,
    powerCurrentW: Number(reading.powerCurrentW || 0),
    energyMonthKwh: Number(reading.energyMonthKwh || 0),
    moneyMonthVnd: Number(reading.moneyMonthVnd || 0),
    energyPrevMonthKwh: Number(reading.energyPrevMonthKwh || 0),
    moneyPrevMonthVnd: Number(reading.moneyPrevMonthVnd || 0),
    currentMonth: reading.currentMonth,
    readingAt: reading.readingAt,
    createdAt: reading.createdAt,
  };
}

function getThreeYearOptions() {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function mergeSavedHunonicSecrets(saved: HunonicSettings, incoming: HunonicSettings): HunonicSettings {
  return {
    ...saved,
    ...incoming,
    password: Object.prototype.hasOwnProperty.call(incoming, 'password') ? incoming.password : saved.password,
    websiteToken: Object.prototype.hasOwnProperty.call(incoming, 'websiteToken') ? incoming.websiteToken : saved.websiteToken,
    websiteCookie: Object.prototype.hasOwnProperty.call(incoming, 'websiteCookie') ? incoming.websiteCookie : saved.websiteCookie,
  };
}

function normalizeLockedPeriods(value: unknown): HunonicLockedPeriod[] {
  if (!Array.isArray(value)) return [];
  const rows = value
    .map((item) => normalizeLockedPeriod(item))
    .filter((item): item is HunonicLockedPeriod => Boolean(item));
  const unique = new Map<string, HunonicLockedPeriod>();
  for (const row of rows) unique.set(lockedPeriodKey(row), row);
  return Array.from(unique.values()).sort(compareLockedPeriods);
}

function normalizeLockedPeriod(value: any): HunonicLockedPeriod | null {
  const buildingCode = String(value?.buildingCode || '').trim();
  const roomCode = String(value?.roomCode || '').trim();
  const period = String(value?.period || '').trim();
  if (!buildingCode || !roomCode || !/^\d{4}-\d{2}$/.test(period)) return null;
  const lockedAt = value?.lockedAt ? new Date(value.lockedAt).toISOString() : undefined;
  const note = String(value?.note || '').trim() || undefined;
  return {
    buildingCode,
    roomCode,
    period,
    lockedAt: lockedAt && lockedAt !== 'Invalid Date' ? lockedAt : undefined,
    note,
  };
}

function lockedPeriodKey(value: { buildingCode: string; roomCode: string; period: string }) {
  return `${value.buildingCode}:${value.roomCode}:${value.period}`;
}

function compareLockedPeriods(left: HunonicLockedPeriod, right: HunonicLockedPeriod) {
  if (left.period !== right.period) return left.period < right.period ? 1 : -1;
  return lockedPeriodKey(left).localeCompare(lockedPeriodKey(right));
}

function getPeriodStart(period: string) {
  const [yearValue, monthValue] = String(period || '').split('-').map(Number);
  if (!Number.isFinite(yearValue) || !Number.isFinite(monthValue)) return new Date(0);
  return new Date(yearValue, monthValue - 1, 1, 0, 0, 0, 0);
}

function getPeriodEnd(period: string) {
  const [yearValue, monthValue] = String(period || '').split('-').map(Number);
  if (!Number.isFinite(yearValue) || !Number.isFinite(monthValue)) return new Date();
  return new Date(yearValue, monthValue, 0, 23, 59, 59, 999);
}
