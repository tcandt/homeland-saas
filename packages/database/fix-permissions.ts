import { PrismaClient, RoleCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const managerRole = await prisma.role.findUnique({ where: { code: RoleCode.MANAGER } });
  if (!managerRole) {
    console.log('Manager role not found');
    return;
  }

  const permissionsToDelete = ['building.delete', 'floor.delete', 'room.delete'];
  
  for (const pKey of permissionsToDelete) {
    const perm = await prisma.permission.findUnique({ where: { key: pKey } });
    if (perm) {
      await prisma.rolePermission.deleteMany({
        where: {
          roleId: managerRole.id,
          permissionId: perm.id
        }
      });
      console.log(`Deleted ${pKey} from Manager role`);
    }
  }

}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
