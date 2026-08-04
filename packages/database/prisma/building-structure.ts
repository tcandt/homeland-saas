import type { PrismaClient, Room } from '@prisma/client';

type DatabaseClient = PrismaClient;
type ManagedBuildingRecord = { id: string; code: string };

export const MANAGED_BUILDINGS = ['LK01.31', 'LK01.32', 'LK08.24', 'LK08.25'] as const;
const MANAGED_BUILDING_ADDRESS = 'Khu đô thị \u00c2n Phú, phường Tân An, tỉnh Đắk Lắk';
const MANAGED_BUILDING_DISPLAY_ORDER = new Map<string, number>(
  MANAGED_BUILDINGS.map((code, index) => [code, index * 1000]),
);
export const LK01_ROOM_TOPOLOGY = [
  { level: 1, suffix: '01', bedCount: 1, capacity: 2, area: 25, monthlyPrice: 0 },
  { level: 2, suffix: '02', bedCount: 2, capacity: 4, area: 50, monthlyPrice: 0 },
  { level: 2, suffix: '03', bedCount: 1, capacity: 2, area: 18, monthlyPrice: 0 },
  { level: 3, suffix: '04', bedCount: 2, capacity: 4, area: 50, monthlyPrice: 0 },
  { level: 3, suffix: '05', bedCount: 1, capacity: 2, area: 18, monthlyPrice: 0 },
  { level: 4, suffix: '06', bedCount: 2, capacity: 4, area: 50, monthlyPrice: 0 },
  { level: 4, suffix: '07', bedCount: 1, capacity: 2, area: 18, monthlyPrice: 0 },
] as const;

const LK08_ROOM_TOPOLOGY = {
  'LK08.24': [
    { level: 1, code: 'P24-01' },
    { level: 2, code: 'P24-02' },
    { level: 2, code: 'P24-03' },
    { level: 2, code: 'P24-04' },
    { level: 3, code: 'P24-05' },
    { level: 3, code: 'P24-06' },
    { level: 3, code: 'P24-07' },
    { level: 4, code: 'P24-08' },
    { level: 4, code: 'P24-09' },
    { level: 4, code: 'P24-10' },
  ],
  'LK08.25': [
    { level: 1, code: 'P25-01' },
    { level: 2, code: 'P25-02' },
    { level: 2, code: 'P25-03' },
    { level: 2, code: 'P25-04' },
    { level: 3, code: 'P25-05' },
    { level: 3, code: 'P25-06' },
    { level: 3, code: 'P25-07' },
    { level: 4, code: 'P25-08' },
    { level: 4, code: 'P25-09' },
    { level: 4, code: 'P25-10' },
  ],
} as const;

const floorName = (level: number) => level === 1 ? 'Tầng trệt' : `Tầng ${level - 1}`;

const legacyPlaceholderRoomPattern = /^(LK\d{2}\.\d{2})-F\d+-R\d+$/i;

async function softDeleteLegacyPlaceholderRooms(
  tx: any,
  tenantId: string,
  buildings: ManagedBuildingRecord[],
) {
  const buildingIds = buildings.map((building) => building.id);
  if (buildingIds.length === 0) return 0;

  const candidates = await tx.room.findMany({
    where: {
      tenantId,
      buildingId: { in: buildingIds },
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      contracts: { select: { id: true } },
      deposits: { select: { id: true } },
    },
  });

  const legacyRoomIds = candidates
    .filter((room: any) => (
      legacyPlaceholderRoomPattern.test(room.code)
      && room.contracts.length === 0
      && room.deposits.length === 0
    ))
    .map((room: any) => room.id);

  if (legacyRoomIds.length === 0) return 0;

  const result = await tx.room.updateMany({
    where: { id: { in: legacyRoomIds }, deletedAt: null },
    data: {
      deletedAt: new Date(),
      deleteReason: 'legacy-placeholder-room-cleanup',
    },
  });

  return result.count;
}

export async function ensureManagedBuildingStructure(prisma: DatabaseClient, tenantId: string) {
  return prisma.$transaction(async (tx) => {
    const buildings = new Map<string, ManagedBuildingRecord>();

    for (const code of MANAGED_BUILDINGS) {
      const building = await tx.building.upsert({
        where: { tenantId_code: { tenantId, code } },
        update: { deletedAt: null, address: MANAGED_BUILDING_ADDRESS },
        create: {
          tenantId,
          code,
          name: `Tòa nhà ${code.replace('.', '-')}`,
          address: MANAGED_BUILDING_ADDRESS,
          displayOrder: MANAGED_BUILDING_DISPLAY_ORDER.get(code) ?? 0,
        },
        select: { id: true, code: true },
      });
      buildings.set(code, building);
      for (let level = 1; level <= 4; level += 1) {
        await tx.floor.upsert({
          where: { tenantId_buildingId_level: { tenantId, buildingId: building.id, level } },
          update: { name: floorName(level), deletedAt: null },
          create: { tenantId, buildingId: building.id, level, name: floorName(level) },
        });
      }
    }

    const cleanedLegacyRoomCount = await softDeleteLegacyPlaceholderRooms(tx, tenantId, [...buildings.values()]);

    const source = buildings.get('LK01.31')!;
    const target = buildings.get('LK01.32')!;
    const sourceFloors = await tx.floor.findMany({ where: { tenantId, buildingId: source.id }, orderBy: { level: 'asc' } });
    const targetFloors = await tx.floor.findMany({ where: { tenantId, buildingId: target.id }, orderBy: { level: 'asc' } });
    const sourceFloorByLevel = new Map(sourceFloors.map((floor) => [floor.level, floor]));
    const targetFloorByLevel = new Map(targetFloors.map((floor) => [floor.level, floor]));
    const sourceRooms: Room[] = [];

    for (const item of LK01_ROOM_TOPOLOGY) {
      const floor = sourceFloorByLevel.get(item.level)!;
      const code = `PN 31-${item.suffix}`;
      const room = await tx.room.upsert({
        where: { tenantId_buildingId_code: { tenantId, buildingId: source.id, code } },
        update: { floorId: floor.id, deletedAt: null },
        create: {
          tenantId, buildingId: source.id, floorId: floor.id, code, name: code,
          bedCount: item.bedCount, capacity: item.capacity, area: item.area,
          monthlyPrice: item.monthlyPrice,
        },
      });
      sourceRooms.push(room);
    }

    for (const sourceRoom of sourceRooms) {
      const sourceLevel = sourceFloors.find((floor) => floor.id === sourceRoom.floorId)?.level;
      if (!sourceLevel) throw new Error(`Không xác định được tầng nguồn của ${sourceRoom.code}`);
      const floor = targetFloorByLevel.get(sourceLevel)!;
      const code = sourceRoom.code.replace(/PN\s*31-/i, 'PN 32-');
      await tx.room.upsert({
        where: { tenantId_buildingId_code: { tenantId, buildingId: target.id, code } },
        update: { floorId: floor.id, deletedAt: null },
        create: {
          tenantId, buildingId: target.id, floorId: floor.id, code, name: code,
          bedCount: sourceRoom.bedCount, capacity: sourceRoom.capacity,
          area: sourceRoom.area, monthlyPrice: sourceRoom.monthlyPrice,
        },
      });
    }

    const targetRooms = await tx.room.findMany({
      where: { tenantId, buildingId: target.id, code: { startsWith: 'PN 32-' }, deletedAt: null },
      select: { id: true, code: true, contracts: { select: { id: true } }, deposits: { select: { id: true } } },
    });
    const uniqueCodes = new Set(targetRooms.map((room) => room.code));
    if (targetRooms.length !== 7 || uniqueCodes.size !== 7) throw new Error(`Clone LK01.32 không hợp lệ: ${targetRooms.length} phòng/${uniqueCodes.size} mã duy nhất`);
    const existingOperationalRelations = targetRooms.reduce((sum, room) => sum + room.contracts.length + room.deposits.length, 0);

    for (const [buildingCode, topology] of Object.entries(LK08_ROOM_TOPOLOGY)) {
      const building = buildings.get(buildingCode)!;
      const floors = await tx.floor.findMany({ where: { tenantId, buildingId: building.id }, orderBy: { level: 'asc' } });
      const floorByLevel = new Map(floors.map((floor) => [floor.level, floor]));

      for (const roomSpec of topology) {
        const floor = floorByLevel.get(roomSpec.level)!;
        await tx.room.upsert({
          where: { tenantId_buildingId_code: { tenantId, buildingId: building.id, code: roomSpec.code } },
          update: { floorId: floor.id, deletedAt: null },
          create: {
            tenantId,
            buildingId: building.id,
            floorId: floor.id,
            code: roomSpec.code,
            name: roomSpec.code,
            bedCount: 1,
            capacity: 2,
            area: 25,
            monthlyPrice: 0,
          },
        });
      }
    }

    return { buildingCount: buildings.size, sourceRoomCount: sourceRooms.length, clonedRoomCount: targetRooms.length, existingOperationalRelations, cleanedLegacyRoomCount };
  });
}
