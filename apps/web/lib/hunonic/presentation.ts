export function resolveHunonicRateMode(liveMode?: unknown, storedMode?: unknown) {
  if (liveMode === "custom" || liveMode === "residential") return liveMode;
  if (storedMode === "custom" || storedMode === "residential") return storedMode;
  return "unknown";
}

export type HunonicMeterStatus = {
  status?: unknown;
  lastStatus?: unknown;
  isOnline?: boolean | null;
  lastSyncedAt?: string | null;
  providerObservedAt?: string | null;
};

export function getHunonicConnection(meter: HunonicMeterStatus, now = Date.now()) {
  const syncTime = meter.lastSyncedAt ? new Date(meter.lastSyncedAt).getTime() : NaN;
  const observationTime = meter.providerObservedAt ? new Date(meter.providerObservedAt).getTime() : NaN;
  const syncAge = Number.isFinite(syncTime) ? now - syncTime : NaN;
  const observationAge = Number.isFinite(observationTime) ? now - observationTime : NaN;
  // `lastSyncedAt` is the successful application/provider sync time. Hunonic's
  // device `timeupdate` may be older (or absent) even when the API sync just
  // completed, so it must not make a fresh sync look stale. Fall back to the
  // provider observation only for legacy rows that have no sync timestamp.
  const freshnessAge = Number.isFinite(syncAge) ? syncAge : observationAge;
  // Two missed 15-minute syncs: provider status can no longer be called current.
  const stale = !Number.isFinite(freshnessAge) || freshnessAge < 0 || freshnessAge >= 30 * 60 * 1000;
  const status = String(meter.status ?? meter.lastStatus ?? '').trim().toLowerCase();
  const offline = ['off', 'offline', 'inactive', '0'].includes(status) || meter.isOnline === false;
  const online = !offline && (['on', 'online', 'active', '1'].includes(status) || meter.isOnline === true);
  return {
    online: online && !stale,
    stale,
    label: stale
      ? 'Dữ liệu quá hạn / chưa đồng bộ'
      : offline
        ? 'Offline'
        : online
          ? 'Online'
          : 'Đã đồng bộ (chưa rõ trạng thái)',
  };
}

export function getHunonicMonthlyTotals(meter: {
  energyMonthKwh?: unknown; moneyMonthVnd?: unknown;
  totalKwh?: unknown; currentKwh?: unknown; estimatedCost?: unknown; amount?: unknown;
}) {
  // A monthly zero is authoritative, including after month rollover.
  return {
    energyKwh: Number(meter.energyMonthKwh ?? meter.totalKwh ?? meter.currentKwh ?? 0),
    cost: Number(meter.moneyMonthVnd ?? meter.estimatedCost ?? meter.amount ?? 0),
  };
}

export function formatHunonicHistoryValue(
  value: unknown,
  format: (value: number) => string,
) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? format(number) : "—";
}
