import { PrismaClient, RoleCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Synchronizing roles and permissions for Manager...');

  const permissions = [
    'building.read', 'building.create', 'building.update', 'building.delete',
    'floor.read', 'floor.create', 'floor.update', 'floor.delete',
    'room.read', 'room.create', 'room.update', 'room.delete',
    'customer.read', 'customer.create', 'customer.update', 'customer.delete',
    'contract.read', 'contract.create', 'contract.update', 'contract.delete', 'contract.sign',
    'invoice.read', 'invoice.create', 'invoice.update', 'invoice.delete', 'invoice.collect',
    'deposit.read', 'deposit.create', 'deposit.update', 'deposit.delete', 'deposit.collect', 'deposit.refund', 'deposit.convert', 'deposit.cancel',
    'meter.read', 'meter.update', 'meter.sync',
    'audit.read',
    'finance.read', 'finance.create', 'finance.update', 'finance.delete',
    'finance.approve', 'finance.pay', 'finance.settle', 'finance.export', 'finance.ownerProfit.read', 'finance.attachment.read',
    'task.read', 'task.create', 'task.update', 'task.delete',
    'sales.read', 'sales.create', 'sales.update', 'sales.delete',
    'setting.read', 'setting.update',
    'document.read', 'document.create', 'document.update', 'document.delete', 'document.generate', 'document.download', 'document.approve', 'document.sign', 'document.share', 'document.export'
  ];

  // 1. Ensure all permissions exist
  const createdPermissions = await Promise.all(
    permissions.map(key => prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Permission for ${key}` }
    }))
  );

  const adminRole = await prisma.role.findUnique({ where: { code: RoleCode.ADMIN } });
  const managerRole = await prisma.role.findUnique({ where: { code: RoleCode.MANAGER } });

  if (adminRole) {
    // Grant all to admin
    await prisma.rolePermission.createMany({
      data: createdPermissions.map(p => ({ roleId: adminRole.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    console.log('Updated Admin permissions');
  }

  if (managerRole) {
    // Clear old manager permissions and re-grant accurately
    const managerPermKeys = createdPermissions.filter(p => 
      (p.key.startsWith('building.') && p.key !== 'building.delete') || 
      (p.key.startsWith('floor.') && p.key !== 'floor.delete') || 
      (p.key.startsWith('room.') && p.key !== 'room.delete') || 
      p.key.startsWith('customer.') || 
      p.key.startsWith('contract.') || 
      p.key.startsWith('deposit.') || 
      p.key.startsWith('invoice.') || 
      p.key.startsWith('meter.') || 
      p.key === 'audit.read' ||
      p.key === 'finance.read' ||
      p.key === 'finance.create' ||
      p.key === 'finance.export' ||
      p.key === 'finance.attachment.read' ||
      p.key.startsWith('task.') ||
      p.key.startsWith('sales.')
    );

    // Remove any unauthorized permissions from Manager (like building.delete, finance.ownerProfit.read)
    const allManagerPerms = await prisma.rolePermission.findMany({
      where: { roleId: managerRole.id },
      include: { permission: true }
    });

    const allowedKeys = new Set(managerPermKeys.map(p => p.key));
    for (const rp of allManagerPerms) {
      if (!allowedKeys.has(rp.permission.key)) {
        await prisma.rolePermission.delete({
          where: { roleId_permissionId: { roleId: managerRole.id, permissionId: rp.permissionId } }
        });
        console.log(`Removed unpermitted key ${rp.permission.key} from Manager`);
      }
    }

    // Add missing allowed permissions
    for (const p of managerPermKeys) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: managerRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: managerRole.id, permissionId: p.id }
      });
    }

    console.log(`Successfully granted ${managerPermKeys.length} permissions to Manager role.`);
  }
}

main()
  .catch((e) => {
    console.error('Error synchronizing permissions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
