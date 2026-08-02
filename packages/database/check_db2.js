const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const room = await prisma.room.findUnique({
    where: { id: 'cmrj502pp0015zajsiurukh96' },
    include: {
      contracts: { where: { deletedAt: null }, include: { customer: true } },
      roommates: { where: { deletedAt: null } }
    }
  });
  console.log(JSON.stringify(room, null, 2));
}
check().catch(console.error).finally(() => prisma.$disconnect());
