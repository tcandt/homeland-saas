const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'sales@homeland.local' },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      }
    }
  });
  console.log(Array.from(new Set(user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.key)))));
}
main().finally(() => prisma.$disconnect());
