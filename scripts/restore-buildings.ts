import { PrismaClient } from '@prisma/client';
import { ensureManagedBuildingStructure } from '../packages/database/prisma/building-structure';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.tenantOrg.findFirst({
    where: { code: 'HOMELAND' },
  }) || await prisma.tenantOrg.findFirst();

  if (!org) {
    console.error('No organization found in database!');
    process.exit(1);
  }

  console.log(`Restoring building structure for organization: ${org.name} (${org.id})...`);
  const result = await ensureManagedBuildingStructure(prisma, org.id);
  console.log('Restored building structure successfully:', result);

  // Link owners if needed
  const ownerA = await prisma.owner.findFirst({ where: { tenantId: org.id, code: 'OWNER-A' } });
  const ownerB = await prisma.owner.findFirst({ where: { tenantId: org.id, code: 'OWNER-B' } });

  if (ownerA && ownerB) {
    const ownerByBuildingCode: Record<string, string> = {
      'LK01.31': ownerA.id,
      'LK01.32': ownerB.id,
      'LK08.24': ownerB.id,
      'LK08.25': ownerA.id,
    };
    for (const [code, ownerId] of Object.entries(ownerByBuildingCode)) {
      await prisma.building.updateMany({
        where: { tenantId: org.id, code },
        data: { ownerId },
      });
    }
    console.log('Owners relinked to buildings.');
  }

  // Ensure all rooms are set to AVAILABLE
  await prisma.room.updateMany({
    where: { tenantId: org.id },
    data: { status: 'AVAILABLE' },
  });
  console.log('All rooms reset to AVAILABLE status.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
