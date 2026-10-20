import { describe, expect, it } from 'vitest';
import { identityDocumentImages, settlementElectricityValues } from '../../lib/contracts/settlement-electricity';

describe('settlement electricity autofill', () => {
  it('preserves zero instead of falling back to provider whole-month money', () => {
    expect(settlementElectricityValues({ monthKwh: 0, calculatedAmountVnd: 0, monthAmountVnd: 99000 }))
      .toEqual({ electricityAmount: '0', electricityClosingKwh: '0' });
  });
  it('uses the period delta and splits a shared total exactly once', () => {
    expect(settlementElectricityValues({ isSharedRoom: true, activeOccupants: 2,
      totalRoomMonthKwh: 60, totalCalculatedAmountVnd: 240000, monthKwh: 30, calculatedAmountVnd: 120000 }))
      .toEqual({ electricityAmount: '120000', electricityClosingKwh: '30' });
  });
  it('does not autofill missing baseline, missing pricing, or invalid readings as zero', () => {
    expect(settlementElectricityValues({ manualRequired: true, monthKwh: 100, calculatedAmountVnd: 400000 })).toBeNull();
    expect(settlementElectricityValues({ monthKwh: 100 })).toBeNull();
    expect(settlementElectricityValues({ monthKwh: -1, calculatedAmountVnd: 20 })).toBeNull();
  });
  it('excludes declaration metadata while preserving original revoke indices', () => {
    expect(identityDocumentImages(['TEMP_RESIDENCE_DECLARED', 'document-storage://front.png', '', 'back.png']))
      .toEqual([{ url: 'document-storage://front.png', index: 1 }, { url: 'back.png', index: 3 }]);
  });
});
