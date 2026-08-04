import type { PrismaClient, Room } from '@prisma/client';

type DatabaseClient = PrismaClient;
type ManagedBuildingRecord = { id: string; code: string };

export const MANAGED_BUILDINGS = ['LK01.31', 'LK01.32', 'LK08.24', 'LK08.25'] as const;
export const LK01_ROOM_TOPOLOGY = [
  { level: 1, suffix: '01', bedCount: 1, capacity: 1, area: 25, monthlyPrice: 6500000 },
  { level: 2, suffix: '02', bedCount: 2, capacity: 2, area: 50, monthlyPrice: 9500000 },
  { level: 2, suffix: '03', bedCount: 1, capacity: 1, area: 18, monthlyPrice: 6500000 },
  { level: 3, suffix: '04', bedCount: 2, capacity: 2, area: 50, monthlyPrice: 9500000 },
  { level: 3, suffix: '05', bedCount: 1, capacity: 1, area: 18, monthlyPrice: 6500000 },
  { level: 4, suffix: '06', bedCount: 2, capacity: 2, area: 50, monthlyPrice: 9500000 },
  { level: 4, suffix: '07', bedCount: 1, capacity: 1, area: 18, monthlyPrice: 6500000 },
] as const;

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
        update: { deletedAt: null },
        create: { tenantId, code, name: `Tòa nhà ${code.replace('.', '-')}`, address: 'HomeLand Premium' },
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

    return { buildingCount: buildings.size, sourceRoomCount: sourceRooms.length, clonedRoomCount: targetRooms.length, existingOperationalRelations, cleanedLegacyRoomCount };
  });
}
