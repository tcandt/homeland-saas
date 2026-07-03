const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  
  const permissions = [
    'customer.read', 'customer.create', 'customer.update', 'customer.delete',
    'invoice.read'
  ];

  for (const key of permissions) {
    const p = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Permission for ${key}` }
    });
    
    await prisma.rolePermission.create({
      data: { roleId: adminRole.id, permissionId: p.id },
    }).catch(() => {}); // ignore if exists
  }
  
  console.log('Granted customer & invoice perms to ADMIN');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
