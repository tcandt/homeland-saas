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
    where: { code: { in: requiredBuildings } },
    include: { floors: { include: { rooms: true } } },
  });
  const invalid = details.filter((building) => building.floors.length !== 4
    || (building.code.startsWith('LK08') && building.floors.some((floor) => floor.rooms.length > 0))
    || (building.code === 'LK01.32' && building.floors.reduce((sum, floor) => sum + floor.rooms.filter((room) => room.code.startsWith('PN 32-')).length, 0) !== 7));

  if (missing.length === 0 && invalid.length === 0) {
    console.log(`\nSeed OK: 4 buildings, LK01.32 topology cloned, LK08 pending layouts empty`);
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
