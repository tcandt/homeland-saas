const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const room = await prisma.room.findUnique({
    where: { id: 'cmriu3u2e0002dmjfia2yvc7i' },
    include: {
      contracts: { where: { deletedAt: null }, include: { customer: true } },
      roommates: { where: { deletedAt: null } }
    }
  });
  console.log(JSON.stringify(room, null, 2));
}
check().catch(console.error).finally(() => prisma.$disconnect());
