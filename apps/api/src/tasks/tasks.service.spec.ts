import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { TasksService } from './tasks.service';

const task = {
  id: 'task-1',
  title: 'Kiểm tra thiết bị',
  description: null,
  status: TaskStatus.TODO,
  priority: 'HIGH',
  assigneeId: null,
  dueDate: null,
  createdAt: new Date('2026-09-23T00:00:00.000Z'),
  updatedAt: new Date('2026-09-23T00:00:00.000Z'),
};

function createPrisma() {
  return {
    task: {
      findMany: vi.fn().mockResolvedValue([task]),
      findFirst: vi.fn().mockResolvedValue(task),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      groupBy: vi.fn().mockResolvedValue([{ status: TaskStatus.TODO, _count: { _all: 2 } }]),
      count: vi.fn().mockResolvedValue(1),
    },
  } as any;
}

describe('TasksService', () => {
  it('lists only non-deleted tasks in the caller tenant', async () => {
    const prisma = createPrisma();
    await new TasksService(prisma).list('tenant-a');

    expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a', deletedAt: null },
    }));
  });

  it('does not expose another tenant or a soft-deleted task in detail queries', async () => {
    const prisma = createPrisma();
    await new TasksService(prisma).getDetail('task-1', 'tenant-a');

    expect(prisma.task.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'task-1', tenantId: 'tenant-a', deletedAt: null },
    }));
  });

  it('returns a tenant-scoped status summary and excludes terminal tasks from overdue', async () => {
    const prisma = createPrisma();
    const summary = await new TasksService(prisma).getSummary('tenant-a');

    expect(summary).toMatchObject({ total: 2, todo: 2, overdue: 1, done: 0 });
    expect(prisma.task.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a', deletedAt: null },
    }));
    expect(prisma.task.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-a',
        deletedAt: null,
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      }),
    }));
  });

  it('allows a valid status transition with an explicit tenant scope', async () => {
    const prisma = createPrisma();
    const service = new TasksService(prisma);
    await service.updateStatus('task-1', TaskStatus.IN_PROGRESS, 'tenant-a');

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', tenantId: 'tenant-a', deletedAt: null, status: TaskStatus.TODO },
      data: { status: TaskStatus.IN_PROGRESS },
    });
  });

  it('rejects a stale transition instead of overwriting a concurrent status update', async () => {
    const prisma = createPrisma();
    prisma.task.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      new TasksService(prisma).updateStatus('task-1', TaskStatus.IN_PROGRESS, 'tenant-a'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-1', tenantId: 'tenant-a', deletedAt: null, status: TaskStatus.TODO },
      data: { status: TaskStatus.IN_PROGRESS },
    });
  });

  it('rejects unsupported status transitions before updating', async () => {
    const prisma = createPrisma();
    const service = new TasksService(prisma);

    await expect(service.updateStatus('task-1', TaskStatus.DONE, 'tenant-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('treats an inaccessible task as not found', async () => {
    const prisma = createPrisma();
    prisma.task.findFirst.mockResolvedValue(null);

    await expect(new TasksService(prisma).getDetail('task-1', 'tenant-b')).rejects.toBeInstanceOf(NotFoundException);
  });
});
