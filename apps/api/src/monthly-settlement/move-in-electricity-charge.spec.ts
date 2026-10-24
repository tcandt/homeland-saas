import { describe, expect, it } from "vitest";
import { resolveMoveInElectricityCharge } from "./accrued-electricity";

const periodStart = new Date("2026-09-30T17:00:00.000Z");
const nextPeriodStart = new Date("2026-10-31T17:00:00.000Z");
const movedInAt = new Date("2026-10-10T03:00:00.000Z");

function fixture(overrides: any = {}) {
  const base: any = {
    usagePeriod: "2026-10", periodStart, nextPeriodStart,
    tenantId: "tenant-1", roomId: "room-1", shared: false,
    contract: {
      id: "contract-1", activatedAt: movedInAt,
      moveInSnapshot: { roomId: "room-1", meterReadingId: "baseline-1", capturedAt: movedInAt },
    },
    occupancies: [{ tenantId: "tenant-1", roomId: "room-1", contractId: "contract-1", joinedAt: periodStart }],
    currentReading: {
      id: "current-1", tenantId: "tenant-1", roomId: "room-1", meterMappingId: "meter-1",
      sourcePeriod: "2026-10", aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 125,
      moneyMonthVnd: 500_000, observedAt: new Date("2026-10-31T16:59:59.000Z"), payloadHash: "c".repeat(64),
    },
    baselineReading: {
      id: "baseline-1", tenantId: "tenant-1", roomId: "room-1", meterMappingId: "meter-1",
      sourcePeriod: "2026-10", aggregateBasis: "MONTHLY_AGGREGATE_V1", energyMonthKwh: 100,
      moneyMonthVnd: 400_000, observedAt: movedInAt, payloadHash: "b".repeat(64),
    },
    meter: { id: "meter-1", rateMode: "custom", customRateVnd: 4_000 },
    meterMappingId: "meter-1", rawKwh: 125, rawAmount: 500_000,
  };
  return {
    ...base, ...overrides,
    contract: { ...base.contract, ...overrides.contract },
    currentReading: { ...base.currentReading, ...overrides.currentReading },
    baselineReading: overrides.baselineReading === null ? null : { ...base.baselineReading, ...overrides.baselineReading },
    meter: { ...base.meter, ...overrides.meter },
  };
}

describe("resolveMoveInElectricityCharge", () => {
  it("uses activatedAt over a backdated occupancy and retains baseline provenance", () => {
    const charge = resolveMoveInElectricityCharge(fixture());
    expect(charge).toMatchObject({ status: "ADJUSTED", kwh: 25, amount: 100_000 });
    expect(charge.provenance).toMatchObject({ baselinePayloadHash: "b".repeat(64), actualMoveInAt: movedInAt.toISOString() });
  });

  it("leaves a full-period occupant on the raw monthly aggregate", () => {
    const charge = resolveMoveInElectricityCharge(fixture({
      contract: { activatedAt: periodStart },
      occupancies: [{ tenantId: "tenant-1", roomId: "room-1", contractId: "contract-1", joinedAt: periodStart }],
    }));
    expect(charge).toMatchObject({ status: "NOT_APPLICABLE", kwh: 125, amount: 500_000 });
  });

  it("does not charge an activation after the usage period", () => {
    expect(resolveMoveInElectricityCharge(fixture({
      contract: { activatedAt: nextPeriodStart },
    }))).toMatchObject({ status: "NOT_OCCUPIED", kwh: 0, amount: 0 });
  });

  it.each([
    ["partial-period", movedInAt],
    ["future", nextPeriodStart],
  ])("blocks a shared room with %s activation", (_label, activatedAt) => {
    expect(resolveMoveInElectricityCharge(fixture({ shared: true, contract: { activatedAt } }))).toMatchObject({
      status: "BLOCKED", issue: "MOVE_IN_ELECTRICITY_SHARED_UNSUPPORTED",
    });
  });

  it.each([
    ["tenant", { currentReading: { tenantId: "tenant-2" } }],
    ["mapping", { currentReading: { meterMappingId: "meter-2" } }],
  ])("rejects a wrong %s source", (_label, overrides) => {
    expect(resolveMoveInElectricityCharge(fixture(overrides))).toMatchObject({
      status: "BLOCKED", issue: "MOVE_IN_ELECTRICITY_SOURCE_INVALID",
    });
  });

  it.each([
    ["negative baseline", { baselineReading: { energyMonthKwh: -1 } }],
    ["reset aggregate", { currentReading: { energyMonthKwh: 99 } }],
    ["cached baseline before activation", { baselineReading: { observedAt: new Date("2026-10-10T02:59:59.999Z") } }],
    ["stale baseline", { baselineReading: { observedAt: new Date("2026-10-10T03:00:00.001Z") } }],
  ])("fails closed for %s", (_label, overrides) => {
    expect(resolveMoveInElectricityCharge(fixture(overrides))).toMatchObject({
      status: "BLOCKED", issue: "MOVE_IN_ELECTRICITY_BASELINE_INVALID",
    });
  });

  it("requires a baseline even when the net aggregate is zero", () => {
    expect(resolveMoveInElectricityCharge(fixture({
      baselineReading: null, currentReading: { energyMonthKwh: 100, moneyMonthVnd: 400_000 }, rawKwh: 0, rawAmount: 0,
    }))).toMatchObject({ status: "BLOCKED", issue: "MOVE_IN_ELECTRICITY_BASELINE_REQUIRED" });
  });

  it("uses custom kWh pricing and the provider delta for residential pricing", () => {
    expect(resolveMoveInElectricityCharge(fixture()).amount).toBe(100_000);
    expect(resolveMoveInElectricityCharge(fixture({ meter: { rateMode: "residential", customRateVnd: null } }))).toMatchObject({
      status: "ADJUSTED", kwh: 25, amount: 100_000,
    });
  });
});
