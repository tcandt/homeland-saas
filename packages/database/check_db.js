const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { customer: true }
  });
  console.log(JSON.stringify(contracts, null, 2));
}
check().catch(console.error).finally(() => prisma.$disconnect());
