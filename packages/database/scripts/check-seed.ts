import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSeed() {
  console.log('Verifying Seed Data...');

  const requiredBuildings = ['LK01.31', 'LK01.32', 'LK08.24', 'LK08.25'];
  
  const buildings = await prisma.building.findMany({
    where: {
      code: {
        in: requiredBuildings
      }
    }
  });

  const foundCodes = buildings.map(b => b.code);
  const missing = requiredBuildings.filter(b => !foundCodes.includes(b));

  const details = await prisma.building.findMany({
    where: { code: { in: requiredBuildings }, deletedAt: null },
    include: {
      floors: {
        where: { deletedAt: null },
        include: { rooms: { where: { deletedAt: null } } },
      },
    },
  });
  const invalid = details.filter((building) => building.floors.length !== 4
    || (building.code.startsWith('LK08') && (() => {
      const roomPrefix = building.code === 'LK08.24' ? 'P24-' : 'P25-';
      const rooms = building.floors.flatMap((floor) => floor.rooms);
      const expectedCodes = new Set(Array.from({ length: 10 }, (_, index) => `${roomPrefix}${String(index + 1).padStart(2, '0')}`));
      return rooms.length !== 10 || rooms.some((room) => !expectedCodes.has(room.code)
        || room.bedCount !== 1
        || room.capacity !== 2
        || Number(room.area) !== 25);
    })())
    || (building.code.startsWith('LK01.') && (() => {
      const prefix = building.code.endsWith('.31') ? '31' : '32';
      const rooms = building.floors.flatMap((floor) => floor.rooms)
        .filter((room) => room.code.startsWith(`PN ${prefix}-`));
      const twoBedroomSuffixes = new Set(prefix === '31' ? ['02', '04', '06'] : ['02', '04']);
      return rooms.length !== 7 || rooms.some((room) => {
        const suffix = room.code.slice(-2);
        const isTwoBedroom = twoBedroomSuffixes.has(suffix);
        const isLargeOneBedroom = prefix === '32' && suffix === '06';
        return room.bedCount !== (isTwoBedroom ? 2 : 1)
          || room.capacity !== (isTwoBedroom ? 4 : 2)
          || Number(room.area) !== (isTwoBedroom || isLargeOneBedroom ? 50 : 18);
      });
    })()));

  if (missing.length === 0 && invalid.length === 0) {
    console.log(`\nSeed OK: 4 buildings, LK01 topology exact, LK08 topology exact`);
    process.exit(0);
  } else {
    console.error(`\nSeed FAILED: Missing: ${missing.join(', ') || 'none'}; invalid topology: ${invalid.map((item) => item.code).join(', ') || 'none'}`);
    process.exit(1);
  }
}

checkSeed()
  .catch((e) => {
    console.error('Error checking seed data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
