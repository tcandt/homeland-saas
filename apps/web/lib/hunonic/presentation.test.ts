import { describe, expect, it } from "vitest";
import { formatHunonicHistoryValue, resolveHunonicRateMode, getHunonicConnection, getHunonicMonthlyTotals } from "./presentation";

describe("Hunonic presentation", () => {
  it("renders a provider zero reading rather than treating it as missing", () => {
    expect(formatHunonicHistoryValue(0, (value) => `${value} kWh`)).toBe("0 kWh");
    expect(formatHunonicHistoryValue(null, (value) => `${value} kWh`)).toBe("—");
  });

  it("uses live residential state ahead of stale stored custom state", () => {
    expect(resolveHunonicRateMode("residential", "custom")).toBe("residential");
  });

  it('does not invent an EVN rate for missing or unsupported provider modes', () => {
    expect(resolveHunonicRateMode()).toBe('unknown');
    expect(resolveHunonicRateMode('unsupported')).toBe('unknown');
    expect(resolveHunonicRateMode(undefined, 'custom')).toBe('custom');
  });

  it('preserves zero monthly aggregates over nonzero fallback readings', () => {
    expect(getHunonicMonthlyTotals({ energyMonthKwh: 0, totalKwh: 456, moneyMonthVnd: 0, amount: 89000 })).toEqual({ energyKwh: 0, cost: 0 });
    expect(getHunonicMonthlyTotals({ energyMonthKwh: '0', moneyMonthVnd: '0' })).toEqual({ energyKwh: 0, cost: 0 });
  });

  const now = Date.parse('2026-09-19T03:00:00Z');
  const recent = '2026-09-19T02:50:00Z';
  it('never turns explicit offline into online because a sync is recent', () => {
    expect(getHunonicConnection({ status: 'offline', isOnline: true, lastSyncedAt: recent, providerObservedAt: recent }, now).online).toBe(false);
    expect(getHunonicConnection({ status: 'online', isOnline: false, lastSyncedAt: recent, providerObservedAt: recent }, now).online).toBe(false);
    expect(getHunonicConnection({ lastSyncedAt: recent, providerObservedAt: recent }, now).label).toBe('Đã đồng bộ (chưa rõ trạng thái)');
  });

  it('uses a fresh successful sync even when the provider observation is old or absent', () => {
    expect(getHunonicConnection({ status: 'online', lastSyncedAt: recent, providerObservedAt: recent }, now).online).toBe(true);
    expect(getHunonicConnection({ status: 'online', lastSyncedAt: recent, providerObservedAt: '2026-09-18T02:30:00Z' }, now).online).toBe(true);
    expect(getHunonicConnection({ status: 'online', lastSyncedAt: recent }, now).online).toBe(true);
    expect(getHunonicConnection({ lastSyncedAt: recent }, now).label).toBe('Đã đồng bộ (chưa rõ trạng thái)');
    for (const lastSyncedAt of [undefined, 'invalid', '2026-09-19T03:01:00Z', '2026-09-19T02:30:00Z']) {
      const state = getHunonicConnection({ status: 'online', lastSyncedAt }, now);
      expect(state.stale).toBe(true);
      expect(state.online).toBe(false);
    }
  });
});
