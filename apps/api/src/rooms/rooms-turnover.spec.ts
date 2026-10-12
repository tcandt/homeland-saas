import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RoomsService } from './rooms.service';

function setup(status = 'CLEANING') {
  const before = { id: 'room-1', tenantId: 'tenant-1', status };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: before.id }]),
    room: {
      findFirst: vi.fn().mockResolvedValue(before),
      update: vi.fn().mockResolvedValue({ ...before, status: 'AVAILABLE' }),
    },
    occupancy: { count: vi.fn().mockResolvedValue(0) },
    contract: { count: vi.fn().mockResolvedValue(0) },
    roomHold: { count: vi.fn().mockResolvedValue(0) },
    customer: { count: vi.fn().mockResolvedValue(0) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = { $transaction: vi.fn().mockImplementation((callback) => callback(tx)) };
  const service = new RoomsService({} as any, {} as any, prisma as any);
  const complete = () => service.update(before.id, { status: 'AVAILABLE' }, 'user-1', 'Rooms', before.tenantId);
  return { before, tx, prisma, service, complete };
}

describe('Room turnover transaction', () => {
  it.each(['CLEANING', 'MAINTENANCE', 'AVAILABLE'])('allows unbound %s rooms with atomic audit', async (status) => {
    const { complete, tx, prisma } = setup(status);
    await expect(complete()).resolves.toMatchObject({ status: 'AVAILABLE' });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(tx.$queryRaw.mock.calls[0][0].values).toEqual(['room-1', 'tenant-1']);
    expect(tx.room.update).toHaveBeenCalledWith({ where: { id: 'room-1', tenantId: 'tenant-1' }, data: { status: 'AVAILABLE' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tenantId: 'tenant-1', userId: 'user-1', before: expect.objectContaining({ status }),
      after: expect.objectContaining({ status: 'AVAILABLE' }),
    }) });
  });

  it('rejects missing tenant before accessing the database', async () => {
    const { service, prisma } = setup();
    await expect(service.update('room-1', { status: 'AVAILABLE' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['foreign', 'deleted'])('rejects %s room at the scoped lock', async () => {
    const { tx, complete } = setup();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(complete()).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.room.update).not.toHaveBeenCalled();
  });

  it.each(['OCCUPIED', 'RESERVED'])('rejects %s room status', async (status) => {
    const { complete, tx } = setup(status);
    await expect(complete()).rejects.toThrow('ROOM_TURNOVER_INVALID_STATUS');
    expect(tx.room.update).not.toHaveBeenCalled();
  });

  it.each(['occupancy', 'contract', 'roomHold', 'customer'] as const)('rejects live %s bindings', async (binding) => {
    const { tx, complete } = setup();
    tx[binding].count.mockResolvedValue(1);
    await expect(complete()).rejects.toThrow('ROOM_TURNOVER_ROOM_IN_USE');
    expect(tx[binding].count).toHaveBeenCalledWith({ where: expect.objectContaining({ tenantId: 'tenant-1', roomId: 'room-1' }) });
    expect(tx.room.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('propagates audit failure inside the transaction', async () => {
    const { tx, complete } = setup();
    tx.auditLog.create.mockRejectedValue(new Error('audit unavailable'));
    await expect(complete()).rejects.toThrow('audit unavailable');
  });

  it('rechecks bindings after serialization retry', async () => {
    const { tx, prisma, complete } = setup();
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    tx.roomHold.count.mockResolvedValue(1);
    await expect(complete()).rejects.toThrow('ROOM_TURNOVER_ROOM_IN_USE');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.room.update).not.toHaveBeenCalled();
  });

  it.each([{ code: 'P2034' }, { code: 'P2010', meta: { code: '40001' } }, { code: 'P2010', meta: { code: '40P01' } }])('bounds retry for database conflicts %j', async (error) => {
    const { prisma, complete } = setup();
    prisma.$transaction.mockRejectedValue(error);
    await expect(complete()).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});
