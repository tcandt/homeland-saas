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
  const passwordHash = await bcrypt.hash('Homeland@123456', 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: org.id, email: 'admin@homeland.local' } },
    update: {},
    create: { tenantId: org.id, email: 'admin@homeland.local', fullName: 'System Admin', passwordHash },
  });

  const ownerAUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: org.id, email: 'adminA@homeland.local' } },
    update: { fullName: 'Owner Admin - Tính' },
    create: { tenantId: org.id, email: 'adminA@homeland.local', fullName: 'Owner Admin - Tính', passwordHash },
  });

  const ownerBUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: org.id, email: 'adminB@homeland.local' } },
    update: { fullName: 'Owner Admin - Thể' },
    create: { tenantId: org.id, email: 'adminB@homeland.local', fullName: 'Owner Admin - Thể', passwordHash },
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
      { userId: ownerAUser.id, roleId: adminRole.id },
      { userId: ownerBUser.id, roleId: adminRole.id },
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
    update: { name: 'Tính', isActive: true, notes: 'Owner account: adminA@homeland.local. Buildings: LK01-31, LK08-25.' },
    create: { tenantId: org.id, code: 'OWNER-A', name: 'Tính', notes: 'Owner account: adminA@homeland.local. Buildings: LK01-31, LK08-25.' },
  });

  const ownerB = await prisma.owner.upsert({
    where: { tenantId_code: { tenantId: org.id, code: 'OWNER-B' } },
    update: { name: 'Thể', isActive: true, notes: 'Owner account: adminB@homeland.local. Buildings: LK01-32, LK08-24.' },
    create: { tenantId: org.id, code: 'OWNER-B', name: 'Thể', notes: 'Owner account: adminB@homeland.local. Buildings: LK01-32, LK08-24.' },
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

  for (const bCode of MANAGED_BUILDINGS) {
    const building = await prisma.building.findUnique({ where: { tenantId_code: { tenantId: org.id, code: bCode } } });
    if (!building) continue;
    await prisma.costCenter.upsert({
      where: { tenantId_code: { tenantId: org.id, code: `CC-${bCode}` } },
      update: { ownerId: ownerByBuildingCode[bCode], buildingId: building.id },
      create: { tenantId: org.id, ownerId: ownerByBuildingCode[bCode], buildingId: building.id, code: `CC-${bCode}`, name: `Chi nhánh ${bCode}` },
    });
  }

  if (process.env.SEED_MODE === 'production' || process.env.NODE_ENV === 'production') {
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
      subject: 'Xác nhận thu cọc thành công - {{tenantId}}',
      body: 'Xin chào,\n\nChúng tôi đã thu thành công khoản cọc {{formatCurrency amount "VND"}} cho giao dịch {{code}} vào lúc {{formatDateTime createdAt}}.\n\nTrân trọng,'
    },
    {
      code: 'INVOICE_OVERDUE',
      name: 'Invoice Overdue Notification',
      subject: 'Nhắc nhở: Hóa đơn {{code}} đã quá hạn',
      body: 'Xin chào,\n\nHóa đơn {{code}} với số tiền {{formatCurrency total "VND"}} đã quá hạn thanh toán {{daysDiff dueDate "now"}} ngày.\n\nVui lòng thanh toán sớm.\n\nTrân trọng,'
    },
    {
      code: 'SYSTEM_ALERT',
      name: 'System Alert',
      subject: 'Thông báo hệ thống: {{title}}',
      body: '{{message}}'
    }
  ];

  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { tenantId_code: { tenantId: org.id, code: t.code } },
      update: {},
      create: { tenantId: org.id, ...t }
    });
  }

  const paymentTemplates = [
    {
      code: 'INVOICE_ZALO_PAYMENT_REQUEST',
      name: 'Invoice Payment Request Zalo',
      subject: 'Hóa đơn {{invoiceCode}} - Thanh toán qua SePay',
      body: 'Xin chào {{customerName}},\n\nHóa đơn {{invoiceCode}} số tiền {{formatCurrency amount "VND"}} đã sẵn sàng thanh toán.\nNội dung chuyển khoản: {{paymentCode}}\n\nQuét QR trong tin nhắn để thanh toán nhanh: {{qrUrl}}\n\nTrân trọng,'
    },
    {
      code: 'DEPOSIT_ZALO_PAYMENT_REQUEST',
      name: 'Deposit Payment Request Zalo',
      subject: 'Phiếu cọc {{depositCode}} - Thanh toán qua SePay',
      body: 'Xin chào {{customerName}},\n\nPhiếu cọc {{depositCode}} số tiền {{formatCurrency amount "VND"}} đã sẵn sàng thanh toán.\nNội dung chuyển khoản: {{paymentCode}}\n\nQuét QR trong tin nhắn để thanh toán nhanh: {{qrUrl}}\n\nTrân trọng,'
    },
    {
      code: 'INVOICE_ZALO_PAYMENT_CONFIRMATION',
      name: 'Invoice Payment Confirmation Zalo',
      subject: 'Đã nhận thanh toán hóa đơn {{invoiceCode}}',
      body: 'Xin chào {{customerName}},\n\nHệ thống đã nhận thanh toán thành công cho hóa đơn {{invoiceCode}} với số tiền {{formatCurrency amount "VND"}}.\n\nTrân trọng,'
    },
    {
      code: 'DEPOSIT_ZALO_PAYMENT_CONFIRMATION',
      name: 'Deposit Payment Confirmation Zalo',
      subject: 'Đã nhận thanh toán phiếu cọc {{depositCode}}',
      body: 'Xin chào {{customerName}},\n\nHệ thống đã nhận thanh toán thành công cho phiếu cọc {{depositCode}} với số tiền {{formatCurrency amount "VND"}}.\n\nTrân trọng,'
    }
  ];

  for (const t of paymentTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { tenantId_code: { tenantId: org.id, code: t.code } },
      update: {},
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
