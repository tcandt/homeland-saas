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

  // Also ensure Sales has read access
  const salesRole = await prisma.role.findUnique({ where: { code: RoleCode.SALES } });
  if (salesRole) {
    const readPerms = ['building.read', 'floor.read', 'room.read'];
    for (const rKey of readPerms) {
      const perm = await prisma.permission.findUnique({ where: { key: rKey } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: salesRole.id, permissionId: perm.id } },
          update: {},
          create: { roleId: salesRole.id, permissionId: perm.id }
        });
        console.log(`Added ${rKey} to Sales role`);
      }
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
