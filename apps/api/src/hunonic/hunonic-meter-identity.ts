import { HunonicElectricMeter } from './hunonic.provider';

export type HunonicMeterKind = 'ROOM' | 'BUILDING_TOTAL' | 'EV_CHARGING';

export type HunonicMeterIdentity = {
  meterKind: HunonicMeterKind;
  buildingCode: string;
  roomCode: string;
  displayName: string;
  ignored: boolean;
};

/**
 * Provider names are user-managed and therefore cannot be a persistence key.
 * This is a display/sync classification only; provider IDs remain immutable.
 */
export function classifyHunonicMeter(meter: Pick<HunonicElectricMeter, 'name' | 'room_name' | 'home_name'>): HunonicMeterIdentity | null {
  const name = String(meter.name || '').trim();
  const room = String(meter.room_name || '').trim();
  const home = String(meter.home_name || '').trim();
  const combined = normalize(`${name} ${room} ${home}`);

  if (normalize(home).includes('nha cua tinh') || (normalize(home).includes('nha') && normalize(home).includes('tinh')) || combined.includes('nlmt')) {
    return { meterKind: 'ROOM', buildingCode: '', roomCode: '', displayName: name || room, ignored: true };
  }

  const total = combined.match(/tong\s*(?:toa\s*nha\s*)?(?:lk\s*)?0?8[.\-\s]?(24|25)\b/);
  if (total) {
    const buildingCode = `LK08.${total[1]}`;
    return {
      meterKind: 'BUILDING_TOTAL',
      buildingCode,
      roomCode: `TOTAL-${total[1]}`,
      displayName: `Công tơ tổng tòa nhà ${buildingCode}`,
      ignored: false,
    };
  }

  if (combined.includes('o cam tret') && normalize(home).includes('lk08')) {
    return {
      meterKind: 'EV_CHARGING',
      buildingCode: 'COMMON',
      roomCode: 'EV-CHARGING',
      displayName: 'Ổ cắm xe điện',
      ignored: false,
    };
  }

  const roomMatch = `${name} ${room}`.match(/(?:dien|p|pn|phong)?\s*(31|32|24|25)[.\-\s](\d{1,2})\b/i);
  if (!roomMatch) return null;
  const [, buildingNumber, roomNumber] = roomMatch;
  const buildingCode = buildingNumber === '31' || buildingNumber === '32'
    ? `LK01.${buildingNumber}`
    : `LK08.${buildingNumber}`;
  const roomCode = `P${buildingNumber}.${roomNumber.padStart(2, '0')}`;
  return { meterKind: 'ROOM', buildingCode, roomCode, displayName: roomCode, ignored: false };
}

export function meterKindForMapping(mapping: { buildingCode?: string | null; roomCode?: string | null; displayName?: string | null; deviceName?: string | null; homeName?: string | null; roomName?: string | null; raw?: unknown }): HunonicMeterKind {
  const raw = mapping.raw && typeof mapping.raw === 'object' ? mapping.raw as Record<string, unknown> : {};
  return classifyHunonicMeter({
    name: String(raw.name || mapping.deviceName || ''),
    room_name: String(raw.room_name || mapping.roomName || ''),
    home_name: String(raw.home_name || mapping.homeName || ''),
  })?.meterKind || 'ROOM';
}

function normalize(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
