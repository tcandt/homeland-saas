import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { DepositCoreService } from './deposit-core.service';
import { DepositOutboxPublisher } from './deposit-outbox.publisher';

const dbDescribe = process.env.RUN_DEPOSIT_CORE_DB_TESTS === '1' ? describe : describe.skip;

dbDescribe('DepositCoreService PostgreSQL concurrency', () => {
  const prisma = new PrismaClient();
  const service = new DepositCoreService({ tx: prisma } as any);
  const tenantId = 'tenant-core04-integration';
  const roomId = 'room-core04-integration';

  beforeAll(async () => {
    await prisma.tenantOrg.create({ data: { id: tenantId, name: 'CORE 04 Integration', code: 'CORE04-INTEGRATION' } });
    await prisma.building.create({ data: { id: 'building-core04-integration', tenantId, code: 'B-CORE04', name: 'Building CORE04' } });
    await prisma.floor.create({ data: { id: 'floor-core04-integration', tenantId, buildingId: 'building-core04-integration', level: 1, name: 'Tầng 1' } });
    await prisma.room.create({
      data: {
        id: roomId,
        tenantId,
        buildingId: 'building-core04-integration',
        floorId: 'floor-core04-integration',
        code: 'R-CORE04',
        name: 'Phòng CORE04',
        capacity: 1,
        monthlyPrice: 5_000_000,
        rentalType: 'WHOLE',
      },
    });
    for (const suffix of ['a', 'b']) {
      await prisma.customer.create({
        data: { id: `customer-core04-${suffix}`, tenantId, fullName: `Khách ${suffix}`, phone: `090000000${suffix === 'a' ? '1' : '2'}` },
      });
      await prisma.rentalCycle.create({
        data: { id: `cycle-core04-${suffix}`, tenantId, customerId: `customer-core04-${suffix}`, roomId, status: 'PLANNED' },
      });
      await prisma.deposit.create({
        data: {
          id: `deposit-core04-${suffix}`,
          tenantId,
          code: `DEP-CORE04-${suffix.toUpperCase()}`,
          type: 'BOOKING',
          roomId,
          customerId: `customer-core04-${suffix}`,
          rentalCycleId: `cycle-core04-${suffix}`,
          amount: 2_000_000,
          status: 'PENDING',
          expiredAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allows exactly one concurrent WHOLE-room collection/hold', async () => {
    const results = await Promise.allSettled([
      service.collect(tenantId, 'deposit-core04-a', { idempotencyKey: 'integration-collect-a' }, 'user-a'),
      service.collect(tenantId, 'deposit-core04-b', { idempotencyKey: 'integration-collect-b' }, 'user-b'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.roomHold.count({ where: { tenantId, roomId, status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.depositLedgerEntry.count({ where: { tenantId, type: 'CASH_IN' } })).toBe(1);
  }, 20_000);

  it('never exceeds SHARED-room capacity under concurrent collection', async () => {
    const sharedRoom = await prisma.room.create({
      data: {
        id: 'room-core04-shared',
        tenantId,
        buildingId: 'building-core04-integration',
        floorId: 'floor-core04-integration',
        code: 'R-CORE04-SHARED',
        name: 'Phòng ghép CORE04',
        capacity: 3,
        monthlyPrice: 2_000_000,
        rentalType: 'SHARED',
      },
    });
    const resident = await prisma.customer.create({
      data: { id: 'customer-core04-shared-resident', tenantId, fullName: 'Khách đang ở', phone: '0900000100' },
    });
    const residentCycle = await prisma.rentalCycle.create({
      data: { id: 'cycle-core04-shared-resident', tenantId, customerId: resident.id, roomId: sharedRoom.id, status: 'ACTIVE' },
    });
    await prisma.occupancy.create({
      data: {
        tenantId,
        roomId: sharedRoom.id,
        customerId: resident.id,
        rentalCycleId: residentCycle.id,
        role: 'REPRESENTATIVE',
      },
    });
    const depositIds: string[] = [];
    for (const suffix of ['1', '2', '3']) {
      const customer = await prisma.customer.create({
        data: { id: `customer-core04-shared-${suffix}`, tenantId, fullName: `Khách ghép ${suffix}`, phone: `090000010${suffix}` },
      });
      const cycle = await prisma.rentalCycle.create({
        data: { id: `cycle-core04-shared-${suffix}`, tenantId, customerId: customer.id, roomId: sharedRoom.id, status: 'PLANNED' },
      });
      const deposit = await prisma.deposit.create({
        data: {
          id: `deposit-core04-shared-${suffix}`,
          tenantId,
          code: `DEP-CORE04-SHARED-${suffix}`,
          type: 'BOOKING',
          roomId: sharedRoom.id,
          customerId: customer.id,
          rentalCycleId: cycle.id,
          amount: 1_000_000,
          status: 'PENDING',
          expiredAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      depositIds.push(deposit.id);
    }

    const results = await Promise.allSettled(depositIds.map((depositId, index) => service.collect(
      tenantId,
      depositId,
      { idempotencyKey: `integration-shared-collect-${index}` },
      `user-shared-${index}`,
    )));

    const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
    expect(
      results.filter((result) => result.status === 'fulfilled'),
      rejected.map((result) => ({ code: result.reason?.code, message: result.reason?.message })).map((value) => JSON.stringify(value)).join('\n'),
    ).toHaveLength(2);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.roomHold.count({ where: { tenantId, roomId: sharedRoom.id, status: 'ACTIVE' } })).toBe(2);

    const paidDeposits = await prisma.deposit.findMany({
      where: { tenantId, id: { in: depositIds }, status: 'PAID' },
      orderBy: { id: 'asc' },
    });
    await service.cancel(tenantId, paidDeposits[0].id, {
      idempotencyKey: 'integration-shared-cancel-one',
      reason: 'Khách ghép thứ nhất hủy',
      keepAmount: 1_000_000,
      refundAmount: 0,
      deductAmount: 0,
    }, 'user-shared-cancel');
    expect(await prisma.roomHold.count({ where: { tenantId, roomId: sharedRoom.id, status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.roomHold.count({
      where: { tenantId, depositId: paidDeposits[1].id, roomId: sharedRoom.id, status: 'ACTIVE' },
    })).toBe(1);
  }, 20_000);

  it('keeps the room hold active when booking deposit becomes security deposit', async () => {
    const room = await prisma.room.create({
      data: {
        id: 'room-core05-convert',
        tenantId,
        buildingId: 'building-core04-integration',
        floorId: 'floor-core04-integration',
        code: 'R-CORE05-CONVERT',
        name: 'Phòng chuyển cọc',
        capacity: 1,
        monthlyPrice: 4_000_000,
        rentalType: 'WHOLE',
      },
    });
    const customer = await prisma.customer.create({
      data: { id: 'customer-core05-convert', tenantId, fullName: 'Khách chuyển cọc', phone: '0900000188' },
    });
    const cycle = await prisma.rentalCycle.create({
      data: { id: 'cycle-core05-convert', tenantId, customerId: customer.id, roomId: room.id, status: 'PLANNED' },
    });
    const booking = await prisma.deposit.create({
      data: {
        id: 'deposit-core05-convert',
        tenantId,
        code: 'DEP-CORE05-CONVERT',
        type: 'BOOKING',
        roomId: room.id,
        customerId: customer.id,
        rentalCycleId: cycle.id,
        amount: 2_000_000,
        status: 'PENDING',
        expiredAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await service.collect(tenantId, booking.id, { idempotencyKey: 'integration-convert-collect' }, 'user-finance');
    const conversion = await service.convertToSecurity(tenantId, booking.id, {
      idempotencyKey: 'integration-convert-security',
      securityRequired: 2_000_000,
    }, 'user-finance');
    const hold = await prisma.roomHold.findFirst({ where: { tenantId, rentalCycleId: cycle.id, status: 'ACTIVE' } });

    expect(hold).toMatchObject({
      roomId: room.id,
      depositId: (conversion as any).securityDepositId,
      activeResourceKey: `${tenantId}:${room.id}:WHOLE`,
    });
    expect(await prisma.roomHold.count({ where: { tenantId, rentalCycleId: cycle.id, status: 'ACTIVE' } })).toBe(1);
  }, 20_000);

  it('preserves money for B<C and B>C credit/refund conversion branches', async () => {
    async function createPaidBooking(suffix: string, amount: number) {
      const room = await prisma.room.create({
        data: {
          id: `room-core05-matrix-${suffix}`, tenantId, buildingId: 'building-core04-integration',
          floorId: 'floor-core04-integration', code: `R-CORE05-MATRIX-${suffix}`,
          name: `Phòng ma trận ${suffix}`, capacity: 1, monthlyPrice: 4_000_000, rentalType: 'WHOLE',
        },
      });
      const customer = await prisma.customer.create({
        data: {
          id: `customer-core05-matrix-${suffix}`, tenantId, fullName: `Khách ma trận ${suffix}`,
          phone: `0900001${suffix === 'lt' ? '501' : suffix === 'credit' ? '502' : '503'}`,
        },
      });
      const cycle = await prisma.rentalCycle.create({
        data: {
          id: `cycle-core05-matrix-${suffix}`, tenantId, customerId: customer.id, roomId: room.id, status: 'PLANNED',
        },
      });
      const deposit = await prisma.deposit.create({
        data: {
          id: `deposit-core05-matrix-${suffix}`, tenantId, code: `DEP-CORE05-MATRIX-${suffix.toUpperCase()}`,
          type: 'BOOKING', roomId: room.id, customerId: customer.id, rentalCycleId: cycle.id,
          amount, status: 'PENDING', expiredAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await service.collect(tenantId, deposit.id, {
        idempotencyKey: `integration-matrix-${suffix}-collect`,
      }, 'user-finance');
      return { room, customer, cycle, deposit };
    }

    const less = await createPaidBooking('lt', 2_000_000);
    const lessResult = await service.convertToSecurity(tenantId, less.deposit.id, {
      idempotencyKey: 'integration-matrix-lt-convert', securityRequired: 5_000_000,
    }, 'user-finance');
    expect(lessResult).toMatchObject({ transferAmount: 2_000_000, additionalCashRequired: 3_000_000, excessAmount: 0 });
    expect(await service.getBalance(tenantId, less.deposit.id)).toBe(0);
    expect(await service.getBalance(tenantId, (lessResult as any).securityDepositId)).toBe(2_000_000);

    const credit = await createPaidBooking('credit', 7_000_000);
    const creditResult = await service.convertToSecurity(tenantId, credit.deposit.id, {
      idempotencyKey: 'integration-matrix-credit-convert', securityRequired: 5_000_000, excessAction: 'CREDIT',
    }, 'user-finance');
    expect(creditResult).toMatchObject({ transferAmount: 5_000_000, excessAmount: 2_000_000, excessAction: 'CREDIT' });
    expect((creditResult as any).creditNoteId).toBeTruthy();
    expect(await service.getBalance(tenantId, credit.deposit.id)).toBe(0);
    expect(await service.getBalance(tenantId, (creditResult as any).securityDepositId)).toBe(5_000_000);

    const refund = await createPaidBooking('refund', 7_000_000);
    const refundResult = await service.convertToSecurity(tenantId, refund.deposit.id, {
      idempotencyKey: 'integration-matrix-refund-convert', securityRequired: 5_000_000,
      excessAction: 'REFUND', refundStatus: 'COMPLETED',
    }, 'user-finance');
    expect(refundResult).toMatchObject({
      transferAmount: 5_000_000, excessAmount: 2_000_000, excessAction: 'REFUND', refundStatus: 'COMPLETED', pending: false,
    });
    expect(await service.getBalance(tenantId, refund.deposit.id)).toBe(0);
    expect(await service.getBalance(tenantId, (refundResult as any).securityDepositId)).toBe(5_000_000);
    expect(await prisma.deposit.findUniqueOrThrow({ where: { id: refund.deposit.id }, select: { amount: true } }))
      .toMatchObject({ amount: refund.deposit.amount });
  }, 20_000);

  it('renews, transfers and releases exactly one hold without changing its money balance', async () => {
    const [sourceRoom, targetRoom] = await Promise.all([
      prisma.room.create({
        data: {
          id: 'room-core04-move-source', tenantId, buildingId: 'building-core04-integration',
          floorId: 'floor-core04-integration', code: 'R-CORE04-MOVE-S', name: 'Phòng nguồn',
          capacity: 1, monthlyPrice: 3_000_000, rentalType: 'WHOLE',
        },
      }),
      prisma.room.create({
        data: {
          id: 'room-core04-move-target', tenantId, buildingId: 'building-core04-integration',
          floorId: 'floor-core04-integration', code: 'R-CORE04-MOVE-T', name: 'Phòng đích',
          capacity: 2, monthlyPrice: 2_000_000, rentalType: 'SHARED',
        },
      }),
    ]);
    const customer = await prisma.customer.create({
      data: { id: 'customer-core04-move', tenantId, fullName: 'Khách chuyển phòng', phone: '0900000177' },
    });
    const cycle = await prisma.rentalCycle.create({
      data: { id: 'cycle-core04-move', tenantId, customerId: customer.id, roomId: sourceRoom.id, status: 'PLANNED' },
    });
    const deposit = await prisma.deposit.create({
      data: {
        id: 'deposit-core04-move', tenantId, code: 'DEP-CORE04-MOVE', type: 'BOOKING',
        roomId: sourceRoom.id, customerId: customer.id, rentalCycleId: cycle.id,
        amount: 1_000_000, status: 'PENDING', expiredAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await service.collect(tenantId, deposit.id, { idempotencyKey: 'integration-move-collect' }, 'user-sales');
    const renewedExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await service.renewHold(tenantId, deposit.id, {
      idempotencyKey: 'integration-move-renew', expiresAt: renewedExpiry,
    }, 'user-sales');
    await service.transferHold(tenantId, deposit.id, {
      idempotencyKey: 'integration-move-transfer', targetRoomId: targetRoom.id,
    }, 'user-sales');

    expect(await prisma.roomHold.count({ where: { tenantId, roomId: sourceRoom.id, status: 'ACTIVE' } })).toBe(0);
    expect(await prisma.roomHold.count({ where: { tenantId, roomId: targetRoom.id, status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.deposit.findUnique({ where: { id: deposit.id }, select: { roomId: true } })).toEqual({ roomId: targetRoom.id });
    expect(await prisma.rentalCycle.findUnique({ where: { id: cycle.id }, select: { roomId: true } })).toEqual({ roomId: targetRoom.id });
    expect(await service.getBalance(tenantId, deposit.id)).toBe(1_000_000);

    await service.releaseHold(tenantId, deposit.id, {
      idempotencyKey: 'integration-move-release', reason: 'Bàn giao sang bước tiếp theo',
    }, 'user-sales');
    expect(await prisma.roomHold.count({ where: { tenantId, rentalCycleId: cycle.id, status: 'ACTIVE' } })).toBe(0);
    expect(await service.getBalance(tenantId, deposit.id)).toBe(1_000_000);

    const summary = await service.getRentalCycleFinanceSummary(tenantId, cycle.id);
    expect(summary).toMatchObject({
      rentalCycleId: cycle.id,
      customer: { id: customer.id },
      room: { id: targetRoom.id },
      depositLedger: { balance: 1_000_000 },
    });
  }, 20_000);

  it('reverses an immutable ledger entry once and keeps the original row unchanged', async () => {
    const cashIn = await prisma.depositLedgerEntry.findFirstOrThrow({
      where: { tenantId, depositId: 'deposit-core04-move', type: 'CASH_IN' },
    });
    const before = { amount: cashIn.amount.toFixed(2), balanceEffect: cashIn.balanceEffect.toFixed(2) };
    await service.reverseLedgerEntry(tenantId, cashIn.id, {
      idempotencyKey: 'integration-reverse-cash-in', reason: 'Kiểm thử bút toán đảo',
    }, 'user-finance');

    expect(await service.getBalance(tenantId, cashIn.depositId)).toBe(0);
    expect(await prisma.depositLedgerEntry.count({ where: { tenantId, reversalOfId: cashIn.id } })).toBe(1);
    const original = await prisma.depositLedgerEntry.findUniqueOrThrow({ where: { id: cashIn.id } });
    expect({ amount: original.amount.toFixed(2), balanceEffect: original.balanceEffect.toFixed(2) }).toEqual(before);
    await expect(service.reverseLedgerEntry(tenantId, cashIn.id, {
      idempotencyKey: 'integration-reverse-cash-in-again', reason: 'Không được đảo lần hai',
    }, 'user-finance')).rejects.toThrow('DEPOSIT_LEDGER_ENTRY_ALREADY_REVERSED');
  }, 20_000);

  it('rolls back hold, operation and status when a ledger write fails, and rejects cross-tenant access', async () => {
    const room = await prisma.room.create({
      data: {
        id: 'room-core05-rollback', tenantId, buildingId: 'building-core04-integration',
        floorId: 'floor-core04-integration', code: 'R-CORE05-ROLLBACK', name: 'Phòng rollback',
        capacity: 1, monthlyPrice: 3_000_000, rentalType: 'WHOLE',
      },
    });
    const seedCustomer = await prisma.customer.create({
      data: { id: 'customer-core05-rollback-seed', tenantId, fullName: 'Khách seed', phone: '0900000160' },
    });
    const seedCycle = await prisma.rentalCycle.create({
      data: { id: 'cycle-core05-rollback-seed', tenantId, customerId: seedCustomer.id, roomId: room.id, status: 'RESERVED' },
    });
    const seedDeposit = await prisma.deposit.create({
      data: {
        id: 'deposit-core05-rollback-seed', tenantId, code: 'DEP-CORE05-ROLLBACK-SEED', type: 'SECURITY',
        roomId: room.id, customerId: seedCustomer.id, rentalCycleId: seedCycle.id, amount: 1, status: 'PAID',
      },
    });
    const seedOperation = await prisma.depositOperation.create({
      data: {
        tenantId, rentalCycleId: seedCycle.id, sourceDepositId: seedDeposit.id, type: 'COLLECT', status: 'COMPLETED',
        idempotencyKey: 'integration-rollback-seed', requestHash: 'seed', result: { seed: true }, completedAt: new Date(),
      },
    });
    await prisma.depositLedgerEntry.create({
      data: {
        tenantId, rentalCycleId: seedCycle.id, depositId: seedDeposit.id, operationId: seedOperation.id,
        type: 'CASH_IN', amount: 1, balanceEffect: 1,
        idempotencyKey: 'integration-rollback-collect:cash-in', sourceType: 'TEST_SEED', sourceId: seedDeposit.id,
      },
    });
    const customer = await prisma.customer.create({
      data: { id: 'customer-core05-rollback', tenantId, fullName: 'Khách rollback', phone: '0900000161' },
    });
    const cycle = await prisma.rentalCycle.create({
      data: { id: 'cycle-core05-rollback', tenantId, customerId: customer.id, roomId: room.id, status: 'PLANNED' },
    });
    const deposit = await prisma.deposit.create({
      data: {
        id: 'deposit-core05-rollback', tenantId, code: 'DEP-CORE05-ROLLBACK', type: 'BOOKING',
        roomId: room.id, customerId: customer.id, rentalCycleId: cycle.id, amount: 1_000_000,
        status: 'PENDING', expiredAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await expect(service.collect(tenantId, deposit.id, {
      idempotencyKey: 'integration-rollback-collect',
    }, 'user-finance')).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.depositOperation.count({ where: { tenantId, idempotencyKey: 'integration-rollback-collect' } })).toBe(0);
    expect(await prisma.roomHold.count({ where: { tenantId, depositId: deposit.id } })).toBe(0);
    expect(await prisma.deposit.findUnique({ where: { id: deposit.id }, select: { status: true } })).toEqual({ status: 'PENDING' });

    await expect(service.collect('tenant-core05-other', deposit.id, {
      idempotencyKey: 'integration-cross-tenant',
    }, 'other-user')).rejects.toThrow('DEPOSIT_NOT_FOUND');
    expect(await prisma.depositOperation.count({ where: { tenantId: 'tenant-core05-other' } })).toBe(0);
  }, 20_000);

  it('rejects update and delete of an existing deposit ledger entry', async () => {
    const entry = await prisma.depositLedgerEntry.findFirstOrThrow({ where: { tenantId, type: 'CASH_IN' } });
    await expect(prisma.depositLedgerEntry.update({
      where: { id: entry.id },
      data: { metadata: { forbiddenMutation: true } },
    })).rejects.toBeTruthy();
    await expect(prisma.depositLedgerEntry.delete({ where: { id: entry.id } })).rejects.toBeTruthy();
    expect(await prisma.depositLedgerEntry.findUnique({ where: { id: entry.id } })).toMatchObject({ id: entry.id });
  }, 20_000);

  it('replays concurrent requests with the same idempotency key and writes one cash-in', async () => {
    const customer = await prisma.customer.create({
      data: { id: 'customer-core05-idempotent', tenantId, fullName: 'Khách retry', phone: '0900000199' },
    });
    const cycle = await prisma.rentalCycle.create({
      data: { id: 'cycle-core05-idempotent', tenantId, customerId: customer.id, roomId, status: 'PLANNED' },
    });
    const deposit = await prisma.deposit.create({
      data: {
        id: 'deposit-core05-idempotent',
        tenantId,
        code: 'DEP-CORE05-IDEMPOTENT',
        type: 'SECURITY',
        roomId,
        customerId: customer.id,
        rentalCycleId: cycle.id,
        amount: 1_500_000,
        status: 'PENDING',
      },
    });

    const results = await Promise.allSettled([
      service.collect(tenantId, deposit.id, { idempotencyKey: 'integration-same-key-collect' }, 'user-finance'),
      service.collect(tenantId, deposit.id, { idempotencyKey: 'integration-same-key-collect' }, 'user-finance'),
    ]);

    const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected.map((result) => ({
      code: result.reason?.code,
      message: result.reason?.message,
      meta: result.reason?.meta,
      response: result.reason?.response,
    }))).toEqual([]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(await prisma.depositLedgerEntry.count({ where: { tenantId, depositId: deposit.id, type: 'CASH_IN' } })).toBe(1);
    const collectOperation = await prisma.depositOperation.findUniqueOrThrow({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: 'integration-same-key-collect' } },
      select: { id: true },
    });
    expect(await prisma.outboxEvent.count({
      where: {
        tenantId,
        aggregateType: 'DepositOperation',
        aggregateId: collectOperation.id,
        eventName: 'deposit.collected',
        idempotencyKey: `deposit-operation:${collectOperation.id}:deposit.collected`,
      },
    })).toBe(1);
    expect(results.some((result) => result.status === 'fulfilled' && (result.value as any).replayed === true)).toBe(true);
  }, 20_000);

  it('allows exactly one concurrent completion of a pending refund', async () => {
    const customer = await prisma.customer.create({
      data: { id: 'customer-core05-refund', tenantId, fullName: 'Khách hoàn cọc', phone: '0900000099' },
    });
    const cycle = await prisma.rentalCycle.create({
      data: { id: 'cycle-core05-refund', tenantId, customerId: customer.id, roomId, status: 'RESERVED' },
    });
    const deposit = await prisma.deposit.create({
      data: {
        id: 'deposit-core05-refund',
        tenantId,
        code: 'DEP-CORE05-REFUND',
        type: 'SECURITY',
        roomId,
        customerId: customer.id,
        rentalCycleId: cycle.id,
        amount: 5_000_000,
        status: 'PAID',
      },
    });
    const opening = await prisma.depositOperation.create({
      data: {
        id: 'operation-core05-opening',
        tenantId,
        rentalCycleId: cycle.id,
        sourceDepositId: deposit.id,
        type: 'COLLECT',
        status: 'COMPLETED',
        idempotencyKey: 'integration-opening-balance',
        requestHash: 'reviewed-opening-balance',
        result: { reviewed: true },
        completedAt: new Date(),
      },
    });
    await prisma.depositLedgerEntry.create({
      data: {
        tenantId,
        rentalCycleId: cycle.id,
        depositId: deposit.id,
        operationId: opening.id,
        type: 'CASH_IN',
        amount: 5_000_000,
        balanceEffect: 5_000_000,
        idempotencyKey: 'integration-opening-balance:cash-in',
        sourceType: 'REVIEWED_OPENING_BALANCE',
        sourceId: deposit.id,
      },
    });

    const cancellation = await service.cancel(tenantId, deposit.id, {
      idempotencyKey: 'integration-cancel-refund',
      reason: 'Integration pending refund',
      refundAmount: 5_000_000,
      keepAmount: 0,
      deductAmount: 0,
      refundStatus: 'PENDING',
    }, 'user-finance');

    const results = await Promise.allSettled([
      service.completePendingRefund(tenantId, (cancellation as any).operationId, 'integration-complete-refund-a', 'user-finance'),
      service.completePendingRefund(tenantId, (cancellation as any).operationId, 'integration-complete-refund-b', 'user-finance'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.depositLedgerEntry.count({ where: { tenantId, depositId: deposit.id, type: 'REFUND' } })).toBe(1);
    expect(await service.getBalance(tenantId, deposit.id)).toBe(0);
  }, 20_000);

  it('claims and publishes a committed outbox event through the real PostgreSQL query', async () => {
    const pending = await prisma.outboxEvent.findFirstOrThrow({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    const publishAsync = vi.fn().mockResolvedValue(undefined);
    const dispatcher = new DepositOutboxPublisher(prisma as any, { publishAsync } as any);

    await expect(dispatcher.drain(1)).resolves.toEqual({ claimed: 1, published: 1, failed: 0 });

    expect(publishAsync).toHaveBeenCalledWith(pending.eventName, expect.objectContaining({
      outboxEventId: pending.id,
      tenantId,
    }));
    expect(await prisma.outboxEvent.findUnique({
      where: { id: pending.id },
      select: { status: true, publishedAt: true, attempts: true },
    })).toEqual({ status: 'PUBLISHED', publishedAt: expect.any(Date), attempts: 1 });
  }, 20_000);
});
