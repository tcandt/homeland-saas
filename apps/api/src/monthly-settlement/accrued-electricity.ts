type AccruedInput = {
  period: string;
  periodStart: Date;
  nextPeriodStart: Date;
  now: Date;
  tenantId: string;
  roomId: string;
  contract: any;
  occupancies: any[];
  reading: any;
  baselineReading: any;
  meter: any;
  meterMappingId?: string | null;
  shared: boolean;
};

export type MoveInElectricityCharge = {
  status: "NOT_APPLICABLE" | "NOT_OCCUPIED" | "ADJUSTED" | "BLOCKED";
  issue: string | null;
  kwh: number;
  amount: number;
  provenance: Record<string, unknown> | null;
};

function nonnegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function readingTime(reading: any): number | null {
  const value = reading?.observedAt || reading?.readingAt;
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : null;
}

function issue(code: string): MoveInElectricityCharge {
  return { status: "BLOCKED", issue: code, kwh: 0, amount: 0, provenance: null };
}

/**
 * Produces the financial, room-level monthly electricity total for a tenant
 * whose actual move-in occurred during that same usage period.  A Hunonic
 * monthly aggregate has no register endpoints, so the persisted move-in
 * reading is mandatory evidence for subtracting pre-occupancy usage.
 */
export function resolveMoveInElectricityCharge(input: {
  usagePeriod: string;
  periodStart: Date;
  nextPeriodStart: Date;
  tenantId: string;
  roomId: string;
  contract: any;
  occupancies: any[];
  currentReading: any;
  baselineReading: any;
  meter: any;
  meterMappingId?: string | null;
  shared: boolean;
  rawKwh: number;
  rawAmount: number;
}): MoveInElectricityCharge {
  const rawKwh = nonnegative(input.rawKwh);
  const rawAmount = nonnegative(input.rawAmount);
  if (rawKwh === null || rawAmount === null) {
    return issue("MOVE_IN_ELECTRICITY_CURRENT_INVALID");
  }
  const starts = (input.occupancies || [])
    .filter((occupancy) =>
      occupancy?.tenantId === input.tenantId &&
      occupancy?.roomId === input.roomId &&
      occupancy?.contractId === input.contract?.id,
    )
    .map((occupancy) => new Date(occupancy.joinedAt).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (starts.length === 0) {
    return { status: "NOT_APPLICABLE", issue: null, kwh: rawKwh, amount: rawAmount, provenance: null };
  }

  const activatedAt = input.contract?.activatedAt
    ? new Date(input.contract.activatedAt).getTime()
    : null;
  if (activatedAt !== null && !Number.isFinite(activatedAt)) {
    return issue("MOVE_IN_ELECTRICITY_START_UNPROVEN");
  }
  if (activatedAt === null && new Set(starts).size > 1) {
    return issue("MOVE_IN_ELECTRICITY_START_UNPROVEN");
  }
  const actualMoveInAt = activatedAt ?? starts[0];
  if (actualMoveInAt >= input.nextPeriodStart.getTime()) {
    if (input.shared) return issue("MOVE_IN_ELECTRICITY_SHARED_UNSUPPORTED");
    return { status: "NOT_OCCUPIED", issue: null, kwh: 0, amount: 0, provenance: null };
  }
  if (actualMoveInAt <= input.periodStart.getTime()) {
    return { status: "NOT_APPLICABLE", issue: null, kwh: rawKwh, amount: rawAmount, provenance: null };
  }
  if (input.shared) return issue("MOVE_IN_ELECTRICITY_SHARED_UNSUPPORTED");
  const snapshot = input.contract?.moveInSnapshot;
  const baseline = input.baselineReading;
  const current = input.currentReading;
  if (
    !snapshot ||
    !baseline ||
    snapshot.roomId !== input.roomId ||
    snapshot.meterReadingId !== baseline.id ||
    baseline.tenantId !== input.tenantId ||
    baseline.roomId !== input.roomId ||
    baseline.sourcePeriod !== input.usagePeriod ||
    baseline.aggregateBasis !== "MONTHLY_AGGREGATE_V1" ||
    !snapshot.capturedAt ||
    new Date(snapshot.capturedAt).getTime() !== actualMoveInAt
  ) return issue("MOVE_IN_ELECTRICITY_BASELINE_REQUIRED");
  if (
    !current ||
    current.tenantId !== input.tenantId ||
    current.roomId !== input.roomId ||
    current.sourcePeriod !== input.usagePeriod ||
    current.aggregateBasis !== "MONTHLY_AGGREGATE_V1" ||
    !input.meter ||
    current.meterMappingId !== (input.meterMappingId || input.meter.id) ||
    baseline.meterMappingId !== current.meterMappingId
  ) return issue("MOVE_IN_ELECTRICITY_SOURCE_INVALID");

  const baselineKwh = nonnegative(baseline.energyMonthKwh);
  const baselineAmount = nonnegative(baseline.moneyMonthVnd);
  const currentKwh = nonnegative(current.energyMonthKwh);
  const currentAmount = nonnegative(current.moneyMonthVnd);
  const baselineTime = readingTime(baseline);
  const currentTime = readingTime(current);
  if (
    baselineKwh === null || baselineAmount === null ||
    currentKwh === null || currentAmount === null ||
    baselineTime === null || baselineTime !== actualMoveInAt ||
    currentTime === null || currentTime < actualMoveInAt ||
    currentKwh < baselineKwh || currentAmount < baselineAmount
  ) return issue("MOVE_IN_ELECTRICITY_BASELINE_INVALID");

  const kwh = Math.round((currentKwh - baselineKwh) * 1000) / 1000;
  let amount: number;
  if (input.meter.rateMode === "custom") {
    const rate = nonnegative(input.meter.customRateVnd);
    if (rate === null || rate === 0) return issue("MOVE_IN_ELECTRICITY_RATE_UNVERIFIED");
    amount = Math.round(kwh * rate);
  } else if (input.meter.rateMode === "residential") {
    amount = currentAmount - baselineAmount;
  } else {
    return issue("MOVE_IN_ELECTRICITY_RATE_UNVERIFIED");
  }
  return {
    status: "ADJUSTED",
    issue: null,
    kwh,
    amount,
    provenance: {
      policyVersion: "MOVE_IN_ELECTRICITY_V1",
      actualMoveInAt: new Date(actualMoveInAt).toISOString(),
      baselineReadingId: baseline.id,
      baselinePayloadHash: baseline.payloadHash || null,
      baselineKwh,
      baselineAmount,
      currentReadingId: current.id,
      currentPayloadHash: current.payloadHash || null,
      currentKwh,
      currentAmount,
      adjustedKwh: kwh,
      adjustedAmount: amount,
    },
  };
}

/** Display only: never used as invoice or snapshot evidence. */
export function resolveAccruedElectricity(input: AccruedInput) {
  const { contract, period, tenantId, roomId, reading, meter } = input;
  const result = (status: string, kwh: number | null = null, amount: number | null = null) => ({
    period, status, kwh, amount,
    rateMode: meter?.rateMode || null,
    customRateVnd: nonnegative(meter?.customRateVnd),
  });
  if (!['ACTIVE', 'EXPIRING'].includes(contract.status)) return result('NOT_OCCUPIED', 0, 0);
  const occupants = input.occupancies.filter((occupancy) =>
    occupancy.tenantId === tenantId && occupancy.roomId === roomId &&
    occupancy.contractId === contract.id &&
    new Date(occupancy.joinedAt) < input.nextPeriodStart &&
    new Date(occupancy.joinedAt) <= input.now &&
    (!occupancy.leftAt || new Date(occupancy.leftAt) > input.periodStart),
  );
  if (!occupants.length) return result('NOT_OCCUPIED', 0, 0);
  // A room aggregate alone cannot establish each shared occupant's usage.
  if (input.shared || occupants.some((occupancy) => occupancy.leftAt)) return result('UNAVAILABLE');
  if (!reading || reading.tenantId !== tenantId || reading.roomId !== roomId ||
      reading.sourcePeriod !== period || reading.aggregateBasis !== 'MONTHLY_AGGREGATE_V1' ||
      !meter || meter.id !== reading.meterMappingId) return result('UNAVAILABLE');
  const joinedAt = new Date(Math.max(
    Math.min(...occupants.map((occupancy) => new Date(occupancy.joinedAt).getTime())),
    contract.activatedAt ? new Date(contract.activatedAt).getTime() : 0,
  ));
  if (joinedAt > input.now || joinedAt >= input.nextPeriodStart) return result('NOT_OCCUPIED', 0, 0);
  const currentKwh = nonnegative(reading.energyMonthKwh);
  const currentAmount = nonnegative(reading.moneyMonthVnd);
  if (currentKwh === null || new Date(reading.observedAt || reading.readingAt) < joinedAt) return result('UNAVAILABLE');
  let baselineKwh = 0;
  let baselineAmount = 0;
  if (joinedAt > input.periodStart) {
    const snapshot = contract.moveInSnapshot;
    const baseline = input.baselineReading;
    if (!snapshot || !baseline || snapshot.roomId !== roomId ||
        snapshot.meterReadingId !== baseline.id || baseline.tenantId !== tenantId ||
        baseline.roomId !== roomId || baseline.sourcePeriod !== period ||
        baseline.meterMappingId !== reading.meterMappingId ||
        baseline.aggregateBasis !== 'MONTHLY_AGGREGATE_V1' ||
        !snapshot.capturedAt || new Date(snapshot.capturedAt).getTime() !== joinedAt.getTime() ||
        new Date(baseline.observedAt || baseline.readingAt) > joinedAt) return result('BASELINE_REQUIRED');
    const startKwh = nonnegative(baseline.energyMonthKwh);
    const startAmount = nonnegative(baseline.moneyMonthVnd);
    if (startKwh === null || startAmount === null) return result('BASELINE_REQUIRED');
    baselineKwh = startKwh;
    baselineAmount = startAmount;
  }
  if (currentKwh < baselineKwh) return result('UNAVAILABLE');
  const kwh = Math.round((currentKwh - baselineKwh) * 1000) / 1000;
  if (meter?.rateMode === 'custom') {
    const rate = nonnegative(meter.customRateVnd);
    if (rate === null || rate === 0) return result('UNAVAILABLE');
    return result('AVAILABLE', kwh, Math.round(kwh * rate));
  }
  if (meter?.rateMode !== 'residential' || currentAmount === null || currentAmount < baselineAmount) return result('UNAVAILABLE');
  return result('AVAILABLE', kwh, currentAmount - baselineAmount);
}
