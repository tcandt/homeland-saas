import { PrismaClient, RoleCode, RoomStatus, ContractStatus, InvoiceStatus, DepositStatus, PaymentStatus, TaskStatus, TaskPriority, LeadStatus, DepositType } from '@prisma/client';
import { ensureManagedBuildingStructure, MANAGED_BUILDINGS } from './building-structure';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('Starting Commercial-Grade Seed...');

  // 1. Create Organization
  const org = await prisma.tenantOrg.upsert({
    where: { code: 'HOMELAND' },
    update: {},
    create: { name: 'HomeLand Premium', code: 'HOMELAND' },
  });

  // 2. Roles & Permissions
  const permissions = [
    'building.read', 'building.create', 'building.update', 'building.delete',
    'floor.read', 'floor.create', 'floor.update', 'floor.delete',
    'room.read', 'room.create', 'room.update', 'room.delete',
    'customer.read', 'customer.create', 'customer.update', 'customer.delete',
    'contract.read', 'contract.create', 'contract.update', 'contract.delete', 'contract.sign',
    'invoice.read', 'invoice.create', 'invoice.update', 'invoice.delete', 'invoice.collect',
    'deposit.read', 'deposit.create', 'deposit.update', 'deposit.delete', 'deposit.collect', 'deposit.refund', 'deposit.convert', 'deposit.cancel',
    'finance.read', 'finance.create', 'finance.update', 'finance.delete',
    'finance.approve', 'finance.pay', 'finance.settle', 'finance.export', 'finance.ownerProfit.read', 'finance.attachment.read',
    'task.read', 'task.create', 'task.update', 'task.delete',
    'sales.read', 'sales.create', 'sales.update', 'sales.delete',
    'setting.read', 'setting.update',
    'document.read', 'document.create', 'document.update', 'document.delete', 'document.generate', 'document.download', 'document.approve', 'document.sign', 'document.share', 'document.export'
  ];

  const createdPermissions = await Promise.all(
    permissions.map(key => prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Permission for ${key}` }
    }))
  );

  const roles = await Promise.all(
    [RoleCode.ADMIN, RoleCode.MANAGER, RoleCode.SALES, RoleCode.FINANCE].map((code) =>
      prisma.role.upsert({
        where: { code },
        update: {},
        create: { code, name: code },
      }),
    )
  );

  const adminRole = roles.find((r) => r.code === RoleCode.ADMIN)!;
  const managerRole = roles.find((r) => r.code === RoleCode.MANAGER)!;
  const salesRole = roles.find((r) => r.code === RoleCode.SALES)!;
  const financeRole = roles.find((r) => r.code === RoleCode.FINANCE)!;

  // Grant all to admin
  await prisma.rolePermission.createMany({
    data: createdPermissions.map(p => ({ roleId: adminRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // Grant to Manager
  const managerPerms = createdPermissions.filter(p => 
    (p.key.startsWith('building.') && p.key !== 'building.delete') || 
    (p.key.startsWith('floor.') && p.key !== 'floor.delete') || 
    (p.key.startsWith('room.') && p.key !== 'room.delete') || 
    p.key.startsWith('customer.') || 
    p.key.startsWith('contract.') || 
    p.key.startsWith('deposit.') || 
    p.key.startsWith('invoice.read') || 
    p.key.startsWith('task.')
  );
  await prisma.rolePermission.createMany({
    data: managerPerms.map(p => ({ roleId: managerRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // Grant to Sales
  const salesPerms = createdPermissions.filter(p => 
    p.key.startsWith('room.') || 
    p.key.startsWith('customer.') || 
    p.key.startsWith('contract.') || 
    p.key.startsWith('deposit.') || 
    p.key.startsWith('invoice.read') || 
    p.key.startsWith('task.')
  );
  await prisma.rolePermission.createMany({
    data: salesPerms.map(p => ({ roleId: salesRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // Grant to Finance
  const financePerms = createdPermissions.filter(p => 
    p.key.startsWith('invoice.') || 
    p.key.startsWith('deposit.') || 
    p.key.startsWith('finance.') || 
    p.key.startsWith('contract.read') ||
    p.key.startsWith('customer.read') ||
    p.key.startsWith('room.read')
  );
  await prisma.rolePermission.createMany({
    data: financePerms.map(p => ({ roleId: financeRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // 3. Users
  const defaultAdminEmail = 'admin@homeland.vn';
  const legacyAdminEmails = ['admin@homeland.local', 'adminA@homeland.local', 'adminB@homeland.local'];
  const developmentPassword = process.env.SEED_DEFAULT_PASSWORD;
  const productionMode = process.env.SEED_MODE === 'production' || process.env.NODE_ENV === 'production';
  const forcePasswordChange = String(
    process.env.SEED_FORCE_PASSWORD_CHANGE ?? (productionMode ? 'true' : 'false'),
  ).toLowerCase() !== 'false';
  if (!developmentPassword) {
    throw new Error('SEED_DEFAULT_PASSWORD is required to seed the system admin account.');
  }
  const passwordHash = await bcrypt.hash(developmentPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: org.id, email: defaultAdminEmail } },
    update: {
      fullName: 'System Admin',
      status: 'ACTIVE',
      passwordHash,
      mustChangePassword: forcePasswordChange,
      refreshTokenHash: null,
    },
    create: {
      tenantId: org.id,
      email: defaultAdminEmail,
      fullName: 'System Admin',
      passwordHash,
      mustChangePassword: forcePasswordChange,
      refreshTokenHash: null,
    },
  });

  await prisma.user.updateMany({
    where: { tenantId: org.id, email: { in: legacyAdminEmails, mode: 'insensitive' } },
    data: { status: 'DISABLED' },
  });

  const managerUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: org.id, email: 'manager@homeland.local' } },
    update: {},
    create: { tenantId: org.id, email: 'manager@homeland.local', fullName: 'Operations Manager', passwordHash },
  });

  const salesUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: org.id, email: 'sales@homeland.local' } },
    update: {},
    create: { tenantId: org.id, email: 'sales@homeland.local', fullName: 'Sales Executive', passwordHash },
  });

  const financeUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: org.id, email: 'finance@homeland.local' } },
    update: {},
    create: { tenantId: org.id, email: 'finance@homeland.local', fullName: 'Finance Executive', passwordHash },
  });

  // Grant Roles
  await prisma.userRole.createMany({
    data: [
      { userId: adminUser.id, roleId: adminRole.id },
      { userId: managerUser.id, roleId: managerRole.id },
      { userId: salesUser.id, roleId: salesRole.id },
      { userId: financeUser.id, roleId: financeRole.id },
    ],
    skipDuplicates: true,
  });

  const structure = await ensureManagedBuildingStructure(prisma, org.id);
  console.log(`Managed building structure ready: ${structure.buildingCount} buildings, ${structure.sourceRoomCount} source rooms, ${structure.clonedRoomCount} cloned rooms, ${structure.cleanedLegacyRoomCount} legacy placeholders cleaned.`);

  const ownerA = await prisma.owner.upsert({
    where: { tenantId_code: { tenantId: org.id, code: 'OWNER-A' } },
    update: { name: 'Tính', isActive: true, notes: 'Managed by admin@homeland.vn. Buildings: LK01-31, LK08-25.' },
    create: { tenantId: org.id, code: 'OWNER-A', name: 'Tính', notes: 'Managed by admin@homeland.vn. Buildings: LK01-31, LK08-25.' },
  });

  const ownerB = await prisma.owner.upsert({
    where: { tenantId_code: { tenantId: org.id, code: 'OWNER-B' } },
    update: { name: 'Thể', isActive: true, notes: 'Managed by admin@homeland.vn. Buildings: LK01-32, LK08-24.' },
    create: { tenantId: org.id, code: 'OWNER-B', name: 'Thể', notes: 'Managed by admin@homeland.vn. Buildings: LK01-32, LK08-24.' },
  });

  const ownerByBuildingCode: Record<string, string> = {
    'LK01.31': ownerA.id,
    'LK01.32': ownerB.id,
    'LK08.24': ownerB.id,
    'LK08.25': ownerA.id,
  };

  for (const [code, ownerId] of Object.entries(ownerByBuildingCode)) {
    await prisma.building.updateMany({
      where: { tenantId: org.id, code },
      data: { ownerId },
    });
  }

  const bankAccountA = await prisma.bankAccount.upsert({
    where: { tenantId_accountNumber: { tenantId: org.id, accountNumber: '190333444555' } },
    update: { ownerId: ownerA.id, accountName: 'HKD NGUYEN DUC TINH' },
    create: { tenantId: org.id, ownerId: ownerA.id, bankName: 'Techcombank', accountNumber: '190333444555', accountName: 'HKD NGUYEN DUC TINH' },
  });

  const bankAccountB = await prisma.bankAccount.upsert({
    where: { tenantId_accountNumber: { tenantId: org.id, accountNumber: '190333444556' } },
    update: { ownerId: ownerB.id, accountName: 'HKD PHAN VAN THE' },
    create: { tenantId: org.id, ownerId: ownerB.id, bankName: 'Techcombank', accountNumber: '190333444556', accountName: 'HKD PHAN VAN THE' },
  });

  const managedBuildings = await prisma.building.findMany({
    where: { tenantId: org.id, code: { in: MANAGED_BUILDINGS } },
    select: { id: true, code: true },
  });
  const managedRooms = await prisma.room.findMany({
    where: {
      tenantId: org.id,
      buildingId: { in: managedBuildings.map((building) => building.id) },
      deletedAt: null,
    },
    select: { id: true, buildingId: true },
  });
  const buildingCodeById = new Map(managedBuildings.map((building) => [building.id, building.code]));
  const routeRows = managedRooms
    .map((room) => {
      const buildingCode = buildingCodeById.get(room.buildingId);
      if (!buildingCode) return null;
      const bankAccountId = buildingCode === 'LK01.31' || buildingCode === 'LK08.25'
        ? bankAccountA.id
        : buildingCode === 'LK01.32' || buildingCode === 'LK08.24'
          ? bankAccountB.id
          : null;
      if (!bankAccountId) return null;
      return {
        tenantId: org.id,
        roomId: room.id,
        bankAccountId,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: null,
        note: `Default seeded from building ${buildingCode}`,
      };
    })
    .filter(Boolean);

  try {
    await (prisma as any).roomPaymentAccountRoute.deleteMany({ where: { tenantId: org.id } });
    if (routeRows.length > 0) {
      await (prisma as any).roomPaymentAccountRoute.createMany({
        data: routeRows,
      });
    }
  } catch (error: any) {
    if (String(error?.code || '') !== 'P2021') {
      throw error;
    }
  }

  for (const bCode of MANAGED_BUILDINGS) {
    const building = await prisma.building.findUnique({ where: { tenantId_code: { tenantId: org.id, code: bCode } } });
    if (!building) continue;
    await prisma.costCenter.upsert({
      where: { tenantId_code: { tenantId: org.id, code: `CC-${bCode}` } },
      update: { ownerId: ownerByBuildingCode[bCode], buildingId: building.id },
      create: { tenantId: org.id, ownerId: ownerByBuildingCode[bCode], buildingId: building.id, code: `CC-${bCode}`, name: `Chi nhánh ${bCode}` },
    });
  }

  if (productionMode) {
    console.log('Production mode detected. Skipping mock buildings, floors, rooms, contracts, invoices, and transactions.');
    console.log('Commercial-Grade Seed completed successfully in PRODUCTION mode.');
    return;
  }

  // 4. Operational mock data is scoped to LK01-31 only. Structural clones stay clean.
  const buildingCodes = [...MANAGED_BUILDINGS];
  const sourceBuilding = await prisma.building.findUniqueOrThrow({ where: { tenantId_code: { tenantId: org.id, code: 'LK01.31' } } });
  const allRooms = await prisma.room.findMany({ where: { tenantId: org.id, buildingId: sourceBuilding.id, code: { startsWith: 'PN 31-' }, deletedAt: null }, orderBy: { code: 'asc' } });

  // 5. Advanced Business Scenario distribution
  // 80 rooms total:
  // 65% Rented (52 rooms)
  // 15% Reserved (12 rooms)
  // 10% Expiring soon (8 rooms)
  // 10% Empty/Available (8 rooms)

  const existingContracts = await prisma.contract.count({ where: { tenantId: org.id } });
  if (existingContracts > 0) {
    console.log('Commercial Seed Data already exists. Skipping distribution...');
    return;
  }

  let roomIndex = 0;
  const now = new Date();

  const rentedRoomCount = Math.min(3, allRooms.length);
  const reservedRoomCount = Math.min(1, Math.max(allRooms.length - rentedRoomCount, 0));
  const expiringRoomCount = Math.min(1, Math.max(allRooms.length - rentedRoomCount - reservedRoomCount, 0));

  // Create Rented Rooms
  for (let i = 0; i < rentedRoomCount; i++) {
    const room = allRooms[roomIndex++];
    
    // Create Customer
    const customer = await prisma.customer.create({
      data: {
        tenantId: org.id,
        fullName: `Khách Hàng ${room.code}`,
        phone: `090${getRandomInt(1000000, 9999999)}`,
        email: `khach${roomIndex}@example.com`,
      }
    });

    // Create Contract
    const contract = await prisma.contract.create({
      data: {
        tenantId: org.id,
        roomId: room.id,
        customerId: customer.id,
        code: `HD-${room.code}-${now.getFullYear()}`,
        status: ContractStatus.ACTIVE,
        startDate: addDays(now, -100),
        endDate: addDays(now, 265),
        monthlyRent: room.monthlyPrice,
        depositMoney: Number(room.monthlyPrice) * 1.5,
      }
    });

    // Create Deposit
    await prisma.deposit.create({
      data: {
        tenantId: org.id,
        code: `DEP-${room.code}-${now.getFullYear()}`,
        type: DepositType.SECURITY,
        roomId: room.id,
        customerId: customer.id,
        contractId: contract.id,
        amount: contract.depositMoney,
        status: DepositStatus.PAID,
      }
    });

    // Update Room Status
    await prisma.room.update({
      where: { id: room.id },
      data: { status: RoomStatus.OCCUPIED }
    });

    // Simulate some overdue invoices for realism (e.g. 5% of them)
    if (i < 3) {
      const invoice = await prisma.invoice.create({
        data: {
          tenantId: org.id,
          contractId: contract.id,
          customerId: customer.id,
          code: `INV-${contract.code}-OVERDUE`,
          status: InvoiceStatus.OVERDUE,
          dueDate: addDays(now, -5),
          subtotal: contract.monthlyRent,
          total: contract.monthlyRent,
        }
      });
      // Task for overdue collection
      await prisma.task.create({
        data: {
          tenantId: org.id,
          title: `Thu hồi nợ phòng ${room.code}`,
          description: `Khách hàng trễ hạn thanh toán hóa đơn ${invoice.code}`,
          status: TaskStatus.TODO,
          priority: TaskPriority.URGENT,
          assigneeId: managerUser.id,
          dueDate: addDays(now, 1)
        }
      });
    }
  }

  // Create Reserved Rooms
  for (let i = 0; i < reservedRoomCount; i++) {
    const room = allRooms[roomIndex++];
    
    const customer = await prisma.customer.create({
      data: {
        tenantId: org.id,
        fullName: `Khách Cọc ${room.code}`,
        phone: `091${getRandomInt(1000000, 9999999)}`,
      }
    });

    await prisma.deposit.create({
      data: {
        tenantId: org.id,
        code: `RES-${room.code}-${now.getFullYear()}`,
        type: DepositType.RESERVATION,
        roomId: room.id,
        customerId: customer.id,
        amount: 2000000, // Cọc giữ chỗ
        status: DepositStatus.PENDING,
        expiredAt: addDays(now, 3),
      }
    });

    await prisma.room.update({
      where: { id: room.id },
      data: { status: RoomStatus.RESERVED }
    });
  }

  // Create Expiring Soon Rooms
  for (let i = 0; i < expiringRoomCount; i++) {
    const room = allRooms[roomIndex++];
    
    const customer = await prisma.customer.create({
      data: {
        tenantId: org.id,
        fullName: `Khách Sắp Hết Hạn ${room.code}`,
        phone: `092${getRandomInt(1000000, 9999999)}`,
      }
    });

    await prisma.contract.create({
      data: {
        tenantId: org.id,
        roomId: room.id,
        customerId: customer.id,
        code: `HD-EXP-${room.code}`,
        status: ContractStatus.EXPIRING,
        startDate: addDays(now, -350),
        endDate: addDays(now, 15),
        monthlyRent: room.monthlyPrice,
        depositMoney: Number(room.monthlyPrice) * 1.5,
      }
    });

    await prisma.room.update({
      where: { id: room.id },
      data: { status: RoomStatus.OCCUPIED }
    });

    await prisma.task.create({
      data: {
        tenantId: org.id,
        title: `Tái ký hợp đồng phòng ${room.code}`,
        description: `Hợp đồng sắp hết hạn trong 15 ngày tới`,
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        assigneeId: salesUser.id,
        dueDate: addDays(now, 5)
      }
    });
  }

  // Remaining 8 rooms are AVAILABLE (already default)

  // 6. Sales Leads
  await prisma.salesLead.createMany({
    data: [
      { tenantId: org.id, name: 'Nguyễn Văn A', phone: '0981112222', status: LeadStatus.NEW },
      { tenantId: org.id, name: 'Trần Thị B', phone: '0983334444', status: LeadStatus.CONTACTED },
      { tenantId: org.id, name: 'Lê Văn C', phone: '0985556666', status: LeadStatus.QUALIFIED },
    ]
  });

  // 7. Finance / Accounting Domain
  console.log('Seeding Finance & Accounting...');
  
  const chartOfAccounts = [
    { code: '1000', name: 'Cash', type: 'ASSET' as any },
    { code: '1100', name: 'Bank', type: 'ASSET' as any },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET' as any },
    { code: '1300', name: 'Deposits Held', type: 'LIABILITY' as any },
    { code: '4000', name: 'Rental Revenue', type: 'REVENUE' as any },
    { code: '4100', name: 'Utility Revenue', type: 'REVENUE' as any },
    { code: '4200', name: 'Service Revenue', type: 'REVENUE' as any },
    { code: '4300', name: 'Deposit Forfeiture Revenue', type: 'REVENUE' as any },
    { code: '5000', name: 'Electricity Expense', type: 'EXPENSE' as any },
    { code: '5100', name: 'Water Expense', type: 'EXPENSE' as any },
    { code: '5200', name: 'Maintenance Expense', type: 'EXPENSE' as any },
    { code: '5300', name: 'Staff Expense', type: 'EXPENSE' as any },
    { code: '5400', name: 'Other Expense', type: 'EXPENSE' as any },
  ];

  const createdAccounts: Record<string, any> = {};
  for (const account of chartOfAccounts) {
    createdAccounts[account.code] = await prisma.chartOfAccount.upsert({
      where: { tenantId_code: { tenantId: org.id, code: account.code } },
      update: {},
      create: { tenantId: org.id, code: account.code, name: account.name, type: account.type },
    });
  }

  await prisma.cashAccount.upsert({
    where: { tenantId_code: { tenantId: org.id, code: 'CASH-01' } },
    update: {},
    create: { tenantId: org.id, code: 'CASH-01', name: 'Tiền mặt tại quỹ' },
  });

  await prisma.bankAccount.upsert({
    where: { tenantId_accountNumber: { tenantId: org.id, accountNumber: '190333444555' } },
    update: { ownerId: ownerA.id, accountName: 'HKD NGUYEN DUC TINH' },
    create: { tenantId: org.id, ownerId: ownerA.id, bankName: 'Techcombank', accountNumber: '190333444555', accountName: 'HKD NGUYEN DUC TINH' },
  });

  await prisma.bankAccount.upsert({
    where: { tenantId_accountNumber: { tenantId: org.id, accountNumber: '190333444556' } },
    update: { ownerId: ownerB.id, accountName: 'HKD PHAN VAN THE' },
    create: { tenantId: org.id, ownerId: ownerB.id, bankName: 'Techcombank', accountNumber: '190333444556', accountName: 'HKD PHAN VAN THE' },
  });

  const createdCostCenters: Record<string, any> = {};
  for (const bCode of buildingCodes) {
    const building = await prisma.building.findUnique({ where: { tenantId_code: { tenantId: org.id, code: bCode } } });
    createdCostCenters[bCode] = await prisma.costCenter.upsert({
      where: { tenantId_code: { tenantId: org.id, code: `CC-${bCode}` } },
      update: { ownerId: ownerByBuildingCode[bCode], buildingId: building?.id },
      create: { tenantId: org.id, ownerId: ownerByBuildingCode[bCode], buildingId: building?.id, code: `CC-${bCode}`, name: `Chi nhánh ${bCode}` },
    });
  }

  // Create an Expense
  const expense = await prisma.expense.create({
    data: {
      tenantId: org.id,
      code: `EXP-${now.getFullYear()}-001`,
      costCenterId: createdCostCenters[buildingCodes[0]].id,
      ownerId: ownerByBuildingCode[buildingCodes[0]],
      buildingId: createdCostCenters[buildingCodes[0]].buildingId,
      paidByName: ownerA.name,
      category: 'UTILITY' as any,
      settlementStatus: 'DEDUCTED_FROM_PROFIT' as any,
      amount: 1500000,
      status: 'PAID' as any,
      description: 'Tiền điện tháng trước',
    }
  });

  // Create Journal Entry for that Expense
  const je1 = await prisma.journalEntry.create({
    data: {
      tenantId: org.id,
      code: `JE-${now.getFullYear()}-001`,
      sourceType: 'EXPENSE' as any,
      sourceId: expense.id,
      description: 'Hạch toán chi phí điện',
      status: 'POSTED',
      lines: {
        create: [
          {
            tenantId: org.id,
            accountId: createdAccounts['5000'].id,
            costCenterId: createdCostCenters[buildingCodes[0]].id,
            type: 'DEBIT' as any,
            amount: 1500000,
            description: 'Chi phí điện',
          },
          {
            tenantId: org.id,
            accountId: createdAccounts['1100'].id,
            costCenterId: createdCostCenters[buildingCodes[0]].id,
            type: 'CREDIT' as any,
            amount: 1500000,
            description: 'Chi từ ngân hàng',
          }
        ]
      }
    }
  });

  // Seed a Revenue Journal Entry (Deposit)
  const je2 = await prisma.journalEntry.create({
    data: {
      tenantId: org.id,
      code: `JE-${now.getFullYear()}-002`,
      sourceType: 'DEPOSIT' as any,
      sourceId: 'dummy-deposit-id',
      description: 'Hạch toán cọc',
      status: 'POSTED',
      lines: {
        create: [
          {
            tenantId: org.id,
            accountId: createdAccounts['1100'].id,
            costCenterId: createdCostCenters[buildingCodes[0]].id,
            type: 'DEBIT' as any,
            amount: 5000000,
            description: 'Thu tiền cọc qua ngân hàng',
          },
          {
            tenantId: org.id,
            accountId: createdAccounts['1300'].id,
            costCenterId: createdCostCenters[buildingCodes[0]].id,
            type: 'CREDIT' as any,
            amount: 5000000,
            description: 'Phải trả khách hàng (Cọc)',
          }
        ]
      }
    }
  });

  // 8. Communication Templates
  console.log('Seeding Notification Templates...');
  const templates = [
    {
      code: 'DEPOSIT_COLLECTED',
      name: 'Deposit Collected Notification',
      subject: 'Xác nhận thu cọc {{code}}{{#if roomCode}} - phòng {{roomCode}}{{/if}}',
      body: 'Xin chào {{default customerName "quý khách"}},\n\nChúng tôi đã thu thành công khoản cọc {{formatCurrency amount "VND"}} cho giao dịch {{code}} vào lúc {{formatDateTime createdAt}}.{{#if roomCode}}\nPhòng áp dụng: {{roomCode}}{{#if roomRentalTypeLabel}} ({{roomRentalTypeLabel}}){{/if}}.{{/if}}{{#if buildingName}}\nTòa nhà: {{buildingName}}.{{/if}}\n\nTrân trọng,'
    },
    {
      code: 'INVOICE_OVERDUE',
      name: 'Invoice Overdue Notification',
      subject: 'Nhắc nhở: Hóa đơn {{code}} quá hạn{{#if roomCode}} - phòng {{roomCode}}{{/if}}',
      body: 'Xin chào {{default customerName "quý khách"}},\n\nHóa đơn {{code}} với số tiền {{formatCurrency total "VND"}} đã quá hạn thanh toán {{daysDiff dueDate "now"}} ngày.{{#if roomCode}}\nPhòng: {{roomCode}}{{#if roomRentalTypeLabel}} ({{roomRentalTypeLabel}}){{/if}}.{{/if}}{{#if roomMemberCount}}\nSố người theo hợp đồng: {{roomMemberCount}}.{{/if}}{{#if buildingName}}\nTòa nhà: {{buildingName}}.{{/if}}\n\nVui lòng thanh toán sớm.\n\nTrân trọng,'
    },
    {
      code: 'SYSTEM_ALERT',
      name: 'System Alert',
      subject: 'Thông báo hệ thống: {{title}}',
      body: '{{message}}{{#if roomCode}}\n\nPhòng: {{roomCode}}{{#if roomRentalTypeLabel}} ({{roomRentalTypeLabel}}){{/if}}{{/if}}{{#if roomMemberCount}}\nSố người: {{roomMemberCount}}{{/if}}{{#if buildingName}}\nTòa nhà: {{buildingName}}{{/if}}'
    }
  ];

  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { tenantId_code: { tenantId: org.id, code: t.code } },
      update: { name: t.name, subject: t.subject, body: t.body },
      create: { tenantId: org.id, ...t }
    });
  }

  const paymentTemplates = [
    {
      code: 'INVOICE_ZALO_PAYMENT_REQUEST',
      name: 'Invoice Payment Request Zalo',
      subject: 'HomeLand - Hóa đơn tiền nhà {{period}}',
      body: 'HomeLand - Hóa đơn tiền nhà {{period}}\n\nKính gửi: {{customerName}}\n{{roomAndBuilding}}\n\nChi tiết khoản thu:\n{{itemsSummary}}\nTổng: {{amount}} đ\n\n(Quét mã QR đính kèm để thanh toán nhanh)',
    },
    {
      code: 'DEPOSIT_ZALO_PAYMENT_REQUEST',
      name: 'Deposit Payment Request Zalo',
      subject: 'HomeLand - Hóa đơn tiền cọc {{roomAndBuilding}}',
      body: 'HomeLand - Hóa đơn tiền cọc {{roomAndBuilding}}\n\nKính gửi: {{customerName}}\n{{roomAndBuilding}}\n\nChi tiết khoản thu:\n{{itemsSummary}}\nTổng: {{amount}} đ\n\n(Quét mã QR đính kèm để thanh toán nhanh)',
    },
    {
      code: 'INVOICE_ZALO_PAYMENT_CONFIRMATION',
      name: 'Invoice Payment Confirmation Zalo',
      subject: 'Đã nhận thanh toán hóa đơn {{invoiceCode}}{{#if roomCode}} - phòng {{roomCode}}{{/if}}',
      body: 'Xin chào {{customerName}},\n\nHệ thống đã nhận thanh toán thành công cho hóa đơn {{invoiceCode}} với số tiền {{formatCurrency amount "VND"}}.{{#if roomCode}}\nPhòng: {{roomCode}}{{#if roomRentalTypeLabel}} ({{roomRentalTypeLabel}}){{/if}}.{{/if}}{{#if buildingName}}\nTòa nhà: {{buildingName}}.{{/if}}\n\nTrân trọng,'
    },
    {
      code: 'DEPOSIT_ZALO_PAYMENT_CONFIRMATION',
      name: 'Deposit Payment Confirmation Zalo',
      subject: 'Đã nhận thanh toán phiếu cọc {{depositCode}}{{#if roomCode}} - phòng {{roomCode}}{{/if}}',
      body: 'Xin chào {{customerName}},\n\nHệ thống đã nhận thanh toán thành công cho phiếu cọc {{depositCode}} với số tiền {{formatCurrency amount "VND"}}.{{#if roomCode}}\nPhòng: {{roomCode}}{{#if roomRentalTypeLabel}} ({{roomRentalTypeLabel}}){{/if}}.{{/if}}{{#if buildingName}}\nTòa nhà: {{buildingName}}.{{/if}}\n\nTrân trọng,'
    }
  ];

  for (const t of paymentTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { tenantId_code: { tenantId: org.id, code: t.code } },
      update: { name: t.name, subject: t.subject, body: t.body },
      create: { tenantId: org.id, ...t }
    });
  }

  const zaloBotTemplates = [
    {
      code: 'CUSTOMER_ZALO_REGISTERED',
      name: 'Customer Zalo Registered',
      subject: '✅ HomeLand - Đăng ký thành công',
      body: '✅ *HomeLand - Đăng ký thành công*\n\n🏠 Phòng: {{roomCode}}\n📱 SĐT: {{phone}}\n\nTài khoản Zalo này sẽ nhận thông báo về hợp đồng, hóa đơn và thanh toán.'
    },
    {
      code: 'CUSTOMER_ZALO_REGISTER_SYNTAX_ERROR',
      name: 'Customer Zalo Register Syntax Error',
      subject: '⚠️ HomeLand - Đăng ký Zalo Bot',
      body: '⚠️ *Cú pháp chưa đúng*\n\nVui lòng nhắn theo mẫu:\n`DK <SĐT> <PHÒNG>`\n\nVí dụ:\n`DK 0567867889 31.06`'
    },
    {
      code: 'CUSTOMER_ZALO_ROOM_NOT_FOUND',
      name: 'Customer Zalo Room Not Found',
      subject: '❌ HomeLand - Không tìm thấy phòng',
      body: '❌ *Không thể đăng ký*\n\n🏠 Phòng: {{roomCode}}\nLý do: không tìm thấy phòng.\n\nVui lòng kiểm tra lại mã phòng.'
    },
    {
      code: 'CUSTOMER_ZALO_NO_ACTIVE_CONTRACT',
      name: 'Customer Zalo No Active Contract',
      subject: '❌ HomeLand - Chưa có hợp đồng hoạt động',
      body: '❌ *Không thể đăng ký*\n\n🏠 Phòng: {{roomCode}}\nPhòng hiện không có hợp đồng đang hoạt động.'
    },
    {
      code: 'CUSTOMER_ZALO_PHONE_NOT_IN_CONTRACT',
      name: 'Customer Zalo Phone Not In Contract',
      subject: '⚠️ HomeLand - Không thể xác minh đăng ký',
      body: '⚠️ *Không thể xác minh đăng ký*\n\n🏠 Phòng: {{roomCode}}\n📱 SĐT: {{phone}}\n\nSĐT chưa được ghi nhận trong hợp đồng. Vui lòng liên hệ quản lý.'
    },
    {
      code: 'CUSTOMER_ZALO_DEPOSIT_REQUEST',
      name: 'Customer Zalo Deposit Request',
      subject: '💰 HomeLand - Thông báo tiền cọc',
      body: '💰 *Thông báo tiền cọc*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách thuê: {{customerName}}\n💵 Số tiền cọc: {{formatCurrency amount "VND"}}\n\nVui lòng thanh toán theo thông tin/QR đã gửi.'
    },
    {
      code: 'CUSTOMER_ZALO_DEPOSIT_CONFIRMED',
      name: 'Customer Zalo Deposit Confirmed',
      subject: '✅ HomeLand - Xác nhận tiền cọc',
      body: '✅ *Đã nhận tiền cọc*\n\n🏠 Phòng: {{roomCode}}\n💵 Số tiền: {{formatCurrency amount "VND"}}\n🕒 Thời gian: {{formatDateTime paidAt}}\n\nHomeLand đã ghi nhận khoản cọc của anh/chị.'
    },
    {
      code: 'CUSTOMER_ZALO_INVOICE_ISSUED',
      name: 'Customer Zalo Invoice Issued',
      subject: '🧾 HomeLand - Hóa đơn {{invoiceCode}}',
      body: '🧾 *Hóa đơn kỳ {{billingPeriod}}*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách thuê: {{customerName}}\n\n• Tiền phòng: {{formatCurrency rentAmount "VND"}}\n• Điện: {{formatCurrency electricAmount "VND"}}\n• Nước: {{formatCurrency waterAmount "VND"}}\n• Dịch vụ: {{formatCurrency serviceAmount "VND"}}\n• Khác: {{formatCurrency otherAmount "VND"}}\n\n💵 Tổng thanh toán: {{formatCurrency totalAmount "VND"}}\n📅 Hạn thanh toán: {{dueDate}}\n🔖 Mã thanh toán: {{paymentCode}}'
    },
    {
      code: 'CUSTOMER_ZALO_PAYMENT_QR',
      name: 'Customer Zalo Payment QR',
      subject: '🏦 HomeLand - Thanh toán hóa đơn',
      body: '🏦 *Thanh toán hóa đơn*\n\n🏠 Phòng: {{roomCode}}\n📆 Kỳ: {{billingPeriod}}\n💵 Tổng thanh toán: {{formatCurrency totalAmount "VND"}}\n🔖 Mã thanh toán: {{paymentCode}}\n\nQR thanh toán:\n{{qrUrl}}\n\nVui lòng chuyển đúng số tiền và đúng nội dung.'
    },
    {
      code: 'CUSTOMER_ZALO_PAYMENT_REMINDER',
      name: 'Customer Zalo Payment Reminder',
      subject: '⏰ HomeLand - Nhắc thanh toán',
      body: '⏰ *Nhắc thanh toán*\n\n🏠 Phòng: {{roomCode}}\n📆 Kỳ: {{billingPeriod}}\n💵 Số tiền cần thanh toán: {{formatCurrency totalAmount "VND"}}\n📅 Hạn thanh toán: {{dueDate}}\n🔖 Mã thanh toán: {{paymentCode}}\n{{#if qrUrl}}\nQR: {{qrUrl}}{{/if}}'
    },
    {
      code: 'CUSTOMER_ZALO_PAYMENT_OVERDUE',
      name: 'Customer Zalo Payment Overdue',
      subject: '🚨 HomeLand - Thanh toán quá hạn',
      body: '🚨 *Thanh toán quá hạn*\n\n🏠 Phòng: {{roomCode}}\n📆 Kỳ: {{billingPeriod}}\n💵 Còn thiếu: {{formatCurrency remainingAmount "VND"}}\n📅 Hạn thanh toán: {{dueDate}}\n🔖 Mã thanh toán: {{paymentCode}}\n\nVui lòng thanh toán sớm để tránh ảnh hưởng đến dịch vụ.'
    },
    {
      code: 'CUSTOMER_ZALO_PAYMENT_CONFIRMED',
      name: 'Customer Zalo Payment Confirmed',
      subject: '✅ HomeLand - Thanh toán thành công',
      body: '✅ *Thanh toán thành công*\n\n🏠 Phòng: {{roomCode}}\n📆 Kỳ: {{billingPeriod}}\n💵 Số tiền đã nhận: {{formatCurrency paidAmount "VND"}}\n🕒 Thời gian: {{formatDateTime paidAt}}\n\nHomeLand đã ghi nhận thanh toán. Xin cảm ơn.'
    },
    {
      code: 'CUSTOMER_ZALO_PAYMENT_PARTIAL',
      name: 'Customer Zalo Payment Partial',
      subject: '⚠️ HomeLand - Thanh toán chưa đủ',
      body: '⚠️ *Thanh toán chưa đủ*\n\n🏠 Phòng: {{roomCode}}\n📆 Kỳ: {{billingPeriod}}\n💵 Tổng cần thanh toán: {{formatCurrency expectedAmount "VND"}}\n💸 Đã nhận: {{formatCurrency paidAmount "VND"}}\n➖ Còn thiếu: {{formatCurrency remainingAmount "VND"}}\n\nVui lòng thanh toán phần còn lại theo mã `{{paymentCode}}`.'
    },
    {
      code: 'CUSTOMER_ZALO_PAYMENT_OVERPAID',
      name: 'Customer Zalo Payment Overpaid',
      subject: 'ℹ️ HomeLand - Thanh toán vượt số tiền cần thu',
      body: 'ℹ️ *Thanh toán vượt số tiền cần thu*\n\n🏠 Phòng: {{roomCode}}\n📆 Kỳ: {{billingPeriod}}\n💵 Cần thanh toán: {{formatCurrency expectedAmount "VND"}}\n💸 Đã nhận: {{formatCurrency paidAmount "VND"}}\n➕ Dư: {{formatCurrency overpaidAmount "VND"}}\n\nHomeLand sẽ kiểm tra và liên hệ xử lý phần chênh lệch.'
    },
    {
      code: 'CUSTOMER_ZALO_UNMATCHED_TRANSACTION',
      name: 'Customer Zalo Unmatched Transaction',
      subject: '🔎 HomeLand - Giao dịch đang chờ kiểm tra',
      body: '🔎 *Giao dịch đang chờ kiểm tra*\n\n💵 Số tiền: {{formatCurrency paidAmount "VND"}}\n📝 Nội dung chuyển khoản: {{transferContent}}\n\nHomeLand đã nhận được giao dịch nhưng chưa thể đối soát tự động. Quản lý sẽ kiểm tra sớm.'
    },
    {
      code: 'CUSTOMER_ZALO_CONTRACT_EXPIRING',
      name: 'Customer Zalo Contract Expiring',
      subject: '📅 HomeLand - Nhắc gia hạn hợp đồng',
      body: '📅 *Nhắc gia hạn hợp đồng*\n\n🏠 Phòng: {{roomCode}}\n📅 Hợp đồng sẽ hết hạn vào: {{contractEndDate}}\n\nNếu có nhu cầu gia hạn, vui lòng phản hồi quản lý sớm.'
    },
    {
      code: 'CUSTOMER_ZALO_CONTRACT_RENEWAL_REQUESTED',
      name: 'Customer Zalo Contract Renewal Requested',
      subject: '✅ HomeLand - Đã tiếp nhận yêu cầu gia hạn',
      body: '✅ *Đã tiếp nhận yêu cầu gia hạn*\n\n🏠 Phòng: {{roomCode}}\n📅 Ngày hết hạn hiện tại: {{contractEndDate}}\n\nHomeLand sẽ liên hệ xác nhận sớm.'
    },
    {
      code: 'CUSTOMER_ZALO_CONTRACT_RENEWAL_DECLINED',
      name: 'Customer Zalo Contract Renewal Declined',
      subject: '📦 HomeLand - Xác nhận không gia hạn',
      body: '📦 *Xác nhận không gia hạn*\n\n🏠 Phòng: {{roomCode}}\n📅 Ngày kết thúc hợp đồng: {{contractEndDate}}\n\nVui lòng phối hợp bàn giao đúng thời gian.'
    },
    {
      code: 'CUSTOMER_ZALO_RESIDENCY_REMINDER',
      name: 'Customer Zalo Residency Reminder',
      subject: '📄 HomeLand - Nhắc bổ sung hồ sơ',
      body: '📄 *Nhắc bổ sung hồ sơ*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách thuê: {{customerName}}\n\nVui lòng bổ sung hồ sơ/tạm trú còn thiếu theo hướng dẫn của quản lý.'
    },
    {
      code: 'CUSTOMER_ZALO_GENERAL_NOTICE',
      name: 'Customer Zalo General Notice',
      subject: '📢 HomeLand - Thông báo',
      body: '📢 *Thông báo*\n\n🏠 Phòng: {{roomCode}}\n\n{{messageBody}}\n\nNếu cần hỗ trợ, vui lòng liên hệ quản lý.'
    },
    {
      code: 'ADMIN_ZALO_CUSTOMER_REGISTERED',
      name: 'Admin Zalo Customer Registered',
      subject: '✅ HomeLand - Khách đã đăng ký Zalo Bot',
      body: '✅ *Khách đã đăng ký Zalo Bot*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📱 SĐT: {{phone}}\n#️⃣ Chat ID: {{chatId}}'
    },
    {
      code: 'ADMIN_ZALO_REGISTER_FAILED_ROOM_NOT_FOUND',
      name: 'Admin Zalo Register Failed Room Not Found',
      subject: '❌ HomeLand - Đăng ký Bot thất bại',
      body: '❌ *Đăng ký Bot thất bại*\n\n🏠 Phòng: {{roomCode}}\n📱 SĐT: {{phone}}\nLý do: `ROOM_NOT_FOUND`'
    },
    {
      code: 'ADMIN_ZALO_REGISTER_REVIEW_REQUIRED',
      name: 'Admin Zalo Register Review Required',
      subject: '⚠️ HomeLand - Đăng ký Bot cần kiểm tra',
      body: '⚠️ *Đăng ký Bot cần kiểm tra*\n\n🏠 Phòng: {{roomCode}}\n📱 SĐT: {{phone}}\nLý do: `PHONE_NOT_IN_CONTRACT`'
    },
    {
      code: 'ADMIN_ZALO_GROUP_CONNECTED',
      name: 'Admin Zalo Group Connected',
      subject: 'HomeLand - Admin Bot Connected',
      body: '✅ *Bot Admin đã kết nối*\n\n#️⃣ Chat ID: `{{chatId}}`\n{{#if senderId}}👤 Sender: `{{senderId}}`\n{{/if}}{{#if domain}}🌐 Domain: {{domain}}\n{{/if}}🕒 {{connectedAt}}'
    },
    {
      code: 'ADMIN_ZALO_INVOICE_CREATED',
      name: 'Admin Zalo Invoice Created',
      subject: '🧾 HomeLand - Đã tạo hóa đơn',
      body: '🧾 *Đã tạo hóa đơn*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📆 Kỳ: {{billingPeriod}}\n💵 Tổng tiền: {{formatCurrency totalAmount "VND"}}\n📅 Hạn thanh toán: {{dueDate}}\n🔖 Mã thanh toán: {{paymentCode}}'
    },
    {
      code: 'ADMIN_ZALO_INVOICE_SENT',
      name: 'Admin Zalo Invoice Sent',
      subject: '📨 HomeLand - Gửi hóa đơn thành công',
      body: '📨 *Gửi hóa đơn thành công*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📆 Kỳ: {{billingPeriod}}\n🔖 Mã thanh toán: {{paymentCode}}\nKênh: Zalo'
    },
    {
      code: 'ADMIN_ZALO_INVOICE_SEND_FAILED',
      name: 'Admin Zalo Invoice Send Failed',
      subject: '❌ HomeLand - Gửi hóa đơn thất bại',
      body: '❌ *Gửi hóa đơn thất bại*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📆 Kỳ: {{billingPeriod}}\n🔖 Mã thanh toán: {{paymentCode}}\nLỗi: {{errorMessage}}'
    },
    {
      code: 'ADMIN_ZALO_PAYMENT_CONFIRMED',
      name: 'Admin Zalo Payment Confirmed',
      subject: '✅ HomeLand - Đã nhận thanh toán',
      body: '✅ *Đã nhận thanh toán*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📆 Kỳ: {{billingPeriod}}\n💵 Số tiền: {{formatCurrency paidAmount "VND"}}\n🕒 Thời gian: {{formatDateTime paidAt}}\n🔖 Mã thanh toán: {{paymentCode}}'
    },
    {
      code: 'ADMIN_ZALO_PAYMENT_PARTIAL',
      name: 'Admin Zalo Payment Partial',
      subject: '⚠️ HomeLand - Thanh toán thiếu',
      body: '⚠️ *Thanh toán thiếu*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📆 Kỳ: {{billingPeriod}}\n💵 Cần thu: {{formatCurrency expectedAmount "VND"}}\n💸 Đã nhận: {{formatCurrency paidAmount "VND"}}\n➖ Còn thiếu: {{formatCurrency remainingAmount "VND"}}\n🔖 Mã thanh toán: {{paymentCode}}'
    },
    {
      code: 'ADMIN_ZALO_PAYMENT_OVERPAID',
      name: 'Admin Zalo Payment Overpaid',
      subject: 'ℹ️ HomeLand - Thanh toán dư',
      body: 'ℹ️ *Thanh toán dư*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📆 Kỳ: {{billingPeriod}}\n💵 Cần thu: {{formatCurrency expectedAmount "VND"}}\n💸 Đã nhận: {{formatCurrency paidAmount "VND"}}\n➕ Dư: {{formatCurrency overpaidAmount "VND"}}\n🔖 Mã thanh toán: {{paymentCode}}'
    },
    {
      code: 'ADMIN_ZALO_UNMATCHED_TRANSACTION',
      name: 'Admin Zalo Unmatched Transaction',
      subject: '🔎 HomeLand - Giao dịch không match',
      body: '🔎 *Giao dịch không match*\n\n💵 Số tiền: {{formatCurrency paidAmount "VND"}}\n🕒 Thời gian: {{formatDateTime paidAt}}\n📝 Nội dung CK: {{transferContent}}\n🏦 Ngân hàng nhận: {{bankAccount}}\nLý do: {{reason}}'
    },
    {
      code: 'ADMIN_ZALO_WRONG_BANK',
      name: 'Admin Zalo Wrong Bank',
      subject: '🏦 HomeLand - Giao dịch sai tài khoản/ngân hàng',
      body: '🏦 *Giao dịch sai tài khoản/ngân hàng*\n\n💵 Số tiền: {{formatCurrency paidAmount "VND"}}\n📝 Nội dung CK: {{transferContent}}\n🏦 Ngân hàng nhận: {{actualBank}}\n🎯 Kỳ vọng: {{expectedBank}}\n\nCần kiểm tra thủ công.'
    },
    {
      code: 'ADMIN_ZALO_PAYMENT_OVERDUE',
      name: 'Admin Zalo Payment Overdue',
      subject: '🚨 HomeLand - Khách quá hạn thanh toán',
      body: '🚨 *Khách quá hạn thanh toán*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📆 Kỳ: {{billingPeriod}}\n💵 Còn nợ: {{formatCurrency remainingAmount "VND"}}\n📅 Hạn thanh toán: {{dueDate}}\n⏳ Quá hạn: {{overdueDays}} ngày'
    },
    {
      code: 'ADMIN_ZALO_CONTRACT_EXPIRING',
      name: 'Admin Zalo Contract Expiring',
      subject: '📅 HomeLand - Hợp đồng sắp hết hạn',
      body: '📅 *Hợp đồng sắp hết hạn*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📅 Ngày hết hạn: {{contractEndDate}}\n⏳ Còn lại: {{daysRemaining}} ngày'
    },
    {
      code: 'ADMIN_ZALO_CONTRACT_RENEWAL_REQUESTED',
      name: 'Admin Zalo Contract Renewal Requested',
      subject: '✅ HomeLand - Khách yêu cầu gia hạn',
      body: '✅ *Khách yêu cầu gia hạn*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📅 Ngày hết hạn hiện tại: {{contractEndDate}}'
    },
    {
      code: 'ADMIN_ZALO_CONTRACT_RENEWAL_DECLINED',
      name: 'Admin Zalo Contract Renewal Declined',
      subject: '📦 HomeLand - Khách không gia hạn',
      body: '📦 *Khách không gia hạn*\n\n🏠 Phòng: {{roomCode}}\n👤 Khách: {{customerName}}\n📅 Ngày kết thúc hợp đồng: {{contractEndDate}}'
    },
    {
      code: 'ADMIN_ZALO_WEBHOOK_ERROR',
      name: 'Admin Zalo Webhook Error',
      subject: '❌ HomeLand - Lỗi webhook Zalo',
      body: '❌ *Lỗi webhook Zalo*\n\nTenant: {{tenantId}}\nEvent: {{eventName}}\nChat ID: {{chatId}}\nLỗi: {{errorMessage}}'
    },
    {
      code: 'ADMIN_ZALO_SEPAY_WEBHOOK_ERROR',
      name: 'Admin Zalo SePay Webhook Error',
      subject: '❌ HomeLand - Lỗi webhook SePay',
      body: '❌ *Lỗi webhook SePay*\n\nGateway: {{gateway}}\nTransaction ID: {{transactionId}}\nSố tiền: {{formatCurrency paidAmount "VND"}}\nLỗi: {{errorMessage}}'
    },
    {
      code: 'ADMIN_ZALO_SEND_FAILED',
      name: 'Admin Zalo Send Failed',
      subject: '❌ HomeLand - Lỗi gửi Zalo',
      body: '❌ *Lỗi gửi Zalo*\n\nĐối tượng: {{targetType}}\nNgười nhận/Chat ID: {{recipient}}\nTiêu đề: {{title}}\nLỗi: {{errorMessage}}'
    },
    {
      code: 'ZALO_GROUP_CHAT_ID_ECHO',
      name: 'Zalo Group Chat ID Echo',
      subject: '🆔 HomeLand - Chat ID',
      body: '🆔 *HomeLand - Chat ID*\n\nChat ID: {{chatId}}\nChat type: {{chatType}}'
    },
    {
      code: 'ZALO_ADMIN_SETUP_SUCCESS',
      name: 'Zalo Admin Setup Success',
      subject: 'HomeLand - Admin Bot Connected',
      body: '✅ *Bot Admin đã kết nối*\n\n#️⃣ Chat ID: `{{chatId}}`\n{{#if senderId}}👤 Sender: `{{senderId}}`\n{{/if}}{{#if domain}}🌐 Domain: {{domain}}\n{{/if}}🕒 {{connectedAt}}'
    },
    {
      code: 'ZALO_ADMIN_SETUP_INVALID',
      name: 'Zalo Admin Setup Invalid',
      subject: '⚠️ HomeLand - Kết nối nhóm Admin',
      body: '⚠️ *Mã kết nối không hợp lệ hoặc đã hết hạn.*'
    },
    {
      code: 'ADMIN_ZALO_UPDATE_AVAILABLE',
      name: 'Admin Zalo Update Available',
      subject: 'HomeLand - Update Available',
      body: '🆕 *Có phiên bản mới*\n\n• Hiện tại: `{{currentVersion}}`\n• Mới nhất: `{{latestVersion}}`\n🕒 {{checkedAt}}\n{{default note "Vui lòng kiểm tra mục cập nhật trước khi triển khai."}}'
    },
    {
      code: 'ADMIN_ZALO_SERVER_OVERLOAD',
      name: 'Admin Zalo Server Overload',
      subject: 'HomeLand - Server Alert',
      body: '🚨 *Cảnh báo tải cao / request bất thường*\n\n{{#if currentRps}}• RPS hiện tại: `{{currentRps}}`\n{{/if}}{{#if suspiciousIpCount}}• IP nghi vấn: `{{suspiciousIpCount}}`\n{{/if}}{{#if topSource}}• Nguồn nổi bật: `{{topSource}}`\n{{/if}}🕒 {{detectedAt}}\n{{default note "Kiểm tra rate limit, reverse proxy và access log ngay."}}'
    }
  ];

  for (const t of zaloBotTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { tenantId_code: { tenantId: org.id, code: t.code } },
      update: { name: t.name, subject: t.subject, body: t.body },
      create: { tenantId: org.id, ...t }
    });
  }

  // Set Default Preferences for Admin
  await prisma.notificationPreference.upsert({
    where: { tenantId_userId_type: { tenantId: org.id, userId: adminUser.id, type: 'DEPOSIT_COLLECTED' } },
    update: {},
    create: { tenantId: org.id, userId: adminUser.id, type: 'DEPOSIT_COLLECTED', channels: ['IN_APP', 'CONSOLE'] }
  });

  // 9. Document Templates
  console.log('Seeding Document Templates...');
  const docTemplates = [
    {
      code: 'CONTRACT_TEMPLATE',
      name: 'Mẫu Hợp Đồng Thuê Phòng',
      type: 'CONTRACT' as any,
      content: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="text-align: center;">HỢP ĐỒNG THUÊ PHÒNG</h1>
          <p><strong>Bên A (Bên cho thuê):</strong> HomeLand Premium</p>
          <p><strong>Bên B (Bên thuê):</strong> {{customerName}}</p>
          <p><strong>Phòng:</strong> {{roomCode}}</p>
          <p><strong>Giá thuê:</strong> {{formatCurrency monthlyRent "VND"}}/tháng</p>
          <p><strong>Tiền cọc:</strong> {{formatCurrency depositMoney "VND"}}</p>
          <p>Hợp đồng có giá trị từ ngày {{formatDate startDate}} đến ngày {{formatDate endDate}}.</p>
          <br/><br/>
          <table style="width: 100%;">
            <tr>
              <td style="text-align: center; width: 50%;"><strong>BÊN A</strong><br/>(Ký và ghi rõ họ tên)</td>
              <td style="text-align: center; width: 50%;"><strong>BÊN B</strong><br/>(Ký và ghi rõ họ tên)</td>
            </tr>
          </table>
        </div>
      `
    },
    {
      code: 'INVOICE_TEMPLATE',
      name: 'Mẫu Hóa Đơn',
      type: 'INVOICE' as any,
      content: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="text-align: center;">HÓA ĐƠN THANH TOÁN</h1>
          <p><strong>Mã hóa đơn:</strong> {{code}}</p>
          <p><strong>Khách hàng:</strong> {{customerName}}</p>
          <p><strong>Hạn thanh toán:</strong> {{formatDate dueDate}}</p>
          <hr/>
          <p><strong>Tổng tiền:</strong> {{formatCurrency total "VND"}}</p>
        </div>
      `
    },
    {
      code: 'RECEIPT_TEMPLATE',
      name: 'Mẫu Phiếu Thu',
      type: 'RECEIPT' as any,
      content: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h1 style="text-align: center;">PHIẾU THU</h1><p>Đã thu số tiền {{formatCurrency amount "VND"}} từ khách hàng {{customerName}}.</p></div>`
    },
    {
      code: 'DEPOSIT_AGREEMENT_TEMPLATE',
      name: 'Mẫu Thỏa Thuận Đặt Cọc',
      type: 'DEPOSIT' as any,
      content: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h1 style="text-align: center;">THỎA THUẬN ĐẶT CỌC</h1><p>Khách hàng {{customerName}} đã đặt cọc số tiền {{formatCurrency amount "VND"}} cho phòng {{roomCode}}.</p></div>`
    },
    {
      code: 'HANDOVER_TEMPLATE',
      name: 'Biên Bản Bàn Giao',
      type: 'HANDOVER' as any,
      content: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h1 style="text-align: center;">BIÊN BẢN BÀN GIAO</h1><p>Bàn giao phòng {{roomCode}} cho khách hàng {{customerName}}.</p></div>`
    }
  ];

  for (const dt of docTemplates) {
    await prisma.documentTemplate.upsert({
      where: { tenantId_code: { tenantId: org.id, code: dt.code } },
      update: {},
      create: { tenantId: org.id, ...dt }
    });
  }

  // Create Root Document Folders
  const rootFolders = ['Contracts', 'Invoices', 'Receipts', 'Signatures', 'Exports'];
  for (const f of rootFolders) {
    const exists = await prisma.documentFolder.findFirst({ where: { tenantId: org.id, name: f } });
    if (!exists) {
      await prisma.documentFolder.create({
        data: { tenantId: org.id, name: f }
      });
    }
  }

  console.log('Commercial Seed Completed Successfully.');
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
