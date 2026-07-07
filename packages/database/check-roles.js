const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'sales@homeland.local' },
    include: { roles: { include: { role: true } } }
  });
  console.log(user.roles.map(ur => ur.role.code));
}
main().finally(() => prisma.$disconnect());
