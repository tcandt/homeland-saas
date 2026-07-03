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

  if (missing.length === 0) {
    console.log(`\nSeed OK: 4 buildings found`);
    process.exit(0);
  } else {
    console.error(`\nSeed FAILED: Missing buildings: ${missing.join(', ')}`);
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
