import { describe, expect, it } from 'vitest';
import { classifyHunonicMeter } from './hunonic-meter-identity';

describe('classifyHunonicMeter', () => {
  it('keeps the two private Nhà của Tính devices out of the managed inventory', () => {
    expect(classifyHunonicMeter({ name: 'EVN', room_name: 'Công tơ', home_name: 'Nhà của Tính' })?.ignored).toBe(true);
    expect(classifyHunonicMeter({ name: 'NLMT', room_name: 'Mái', home_name: 'Nhà của Tính' })?.ignored).toBe(true);
  });

  it('classifies building totals and EV charging without a billable room identity', () => {
    expect(classifyHunonicMeter({ name: 'Tổng LK08-24', room_name: 'Công tơ', home_name: 'LK08 - Ân Phú' })).toMatchObject({
      meterKind: 'BUILDING_TOTAL', buildingCode: 'LK08.24', roomCode: 'TOTAL-24',
    });
    expect(classifyHunonicMeter({ name: 'Ổ CẮM TRỆT', room_name: 'CÔNG TƠ', home_name: 'LK08-ÂN PHÚ' })).toMatchObject({
      meterKind: 'EV_CHARGING', buildingCode: 'COMMON', roomCode: 'EV-CHARGING',
    });
  });

  it('normalizes dot and hyphen room labels without using them as provider identities', () => {
    expect(classifyHunonicMeter({ name: 'P24-01', room_name: 'P24.01', home_name: 'LK08.24' })).toMatchObject({
      meterKind: 'ROOM', buildingCode: 'LK08.24', roomCode: 'P24.01',
    });
  });
});
