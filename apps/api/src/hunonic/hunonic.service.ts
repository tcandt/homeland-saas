import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, SettingScope } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { HunonicElectricMeter, HunonicElectricityRateMode, HunonicMonthlyHistoryPoint, HunonicProvider, HunonicProviderOptions } from './hunonic.provider';
import { shouldRunGeneralSchedulers } from '../shared/config/runtime-mode';

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
  autoLockPreviousMonth?: boolean;
  lockedPeriods?: HunonicLockedPeriod[];
  appliedElectricityRates?: Record<string, HunonicAppliedElectricityRate>;
};

type HunonicAppliedElectricityRate = {
  rootId: string;
  meterMappingId?: string;
  buildingCode?: string;
  roomCode?: string;
  mode: HunonicElectricityRateMode;
  customRateVnd?: number | null;
  updatedAt: string;
};

type HunonicLockedPeriod = {
  buildingCode: string;
  roomCode: string;
  displayName?: string;
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

@Injectable()
export class HunonicService {
  private readonly logger = new Logger(HunonicService.name);
  private readonly prismaAny: any;

  constructor(private readonly prisma: PrismaService) {
    this.prismaAny = prisma as any;
  }

  /**
   * Dashboard callers retain the historical auto-lock behaviour.  Settlement
   * preflight, however, must be a pure read: a failed close must never leave a
   * meter period locked merely because its overview was inspected.
   */
  async getOverview(tenantId: string, options: { allowAutoLock?: boolean } = {}) {
    const settings = await this.getSettings(tenantId);
    const managedBuildingCodes = await this.getManagedBuildingCodes(tenantId);
    const rawMappings = await this.prismaAny.hunonicMeterMapping.findMany({
      where: { tenantId },
      include: {
        room: { select: { id: true, code: true, name: true, status: true } },
        building: { select: { id: true, code: true, name: true } },
        readings: { orderBy: { readingAt: 'desc' }, take: 1 },
      },
      orderBy: [{ buildingCode: 'asc' }, { roomCode: 'asc' }],
    });
    const mappings = dedupeMappingsByRoom(rawMappings);

    const latestLog = await this.prismaAny.hunonicSyncLog.findFirst({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
    });

    let lockedPeriods = normalizeLockedPeriods(settings.lockedPeriods);

    // Auto-lock previous month if enabled (default: true)
    if (options.allowAutoLock !== false && settings.autoLockPreviousMonth !== false && mappings.length > 0) {
      const now = new Date();
      const currentPeriod = getReadingPeriod(now);
      const prevPeriod = getPreviousPeriod(currentPeriod);
      const lockedMap = new Map(lockedPeriods.map((item) => [lockedPeriodKey(item), item]));
      let hasNewAutoLock = false;

      for (const mapping of mappings) {
        const raw = mapping.raw || {};
        const rootExtra = typeof raw.root_extra === 'string' ? parseJsonObject(raw.root_extra) : raw.root_extra || {};
        const dataExtra = typeof raw.data_extra === 'string' ? parseJsonObject(raw.data_extra) : raw.data_extra || {};
        const prevKwh = Number(rootExtra.power_of_prev_month ?? dataExtra.power_of_prev_month ?? 0);
        const prevVnd = Number(rootExtra.money_of_prev_month ?? dataExtra.money_of_prev_month ?? 0);

        if (prevKwh > 0 || prevVnd > 0) {
          const row: HunonicLockedPeriod = {
            buildingCode: mapping.buildingCode,
            roomCode: mapping.roomCode,
            period: prevPeriod,
            lockedAt: new Date().toISOString(),
            note: 'Tự động chốt kỳ tháng trước',
          };
          const key = lockedPeriodKey(row);
          if (!lockedMap.has(key)) {
            lockedMap.set(key, row);
            hasNewAutoLock = true;
          }
        }
      }

      if (hasNewAutoLock) {
        lockedPeriods = Array.from(lockedMap.values()).sort(compareLockedPeriods);
        settings.lockedPeriods = lockedPeriods;
        await this.saveSettings(tenantId, {
          ...settings,
          lockedPeriods,
        });
      }
    }

    return {
      managedBuildingCodes,
      summary: {
        mappings: mappings.length,
        online: mappings.filter((item: any) => item.lastStatus === 'on').length,
        totalEnergyMonthKwh: sumDecimal(mappings, 'lastReadingKwh'),
        totalMoneyMonthVnd: sumDecimal(mappings, 'lastAmountVnd'),
      },
      latestLog,
      lockedPeriods,
      meters: mappings.map((mapping: any) => {
        // The persisted dashboard payload is our last provider observation.
        // Resolve it with the same precedence used by the live rate endpoint:
        // an explicit Hunonic group wins; the locally recorded apply result is
        // only a fallback while a group is unavailable.
        const resolvedRate = resolveElectricityRateState({
          settings,
          rootId: mapping.providerRootId || mapping.providerMeterId,
          mapping,
          mobileMeter: mapping,
        });

        return {
          ...mapMeterMapping(mapping),
          rateMode: resolvedRate.currentMode,
          // Do not manufacture a unit rate.  A custom mode with no rate is
          // visible to the UI as provider data still needing confirmation.
          customRateVnd: resolvedRate.customRateVnd,
        };
      }),
    };
  }

  async getElectricityRates(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    const provider = new HunonicProvider(this.toProviderOptions({ ...settings, mode: 'mobile' }));
    const dashboard = await provider.fetchDashboardData();
    const managedBuildingCodes = await this.getManagedBuildingCodes(tenantId);
    const mobileRootByRoom = new Map<string, HunonicElectricMeter>();
    for (const meter of dashboard.electric_meters) {
      const fixed = resolveFixedRoomMapping(meter);
      const rootId = meter.provider_root_id || meter.provider_meter_id;
      if (fixed && rootId) mobileRootByRoom.set(canonicalRoomKey(fixed.buildingCode, fixed.roomCode), meter);
    }
    const rawMappings = await this.prismaAny.hunonicMeterMapping.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ buildingCode: 'asc' }, { roomCode: 'asc' }],
    });
    const mappings = dedupeMappingsByRoom(rawMappings);
    const rows = [];

    for (const mapping of mappings) {
      const mobileMeter = mobileRootByRoom.get(canonicalRoomKey(mapping.buildingCode, mapping.roomCode));
      const rootId = mobileMeter?.provider_root_id || mobileMeter?.provider_meter_id || mapping.providerRootId || mapping.providerMeterId;
      if (!rootId) continue;
      try {
        const groups = await provider.fetchElectricityRateGroups(rootId);
        const custom = groups.find((group) => group.id === '1' || normalizeText(group.name).includes('tu thiet lap'));
        const residential = groups.find((group) => group.id === '2' || normalizeText(group.name).includes('sinh hoat'));
        const resolvedRate = resolveElectricityRateState({ settings, rootId, mapping, mobileMeter, groups, custom });
        rows.push({
          id: mapping.id,
          buildingCode: mapping.buildingCode,
          roomCode: mapping.roomCode,
          displayName: mapping.displayName,
          deviceName: mobileMeter?.name || mapping.deviceName,
          providerRootId: rootId,
          providerMeterId: mobileMeter?.provider_meter_id || mapping.providerMeterId,
          currentMode: resolvedRate.currentMode,
          customRateVnd: resolvedRate.customRateVnd,
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
    const meterIds = Array.isArray(input.meterIds) ? uniqueStrings(input.meterIds) : [];
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
    const managedBuildingCodes = await this.getManagedBuildingCodes(tenantId);
    const mobileRootByRoom = new Map<string, HunonicElectricMeter>();
    for (const meter of dashboard.electric_meters) {
      const fixed = resolveFixedRoomMapping(meter);
      const rootId = meter.provider_root_id || meter.provider_meter_id;
      if (fixed && rootId) mobileRootByRoom.set(canonicalRoomKey(fixed.buildingCode, fixed.roomCode), meter);
    }

    const mappings = await this.prismaAny.hunonicMeterMapping.findMany({
      where: {
        tenantId,
        id: { in: meterIds },
        enabled: true,
      },
      orderBy: [{ buildingCode: 'asc' }, { roomCode: 'asc' }],
    });

    const updated = [];
    const errors = [];

    for (const mapping of mappings) {
      const mobileMeter = mobileRootByRoom.get(canonicalRoomKey(mapping.buildingCode, mapping.roomCode));
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
          buildingCode: mapping.buildingCode,
          roomCode: mapping.roomCode,
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

    if (updated.length > 0) {
      const updatedAt = new Date().toISOString();
      await this.saveSettings(tenantId, {
        ...settings,
        appliedElectricityRates: mergeAppliedElectricityRates(settings.appliedElectricityRates, updated.map((item) => ({
          rootId: item.rootId,
          meterMappingId: item.id,
          buildingCode: item.buildingCode,
          roomCode: item.roomCode,
          mode,
          customRateVnd: mode === 'custom' ? customRateVnd : null,
          updatedAt,
        }))),
      });
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
    let mapping = await this.prismaAny.hunonicMeterMapping.findFirst({
      where: { tenantId, roomId, enabled: true },
      orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
      include: {
        readings: {
          orderBy: { readingAt: 'desc' },
          take: 12,
        },
      },
    });

    if (!mapping) {
      const room = await this.prisma.room.findFirst({
        where: { tenantId, id: roomId, deletedAt: null },
        include: { building: { select: { code: true } } },
      });
      if (room?.building?.code) {
        mapping = await this.prismaAny.hunonicMeterMapping.findFirst({
          where: {
            tenantId,
            enabled: true,
            roomCode: { in: roomCodeVariants(room.code) },
            buildingCode: { in: buildingCodeVariants(room.building.code) },
          },
          orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
          include: {
            readings: {
              orderBy: { readingAt: 'desc' },
              take: 12,
            },
          },
        });
      }
    }

    if (!mapping) return null;
    if (!hasSavedElectricityData(mapping) && (!Array.isArray(mapping.readings) || mapping.readings.length === 0)) {
      return null;
    }

    return {
      ...mapMeterMapping(mapping),
      readings: mapping.readings.map(mapReading),
    };
  }

  async getRoomElectricityPricing(tenantId: string, roomId: string) {
    let mapping = await this.prismaAny.hunonicMeterMapping.findFirst({
      where: { tenantId, roomId, enabled: true },
      orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
    });

    if (!mapping) {
      const room = await this.prisma.room.findFirst({
        where: { tenantId, id: roomId, deletedAt: null },
        include: { building: { select: { code: true } } },
      });
      if (room?.building?.code) {
        mapping = await this.prismaAny.hunonicMeterMapping.findFirst({
          where: {
            tenantId,
            enabled: true,
            roomCode: { in: roomCodeVariants(room.code) },
            buildingCode: { in: buildingCodeVariants(room.building.code) },
          },
          orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
        });
      }
    }

    if (!mapping) return null;

    const settings = await this.getSettings(tenantId);
    const provider = new HunonicProvider(this.toProviderOptions({ ...settings, mode: 'mobile' }));
    const dashboard = await provider.fetchDashboardData();
    const mobileRootByRoom = new Map<string, HunonicElectricMeter>();

    for (const meter of dashboard.electric_meters) {
      const fixed = resolveFixedRoomMapping(meter);
      const rootId = meter.provider_root_id || meter.provider_meter_id;
      if (fixed && rootId) mobileRootByRoom.set(canonicalRoomKey(fixed.buildingCode, fixed.roomCode), meter);
    }

    const mobileMeter = mobileRootByRoom.get(canonicalRoomKey(mapping.buildingCode, mapping.roomCode));
    const rootId = mobileMeter?.provider_root_id || mobileMeter?.provider_meter_id || mapping.providerRootId || mapping.providerMeterId;
    if (!rootId) return null;

    const groups = await provider.fetchElectricityRateGroups(rootId);
    const custom = groups.find((group) => group.id === '1' || normalizeText(group.name).includes('tu thiet lap'));
    const residential = groups.find((group) => group.id === '2' || normalizeText(group.name).includes('sinh hoat'));
    const resolvedRate = resolveElectricityRateState({ settings, rootId, mapping, mobileMeter, groups, custom });

    return {
      meterId: mapping.id,
      providerRootId: rootId,
      providerMeterId: mobileMeter?.provider_meter_id || mapping.providerMeterId,
      currentMode: resolvedRate.currentMode,
      customRateVnd: resolvedRate.customRateVnd,
      residentialSteps: residential?.rates || [],
    };
  }

  async getHistory(tenantId: string, query: HunonicHistoryQuery) {
    const settings = await this.getSettings(tenantId);
    const lockedPeriods = normalizeLockedPeriods(settings.lockedPeriods);
    const managedBuildingCodes = await this.getManagedBuildingCodes(tenantId);
    const page = clampNumber(Number(query.page || 1), 1, 9999);
    const limit = clampNumber(Number(query.limit || 25), 5, 200);
    const dateRange = resolveHistoryDateRange(query);
    const search = String(query.search || '').trim();

    const relationFilter: any = {};
    if (query.buildingCode && query.buildingCode !== 'all') {
      relationFilter.buildingCode = { in: buildingCodeVariants(query.buildingCode) };
    }

    if (query.roomCode && query.roomCode !== 'all') {
      relationFilter.roomCode = { in: roomCodeVariants(query.roomCode) };
    }
    if (search) {
      relationFilter.OR = [
        { buildingCode: { contains: search, mode: 'insensitive' } },
        { roomCode: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { deviceName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const targetPeriod = (query.year && query.year !== 'all' && query.month && query.month !== 'all')
      ? `${query.year}-${String(query.month).padStart(2, '0')}`
      : null;

    // sourcePeriod is the provider's billing month.  readingAt records when
    // that aggregate was observed, so it must not drive period filtering:
    // a late August backfill observed in September remains August data.
    const timeFilter = targetPeriod
      ? { sourcePeriod: targetPeriod }
      : query.year && query.year !== 'all'
        ? { sourcePeriod: { startsWith: `${query.year}-` } }
        : {
            sourcePeriod: {
              gte: getReadingPeriod(dateRange.from),
              lte: getReadingPeriod(dateRange.to),
            },
          };

    const where = {
      tenantId,
      ...timeFilter,
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
        where: { tenantId },
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
        // Totals include only fields supplied by Hunonic.  Incomplete rows
        // are explicitly reported below and are never financial evidence.
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

  async getSyncLogs(tenantId: string, query?: { limit?: string; page?: string }) {
    const page = Math.max(1, Number(query?.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query?.limit || 30)));
    const [total, logs] = await Promise.all([
      this.prismaAny.hunonicSyncLog.count({ where: { tenantId } }),
      this.prismaAny.hunonicSyncLog.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      logs,
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
    const invoiceItems = await this.prismaAny.invoiceItem.findMany({
      where: {
        tenantId,
        type: 'UTILITY_ELECTRICITY' as any,
        servicePeriod: { in: periods },
        billingSnapshotId: { not: null },
        invoice: {
          tenantId,
          deletedAt: null,
          billingKind: 'MONTHLY_BASE',
        },
      },
      include: {
        invoice: { select: { id: true } },
        billingSnapshot: {
          select: {
            tenantId: true,
            usagePeriod: true,
            meterMappingId: true,
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

    const invoiceByEvidence = new Map<string, { invoiceAmount: number; invoiceIds: Set<string> }>();
    for (const item of invoiceItems) {
      const snapshot = item.billingSnapshot;
      const buildingCode = snapshot?.room?.building?.code;
      const roomCode = snapshot?.room?.code;
      if (
        !snapshot ||
        snapshot.tenantId !== tenantId ||
        !snapshot.meterMappingId ||
        !buildingCode ||
        !roomCode ||
        item.servicePeriod !== snapshot.usagePeriod
      ) continue;
      const canonicalRoom = canonicalRoomKey(buildingCode, roomCode);
      const evidenceKey = `${canonicalRoom}:${snapshot.usagePeriod}:${snapshot.meterMappingId}`;
      const current = invoiceByEvidence.get(evidenceKey) || { invoiceAmount: 0, invoiceIds: new Set<string>() };
      current.invoiceAmount += Number(item.amount || 0);
      current.invoiceIds.add(item.invoice.id);
      invoiceByEvidence.set(evidenceKey, current);
    }

    const rows = monthlyRows.map((row: any) => {
      const key = `${canonicalRoomKey(row.buildingCode, row.roomCode)}:${row.period}:${row.meterMappingId || ''}`;
      const invoice = invoiceByEvidence.get(key);
      const hunonicAmount = Number(row.moneyMonthVnd || 0);
      const invoiceAmount = Number(invoice?.invoiceAmount || 0);
      const diffAmount = invoice ? invoiceAmount - hunonicAmount : null;
      return {
        ...row,
        invoiceAmountVnd: invoice ? invoiceAmount : null,
        invoiceCount: invoice?.invoiceIds.size || 0,
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
      const backfillMonths = options.backfillMonths !== undefined ? options.backfillMonths : 12;
      const provider = new HunonicProvider(this.toProviderOptions({ ...settings, mode: preferredMode }));
      const backfill = backfillMonths > 0
        ? await provider.fetchRecentMonthlyHistory(backfillMonths).catch((err) => {
            this.logger.warn(`Failed to fetch recent monthly history: ${err?.message}`);
            return null;
          })
        : null;
      const dashboard = backfill?.dashboard || await provider.fetchDashboardData();
      const buildings = await this.prisma.building.findMany({
        where: { tenantId, deletedAt: null },
        include: { rooms: { where: { deletedAt: null } } },
      });
      const roomIndex = createRoomIndex(buildings);
      let readingsSaved = 0;
      const mappingByProviderMeterId = new Map<string, any>();
      const autoLockRows: HunonicLockedPeriod[] = [];

      for (const meter of dashboard.electric_meters) {
        const fixed = resolveFixedRoomMapping(meter, buildings);
        if (!fixed) continue;
        const readingAt = meter.updated_at ? new Date(meter.updated_at) : new Date(dashboard.exported_at);
        const providerMeterId = meter.provider_meter_id || meter.provider_device_id;
        if (!providerMeterId || Number.isNaN(readingAt.getTime())) continue;

        const roomMatch = (fixed.buildingId || fixed.roomId)
          ? { buildingId: fixed.buildingId, roomId: fixed.roomId }
          : roomIndex.get(canonicalRoomKey(fixed.buildingCode, fixed.roomCode));

        const mapping = await this.upsertMeterMappingByRoom(
          tenantId,
          providerMeterId,
          roomMatch,
          fixed,
          meter,
          new Date(dashboard.exported_at),
        );
        const entry = { mapping, roomId: roomMatch?.roomId, meter, fixed };
        mappingByProviderMeterId.set(providerMeterId, entry);
        if (meter.provider_root_id) mappingByProviderMeterId.set(meter.provider_root_id, entry);
        if (meter.provider_device_id) mappingByProviderMeterId.set(meter.provider_device_id, entry);

        const currentPeriod = getReadingPeriod(readingAt);
        const upserted = await this.upsertMonthlyReading(
          tenantId,
          mapping,
          roomMatch?.roomId,
          currentPeriod,
          readingAt,
          meter,
        );
        if (upserted) readingsSaved += 1;

        // Auto-save and auto-lock previous month reading when available
        const prevPeriod = getPreviousPeriod(currentPeriod);
        if (meter.energy_prev_month_kwh !== null || meter.money_prev_month_vnd !== null) {
          const prevReadingAt = getPeriodReadingAt(prevPeriod);
          const prevMeter: HunonicElectricMeter = {
            ...meter,
            energy_month_kwh: meter.energy_prev_month_kwh,
            money_month_vnd: meter.money_prev_month_vnd,
            current_month: prevPeriod,
          };
          const upsertedPrev = await this.upsertMonthlyReading(
            tenantId,
            mapping,
            roomMatch?.roomId,
            prevPeriod,
            prevReadingAt,
            prevMeter,
          );
          if (upsertedPrev) readingsSaved += 1;

          if (settings.autoLockPreviousMonth !== false) {
            autoLockRows.push({
              buildingCode: fixed.buildingCode,
              roomCode: fixed.roomCode,
              displayName: fixed.displayName,
              period: prevPeriod,
              lockedAt: new Date().toISOString(),
              note: 'Tự động chốt kỳ tháng trước',
            });
          }
        }
      }

      if (autoLockRows.length > 0) {
        const currentLocked = normalizeLockedPeriods(settings.lockedPeriods);
        const lockedMap = new Map(currentLocked.map((item) => [lockedPeriodKey(item), item]));
        let hasNewLock = false;

        for (const row of autoLockRows) {
          const key = lockedPeriodKey(row);
          if (!lockedMap.has(key)) {
            lockedMap.set(key, row);
            hasNewLock = true;
          }
        }

        if (hasNewLock) {
          const nextSettings: HunonicSettings = {
            ...settings,
            lockedPeriods: Array.from(lockedMap.values()).sort(compareLockedPeriods),
          };
          await this.saveSettings(tenantId, nextSettings);
        }
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
    if (!shouldRunGeneralSchedulers()) return;
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

  private async getManagedBuildingCodes(tenantId: string) {
    const buildings = await this.prisma.building.findMany({
      where: { tenantId, deletedAt: null },
      select: { code: true },
      orderBy: { code: 'asc' },
    });
    return uniqueStrings(buildings.flatMap((building) => buildingCodeVariants(building.code)));
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
    const lastReadingKwh = decimalOrNull(meter.energy_month_kwh);
    const lastAmountVnd = decimalOrNull(meter.money_month_vnd);
    const identity = {
      providerMeterId,
      providerDeviceId: meter.provider_device_id,
      providerRootId: meter.provider_root_id,
      providerHomeId: meter.provider_home_id,
      providerRoomId: meter.provider_room_id,
    };
    const data = {
      buildingId: roomMatch?.buildingId,
      roomId: roomMatch?.roomId,
      buildingCode: fixed.buildingCode,
      roomCode: fixed.roomCode,
      displayName: fixed.displayName,
      homeName: meter.home_name,
      roomName: meter.room_name,
      deviceName: meter.name || fixed.displayName,
      rootType: meter.root_type,
      enabled: true,
      lastStatus: meter.status,
      ...(lastReadingKwh !== null ? { lastReadingKwh } : {}),
      ...(lastAmountVnd !== null ? { lastAmountVnd } : {}),
      lastSyncedAt: exportedAt,
      raw: sanitizeRaw(meter),
    };

    const existingByProvider = await this.prismaAny.hunonicMeterMapping.findUnique({
      where: { tenantId_providerMeterId: { tenantId, providerMeterId } },
    });
    if (existingByProvider) {
      const scopeChanged =
        (Boolean(roomMatch?.buildingId) && existingByProvider.buildingId !== roomMatch?.buildingId) ||
        (Boolean(roomMatch?.roomId) && existingByProvider.roomId !== roomMatch?.roomId) ||
        canonicalBuildingCode(existingByProvider.buildingCode) !== canonicalBuildingCode(fixed.buildingCode) ||
        canonicalRoomCode(existingByProvider.roomCode) !== canonicalRoomCode(fixed.roomCode);
      if (scopeChanged) {
        throw new ConflictException('HUNONIC_MAPPING_SCOPE_CHANGE_REQUIRES_REVIEW');
      }
      const {
        buildingId: _buildingId,
        roomId: _roomId,
        buildingCode: _buildingCode,
        roomCode: _roomCode,
        ...nonScopeData
      } = data;
      return this.prismaAny.hunonicMeterMapping.update({
        where: { id: existingByProvider.id },
        // Provider identity is retained as evidence once a mapping is used.
        data: nonScopeData,
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
      // A changed meter receives a new mapping rather than rewriting the
      // provider identity of readings and snapshots already in evidence.
      await this.prismaAny.hunonicMeterMapping.update({
        where: { id: existingByRoom.id },
        data: { enabled: false, lastSyncedAt: exportedAt },
      });
    }

    return this.prismaAny.hunonicMeterMapping.create({
      data: {
        tenantId,
        ...data,
        ...identity,
      },
    });
  }

  private async upsertMonthlyReading(
    tenantId: string,
    meterMapping: { id: string; buildingCode: string; roomCode: string; roomId?: string | null; providerMeterId?: string; provider?: string },
    roomId: string | undefined,
    period: string,
    readingAt: Date,
    meter: HunonicElectricMeter,
  ) {
    if (!hasMonthlyElectricityData(meter)) {
      return false;
    }

    const raw = sanitizeRaw(meter);
    const sourceProviderMeterId = meter.provider_meter_id || meterMapping.providerMeterId || meter.provider_device_id;
    if (!sourceProviderMeterId) return false;
    const payloadHash = hashExactObservation({
      provider: meterMapping.provider || 'hunonic',
      providerMeterId: sourceProviderMeterId,
      period,
      observedAt: readingAt.toISOString(),
      aggregateBasis: 'MONTHLY_AGGREGATE_V1',
      payload: raw,
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
          sourceProvider: meterMapping.provider || 'hunonic',
          sourceProviderMeterId,
          sourcePeriod: period,
          observedAt: readingAt,
          payloadHash,
          aggregateBasis: 'MONTHLY_AGGREGATE_V1',
          raw,
    };
    const persist = async (db: any) => {
      const result = await db.hunonicMeterReading.createMany({
        data: [data],
        skipDuplicates: true,
      });
      if (result.count === 1) return true;
      if (result.count === 0) {
        const duplicate = await db.hunonicMeterReading.findFirst({
          where: { tenantId, meterMappingId: meterMapping.id, payloadHash },
        });
        if (duplicate) return false;
      }
      throw new ConflictException('HUNONIC_READING_UNEXPECTED_UNIQUE_CONFLICT');
    };
    const lockKey = billingEvidenceLockKey(tenantId, roomId || meterMapping.roomId || meterMapping.roomCode, period);
    if (typeof this.prismaAny.$transaction !== 'function') return persist(this.prismaAny);
    return this.prismaAny.$transaction(async (tx: any) => {
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"`);
      }
      return persist(tx);
    });
  }

  private isLockedPeriod(settings: HunonicSettings, buildingCode: string, roomCode: string, period: string) {
    const lockedPeriods = normalizeLockedPeriods(settings.lockedPeriods);
    const roomKey = canonicalRoomKey(buildingCode, roomCode);
    return lockedPeriods.some((item) => item.period === period && canonicalRoomKey(item.buildingCode, item.roomCode) === roomKey);
  }
}

function isIgnoredHunonicMeter(meter: HunonicElectricMeter) {
  const name = String(meter.name || '');
  const roomName = String(meter.room_name || '');
  const homeName = String(meter.home_name || '');
  const combined = normalizeText(`${name} ${roomName} ${homeName}`);
  return (
    combined.includes('nha cua tinh') ||
    (combined.includes('tinh') && combined.includes('nha')) ||
    combined.includes('nlmt')
  );
}

function resolveFixedRoomMapping(meter: HunonicElectricMeter, buildings: Array<any> = []) {
  if (isIgnoredHunonicMeter(meter)) {
    return null;
  }

  const name = String(meter.name || '').trim();
  const roomName = String(meter.room_name || '').trim();
  const homeName = String(meter.home_name || '').trim();
  const candidates = [name, roomName, homeName].filter(Boolean);

  // 1. Match Office / Văn phòng
  const officeMatch = candidates.some((value) => {
    const norm = normalizeText(value);
    return norm.includes('van phong') || norm.includes('office') || norm.includes('vp');
  });
  if (officeMatch) {
    const matchedBuilding = buildings.find((b) =>
      normalizeText(b.code).includes('32') || normalizeText(b.name).includes('32')
    );
    const matchedRoom = matchedBuilding?.rooms?.find((r: any) => {
      const rNorm = normalizeText(r.name || r.code);
      return rNorm.includes('van phong') || rNorm.includes('vp') || r.code.includes('32-01') || r.name.includes('32-01');
    });
    return {
      buildingId: matchedBuilding?.id,
      roomId: matchedRoom?.id,
      buildingCode: matchedBuilding?.code || 'LK01.32',
      roomCode: matchedRoom?.code || 'PN 32-01',
      displayName: matchedRoom?.name || 'PN 32-01',
    };
  }

  // 2. Extract Room Code (e.g. 31.01, 31-01, 32.06, 24.01)
  const code = candidates.map(extractRoomCode).find(Boolean);
  if (code) {
    const buildingNo = code.split('-')[0];
    const matchedBuilding = buildings.find((b) =>
      normalizeText(b.code).includes(buildingNo) || normalizeText(b.name).includes(buildingNo)
    );
    const matchedRoom = matchedBuilding?.rooms?.find((r: any) =>
      canonicalRoomCode(r.code) === code ||
      canonicalRoomCode(r.name) === code ||
      canonicalRoomCode(r.code) === canonicalRoomCode(code) ||
      r.code.includes(code)
    );
    if (matchedBuilding) {
      return {
        buildingId: matchedBuilding.id,
        roomId: matchedRoom?.id,
        buildingCode: matchedBuilding.code,
        roomCode: matchedRoom?.code || `PN ${code}`,
        displayName: matchedRoom?.name || matchedRoom?.code || `PN ${code}`,
      };
    }
  }

  // 3. Direct match with rooms in buildings
  if (buildings.length > 0) {
    for (const b of buildings) {
      for (const r of b.rooms || []) {
        const rCode = String(r.code || '').trim();
        const rName = String(r.name || '').trim();
        const rCodeCanon = canonicalRoomCode(rCode);
        const rNameCanon = canonicalRoomCode(rName);
        const rCodeNorm = normalizeText(rCode);
        const rNameNorm = normalizeText(rName);

        for (const candidate of candidates) {
          const cCanon = canonicalRoomCode(candidate);
          const cNorm = normalizeText(candidate);
          if (
            (rCodeCanon && (cCanon === rCodeCanon || cCanon.endsWith(`-${rCodeCanon}`))) ||
            (rNameCanon && (cCanon === rNameCanon || cCanon.endsWith(`-${rNameCanon}`))) ||
            (rCodeNorm && (cNorm === rCodeNorm || cNorm.includes(rCodeNorm)))
          ) {
            return {
              buildingId: b.id,
              roomId: r.id,
              buildingCode: b.code,
              roomCode: r.code,
              displayName: r.name || r.code,
            };
          }
        }
      }
    }
  }

  return null;
}

function extractRoomCode(value: string) {
  const matchTwoPart = value.match(/(?:DIEN|P|PN|PHONG|PHÒNG|\b)?\s*(\d{1,3})[.\-\s](\d{1,3})/i);
  if (matchTwoPart) return `${matchTwoPart[1]}-${matchTwoPart[2]}`;
  const matchSingle = value.match(/(?:DIEN|P|PN|PHONG|PHÒNG|\b)\s*(\d{3,4})\b/i);
  if (matchSingle) return matchSingle[1];
  return null;
}

function buildingCodeVariants(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) return [];
  const hyphen = normalized.replace(/\./g, '-');
  const dot = normalized.replace(/-/g, '.');
  return uniqueStrings([normalized, hyphen, dot]);
}

function canonicalBuildingCode(value: string | null | undefined) {
  return String(value || '').trim().replace(/\./g, '-');
}

function canonicalRoomKey(buildingCode: string | null | undefined, roomCode: string | null | undefined) {
  return `${canonicalBuildingCode(buildingCode)}:${canonicalRoomCode(roomCode)}`;
}

// This key is intentionally shared with monthly settlement.  It serializes an
// imported observation and the first locked billing snapshot for one room/kỳ.
function billingEvidenceLockKey(tenantId: string, roomIdentity: string, period: string) {
  return `${tenantId}:billing-evidence:${roomIdentity}:${period}`;
}

function stableJson(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashExactObservation(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function canonicalRoomCode(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/^PN\s+/i, '')
    .replace(/[.\s]+/g, '-')
    .toUpperCase();
}

function roomCodeVariants(value: string | null | undefined) {
  const canonical = canonicalRoomCode(value);
  if (!canonical) return [];
  return uniqueStrings([canonical, `PN ${canonical}`, canonical.replace(/-/g, '.')]);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}


function hasMonthlyElectricityData(meter: HunonicElectricMeter) {
  return isPresentNumber(meter.energy_month_kwh) || isPresentNumber(meter.money_month_vnd);
}

function hasSavedElectricityData(mapping: any) {
  return mapping.lastReadingKwh !== null
    && mapping.lastReadingKwh !== undefined
    || mapping.lastAmountVnd !== null
    && mapping.lastAmountVnd !== undefined;
}

function isPresentNumber(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return Number.isFinite(Number(value));
}
function createRoomIndex(buildings: Array<any>) {
  const index = new Map<string, { buildingId: string; roomId: string }>();
  for (const building of buildings) {
    for (const room of building.rooms || []) {
      index.set(canonicalRoomKey(building.code, room.code), { buildingId: building.id, roomId: room.id });
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

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizeRaw(meter: HunonicElectricMeter) {
  const { raw, ...safe } = meter;
  return (raw || safe) as Prisma.InputJsonValue;
}

function dedupeMappingsByRoom<T extends Record<string, any>>(mappings: T[]): T[] {
  const bestByRoom = new Map<string, T>();
  for (const mapping of mappings) {
    const key = canonicalRoomKey(mapping.buildingCode, mapping.roomCode);
    const current = bestByRoom.get(key);
    if (!current || compareMappingFreshness(mapping, current) > 0) {
      bestByRoom.set(key, mapping);
    }
  }
  return mappings.filter((mapping) => bestByRoom.get(canonicalRoomKey(mapping.buildingCode, mapping.roomCode)) === mapping);
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
  const raw = mapping.raw || {};
  const dataExtra = typeof raw.data_extra === 'string' ? parseJsonObject(raw.data_extra) : raw.data_extra || {};
  const rootExtra = typeof raw.root_extra === 'string' ? parseJsonObject(raw.root_extra) : raw.root_extra || {};
  const valueObj = typeof raw.value === 'string' ? parseJsonObject(raw.value) : raw.value || {};

  const rawPower =
    mapping.readings?.[0]?.powerCurrentW ??
    dataExtra.power_current ??
    dataExtra.power ??
    dataExtra.p ??
    rootExtra.power_current ??
    rootExtra.power ??
    valueObj.power ??
    valueObj.power_current ??
    raw.power_current;

  return {
    id: mapping.id,
    buildingId: mapping.buildingId,
    roomId: mapping.roomId,
    buildingCode: mapping.buildingCode,
    roomCode: mapping.roomCode,
    displayName: mapping.displayName,
    deviceName: mapping.deviceName,
    status: mapping.lastStatus,
    powerCurrentW: Number(rawPower || 0),
    energyMonthKwh: Number(mapping.lastReadingKwh || 0),
    moneyMonthVnd: Number(mapping.lastAmountVnd || 0),
    energyPrevMonthKwh: Number(rootExtra.power_of_prev_month ?? dataExtra.power_of_prev_month ?? 0),
    moneyPrevMonthVnd: Number(rootExtra.money_of_prev_month ?? dataExtra.money_of_prev_month ?? 0),
    currentMonth: rootExtra.current_month || null,
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
    energyMonthKwh: numberOrNull(reading.energyMonthKwh),
    moneyMonthVnd: numberOrNull(reading.moneyMonthVnd),
    currentMonth: reading.currentMonth,
  };
}

function getReadingPeriod(readingAt: Date) {
  const date = Number.isNaN(readingAt.getTime()) ? new Date() : readingAt;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

function getPreviousPeriod(period: string) {
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new BadRequestException('HUNONIC_PERIOD_INVALID');
  }
  const [yearStr, monthStr] = period.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  if (month === 1) {
    year -= 1;
    month = 12;
  } else {
    month -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getPeriodReadingAt(period: string) {
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new BadRequestException('HUNONIC_PERIOD_INVALID');
  }
  const [yearValue, monthValue] = period.split('-').map(Number);
  return new Date(Date.UTC(yearValue, monthValue, 1, -7, 0, 0, 0) - 1);
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

function getActiveElectricityGroupId(meter?: HunonicElectricMeter, groups?: any[]) {
  const raw = meter?.raw as any;
  const rootExtra = parseJsonObject(raw?.root_extra);
  const dataExtra = parseJsonObject(raw?.data_extra);
  const value = parseJsonObject(raw?.value);

  // Check from groups array if any group has active indicator from Hunonic API
  if (Array.isArray(groups)) {
    const activeGroup = groups.find((g: any) => {
      const gRaw = g?.raw || {};
      return (
        g.is_active === 1 || g.is_active === true || g.is_active === '1' ||
        g.selected === 1 || g.selected === true || g.selected === '1' ||
        g.is_check === 1 || g.is_check === true || g.is_check === '1' ||
        g.checked === 1 || g.checked === true || g.checked === '1' ||
        g.active === 1 || g.active === true || g.active === '1' ||
        g.status === 1 || g.status === '1' ||
        gRaw.is_active === 1 || gRaw.selected === 1 || gRaw.is_check === 1 || gRaw.status === 1
      );
    });
    if (activeGroup?.id) return String(activeGroup.id);
  }

  const groupId =
    dataExtra?.electricity_group_id ??
    rootExtra?.electricity_group_id ??
    value?.electricity_group_id ??
    raw?.electricity_group_id ??
    rootExtra?.group_id ??
    dataExtra?.group_id ??
    raw?.group_id;

  return groupId === null || groupId === undefined || groupId === '' ? null : String(groupId);
}

function resolveElectricityRateState({
  settings,
  rootId,
  mapping,
  mobileMeter,
  groups,
  custom,
}: {
  settings: HunonicSettings;
  rootId: string;
  mapping: any;
  mobileMeter?: HunonicElectricMeter;
  groups?: any[];
  custom?: { rates?: Array<{ price: number | null }> };
}) {
  const activeGroupId = getActiveElectricityGroupId(mobileMeter, groups);
  const cachedRate = getCachedElectricityRate(settings, rootId, mapping);

  let currentMode: HunonicElectricityRateMode = 'residential';
  if (activeGroupId === '1') {
    currentMode = 'custom';
  } else if (activeGroupId === '2') {
    currentMode = 'residential';
  } else if (cachedRate?.mode) {
    currentMode = cachedRate.mode;
  } else {
    currentMode = 'residential';
  }

  const customRateVnd = currentMode === 'custom'
    // electricityRate is authoritative when it explicitly identifies the
    // active custom group; cached apply data is only a fallback.
    ? getActiveCustomUnitRate(mobileMeter, activeGroupId === '1' ? custom : undefined)
      ?? cachedRate?.customRateVnd
      ?? firstPositiveRate(custom?.rates)
    : null;

  return { currentMode, customRateVnd };
}

function firstPositiveRate(rates?: Array<{ price: number | null }>) {
  const price = rates?.map((item) => Number(item?.price)).find((item) => Number.isFinite(item) && item > 0);
  return price === undefined ? null : Math.round(price);
}

function getCachedElectricityRate(settings: HunonicSettings, rootId: string, mapping: any) {
  const values = Object.values(settings.appliedElectricityRates || {});
  const mappingRoomKey = canonicalRoomKey(mapping?.buildingCode, mapping?.roomCode);
  return values.find((item) => item.rootId === rootId)
    || values.find((item) => item.meterMappingId && item.meterMappingId === mapping?.id)
    || values.find((item) => canonicalRoomKey(item.buildingCode, item.roomCode) === mappingRoomKey)
    || null;
}

function mergeAppliedElectricityRates(
  current: HunonicSettings['appliedElectricityRates'] | undefined,
  updates: HunonicAppliedElectricityRate[],
) {
  const next = { ...(current || {}) };
  for (const update of updates) {
    next[update.rootId] = update;
  }
  return next;
}

function getActiveCustomUnitRate(meter?: any, custom?: { rates?: Array<{ price: number | null }> }) {
  if (custom?.rates?.[0]?.price) {
    const p = Number(custom.rates[0].price);
    if (Number.isFinite(p) && p > 0) return Math.round(p);
  }
  const raw = (meter?.raw || meter) as any;
  const rootExtra = typeof raw?.root_extra === 'string' ? parseJsonObject(raw?.root_extra) : raw?.root_extra || {};
  const dataExtra = typeof raw?.data_extra === 'string' ? parseJsonObject(raw?.data_extra) : raw?.data_extra || {};
  const candidates = [
    rootExtra?.rate,
    rootExtra?.price,
    rootExtra?.money,
    dataExtra?.rate,
    dataExtra?.price,
    dataExtra?.money,
    raw?.rate,
    raw?.price,
    raw?.money,
    firstRatePrice(rootExtra?.electricity_rate),
    firstRatePrice(dataExtra?.electricity_rate),
    firstRatePrice(raw?.electricity_rate),
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return Math.round(value);
  }
  return null;
}

function firstRatePrice(value: unknown) {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value) && (value as any).price) {
    const p = Number((value as any).price);
    return Number.isFinite(p) && p > 0 ? p : null;
  }
  const rates = Array.isArray(value) ? value : parseJsonObject(value);
  if (typeof rates === 'object' && !Array.isArray(rates) && (rates as any).price) {
    const p = Number((rates as any).price);
    return Number.isFinite(p) && p > 0 ? p : null;
  }
  if (!Array.isArray(rates)) return null;
  const rate = rates.find((item) => Number(item?.price) > 0);
  return rate?.price ? Number(rate.price) : null;
}

function parseJsonObject(value: unknown): any {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function resolveHistoryDateRange(query: HunonicHistoryQuery) {
  const now = new Date();
  const threeYearsAgo = new Date(now);
  threeYearsAgo.setFullYear(now.getFullYear() - 3);

  if (query.year && query.year !== 'all') {
    const year = Number(query.year);
    const month = query.month && query.month !== 'all' ? Number(query.month) : null;
    if (Number.isFinite(year) && month && month >= 1 && month <= 12) {
      const period = `${year}-${String(month).padStart(2, '0')}`;
      return {
        from: getPeriodStart(period),
        to: getPeriodEnd(period),
      };
    }
    if (Number.isFinite(year)) {
      return {
        from: getPeriodStart(`${year}-01`),
        to: getPeriodEnd(`${year}-12`),
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

    let year: number;
    let month: number;
    let period: string;

    const sourcePeriod = normalizeReadingPeriod(reading.sourcePeriod ?? reading.currentMonth, new Date(reading.readingAt));
    if (/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(sourcePeriod)) {
      period = sourcePeriod;
      const parts = period.split('-');
      year = Number(parts[0]);
      month = Number(parts[1]);
    } else {
      period = getReadingPeriod(new Date(reading.readingAt));
      [year, month] = period.split('-').map(Number);
    }

    const key = `${canonicalRoomKey(mapping.buildingCode, mapping.roomCode)}:${year}:${month}`;
    if (!latestByRoomMonth.has(key)) {
      const periodKey = lockedPeriodKey({ buildingCode: mapping.buildingCode, roomCode: mapping.roomCode, period });
      latestByRoomMonth.set(key, {
        buildingCode: mapping.buildingCode,
        roomCode: mapping.roomCode,
        displayName: mapping.displayName,
        deviceName: mapping.deviceName,
        meterMappingId: reading.meterMappingId,
        providerMeterId: mapping.providerMeterId,
        year,
        month,
        period,
        status: reading.status,
        powerCurrentW: Number(reading.powerCurrentW || 0),
        energyMonthKwh: numberOrNull(reading.energyMonthKwh),
        moneyMonthVnd: numberOrNull(reading.moneyMonthVnd),
        readingAt: reading.readingAt,
        duplicateReadings: duplicateCountByKey.get(periodKey) || 1,
        isLocked: lockedKeys.has(periodKey),
      });
    }
  }
  return Array.from(latestByRoomMonth.values()).sort((a, b) => {
    if (a.period !== b.period) return a.period < b.period ? 1 : -1;
    return `${a.buildingCode}:${a.roomCode}`.localeCompare(`${b.buildingCode}:${b.roomCode}`);
  });
}

function countRoomsWithData(rows: Array<{ buildingCode: string; roomCode: string }>) {
  return new Set(rows.map((row) => canonicalRoomKey(row.buildingCode, row.roomCode))).size;
}

function countReadingsByRoomPeriod(readings: any[]) {
  const counts = new Map<string, number>();
  for (const reading of readings) {
    const mapping = reading.meterMapping;
    if (!mapping?.buildingCode || !mapping?.roomCode) continue;
    const period = normalizeReadingPeriod(reading.sourcePeriod ?? reading.currentMonth, new Date(reading.readingAt));
    const key = lockedPeriodKey({ buildingCode: mapping.buildingCode, roomCode: mapping.roomCode, period });
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function buildDataQualitySummary(monthlyRows: any[]) {
  const alerts: Array<Record<string, any>> = [];
  const grouped = new Map<string, any[]>();

  for (const row of monthlyRows) {
    const roomKey = canonicalRoomKey(row.buildingCode, row.roomCode);
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
    if (row.energyMonthKwh === null || row.moneyMonthVnd === null) {
      alerts.push({
        type: "INCOMPLETE",
        period: row.period,
        buildingCode: row.buildingCode,
        roomCode: row.roomCode,
        displayName: row.displayName,
        message: `${row.buildingCode} / ${row.displayName} thiếu ${row.energyMonthKwh === null ? "sản lượng" : "số tiền"} từ Hunonic trong kỳ ${row.period}; tổng chỉ cộng các trường có dữ liệu.`,
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
      const previousEnergy = numberOrNull(previous.energyMonthKwh);
      const currentEnergy = numberOrNull(current.energyMonthKwh);
      if (previousEnergy === null || currentEnergy === null) continue;
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
    incompletePeriods: alerts.filter((item) => item.type === "INCOMPLETE").length,
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
    const period = normalizeReadingPeriod(reading.sourcePeriod ?? reading.currentMonth, date);
    const key = `${canonicalRoomKey(mapping.buildingCode, mapping.roomCode)}:${period}`;
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
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(fromPeriod)) return [];
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(toPeriod)) return [];
  if (fromPeriod > toPeriod) return [];
  const periods: string[] = [];
  let cursor = fromPeriod;
  while (cursor <= toPeriod) {
    periods.push(cursor);
    const [year, month] = cursor.split('-').map(Number);
    cursor = month === 12
      ? `${year + 1}-01`
      : `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  return periods;
}

function normalizeReadingPeriod(value: unknown, fallbackDate: Date) {
  const text = String(value || '').trim();
  if (/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(text)) return text;
  if (/^\d{1,2}$/.test(text)) {
    const month = Number(text);
    if (month >= 1 && month <= 12) {
      const year = Number(getReadingPeriod(fallbackDate).slice(0, 4));
      return `${year}-${String(month).padStart(2, '0')}`;
    }
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
    energyMonthKwh: numberOrNull(reading.energyMonthKwh),
    moneyMonthVnd: numberOrNull(reading.moneyMonthVnd),
    energyPrevMonthKwh: Number(reading.energyPrevMonthKwh || 0),
    moneyPrevMonthVnd: Number(reading.moneyPrevMonthVnd || 0),
    currentMonth: reading.currentMonth,
    sourcePeriod: reading.sourcePeriod,
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
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period)) return new Date(0);
  const [yearValue, monthValue] = String(period || '').split('-').map(Number);
  return new Date(Date.UTC(yearValue, monthValue - 1, 1, -7, 0, 0, 0));
}

function getPeriodEnd(period: string) {
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period)) return new Date(0);
  const [yearValue, monthValue] = String(period || '').split('-').map(Number);
  return new Date(Date.UTC(yearValue, monthValue, 1, -7, 0, 0, 0) - 1);
}
