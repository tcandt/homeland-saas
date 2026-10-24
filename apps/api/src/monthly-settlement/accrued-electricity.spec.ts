import { describe, expect, it } from 'vitest';
import { resolveAccruedElectricity } from './accrued-electricity';

function fixture() {
  const joinedAt = new Date('2026-10-10T03:00:00Z');
  const reading = {
    id: 'current', tenantId: 'tenant', roomId: 'room', meterMappingId: 'meter',
    sourcePeriod: '2026-10', aggregateBasis: 'MONTHLY_AGGREGATE_V1',
    energyMonthKwh: 125, moneyMonthVnd: 450000, observedAt: new Date('2026-10-20T03:00:00Z'),
  };
  return {
    period: '2026-10', tenantId: 'tenant', roomId: 'room', shared: false,
    periodStart: new Date('2026-09-30T17:00:00Z'),
    nextPeriodStart: new Date('2026-10-31T17:00:00Z'),
    now: new Date('2026-10-20T04:00:00Z'),
    contract: {
      id: 'contract', status: 'ACTIVE', activatedAt: joinedAt,
      moveInSnapshot: { capturedAt: joinedAt, roomId: 'room', meterReadingId: 'baseline' },
    },
    occupancies: [{ tenantId: 'tenant', roomId: 'room', contractId: 'contract', joinedAt, leftAt: null }],
    reading,
    baselineReading: { ...reading, id: 'baseline', energyMonthKwh: 100, moneyMonthVnd: 350000, observedAt: joinedAt },
    meter: { id: 'meter', rateMode: 'custom', customRateVnd: 4000 },
  };
}

describe('accrued electricity display', () => {
  it('excludes pre-move-in kWh and applies configured price', () => {
    expect(resolveAccruedElectricity(fixture())).toMatchObject({ status: 'AVAILABLE', kwh: 25, amount: 100000 });
  });
  it('uses actual activation even when occupancy starts at contract start', () => {
    const input = fixture();
    input.occupancies[0].joinedAt = input.periodStart;
    expect(resolveAccruedElectricity(input).kwh).toBe(25);
  });
  it.each(['APPROVED', 'DRAFT', 'PENDING_APPROVAL'])('excludes %s contracts', (status) => {
    const input = fixture();
    input.contract.status = status;
    expect(resolveAccruedElectricity(input)).toMatchObject({ status: 'NOT_OCCUPIED', kwh: 0, amount: 0 });
  });
  it('excludes rooms without actual occupants', () => {
    expect(resolveAccruedElectricity({ ...fixture(), occupancies: [] }).amount).toBe(0);
  });
  it('requires a move-in baseline instead of charging the entire month', () => {
    expect(resolveAccruedElectricity({ ...fixture(), baselineReading: null })).toMatchObject({ status: 'BASELINE_REQUIRED', amount: null });
  });
  it.each(['tenantId', 'roomId', 'sourcePeriod', 'meterMappingId'])('rejects mismatched reading %s', (key) => {
    const input = fixture();
    Object.assign(input.reading, { [key]: 'wrong' });
    expect(resolveAccruedElectricity(input).status).toBe('UNAVAILABLE');
  });
  it('uses monthly totals after the month boundary for an existing occupant', () => {
    const input = fixture();
    input.contract.activatedAt = input.periodStart;
    input.occupancies[0].joinedAt = input.periodStart;
    expect(resolveAccruedElectricity({ ...input, baselineReading: null })).toMatchObject({ kwh: 125, amount: 500000 });
  });
  it('uses the provider amount delta for residential pricing', () => {
    const input = fixture();
    input.meter.rateMode = 'residential';
    expect(resolveAccruedElectricity(input).amount).toBe(100000);
  });
  it('does not attribute a shared room aggregate to each contract', () => {
    expect(resolveAccruedElectricity({ ...fixture(), shared: true })).toMatchObject({ status: 'UNAVAILABLE', amount: null });
  });
  it('rejects a reset meter', () => {
    const input = fixture();
    input.reading.energyMonthKwh = 50;
    expect(resolveAccruedElectricity(input).status).toBe('UNAVAILABLE');
  });
  it('rejects a baseline observed after move-in', () => {
    const input = fixture();
    input.baselineReading.observedAt = new Date('2026-10-11T03:00:00Z');
    expect(resolveAccruedElectricity(input)).toMatchObject({ status: 'BASELINE_REQUIRED', amount: null });
  });
  it.each(['energyMonthKwh', 'moneyMonthVnd'])('rejects negative baseline %s', (key) => {
    const input = fixture();
    Object.assign(input.baselineReading, { [key]: -1 });
    expect(resolveAccruedElectricity(input).status).toBe('BASELINE_REQUIRED');
  });
  it('rejects negative current energy and price', () => {
    const input = fixture();
    input.reading.energyMonthKwh = -1;
    expect(resolveAccruedElectricity(input).status).toBe('UNAVAILABLE');
    input.reading.energyMonthKwh = 125;
    input.meter.customRateVnd = -1;
    expect(resolveAccruedElectricity(input).status).toBe('UNAVAILABLE');
  });
  it('does not accrue before actual activation', () => {
    const input = fixture();
    input.contract.activatedAt = new Date('2026-10-25T03:00:00Z');
    expect(resolveAccruedElectricity(input).amount).toBe(0);
  });
});
