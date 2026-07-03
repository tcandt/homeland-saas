const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.notificationQueue.findMany().then(res => {
  const failed = res.filter(r => r.payload && r.payload.title === 'Test Failed Notification');
  console.log(failed);
}).finally(() => prisma.$disconnect());
