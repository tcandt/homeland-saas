import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  assigneeId: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  IN_PROGRESS: [TaskStatus.TODO, TaskStatus.REVIEW, TaskStatus.CANCELLED],
  REVIEW: [TaskStatus.IN_PROGRESS, TaskStatus.DONE, TaskStatus.CANCELLED],
  DONE: [TaskStatus.REVIEW],
  CANCELLED: [TaskStatus.TODO],
};

function parseTaskStatus(value: unknown): TaskStatus {
  if (typeof value !== 'string' || !Object.values(TaskStatus).includes(value as TaskStatus)) {
    throw new BadRequestException('TASK_STATUS_INVALID');
  }
  return value as TaskStatus;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.task.findMany({
      where: { tenantId, deletedAt: null },
      select: TASK_SELECT,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getSummary(tenantId: string) {
    const now = new Date();
    const [byStatus, overdue] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.task.count({
        where: {
          tenantId,
          deletedAt: null,
          dueDate: { lt: now },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        },
      }),
    ]);

    const counts = Object.values(TaskStatus).reduce(
      (result, status) => ({ ...result, [status]: 0 }),
      {} as Record<TaskStatus, number>,
    );
    for (const row of byStatus) counts[row.status] = row._count._all;

    return {
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      todo: counts[TaskStatus.TODO],
      inProgress: counts[TaskStatus.IN_PROGRESS],
      review: counts[TaskStatus.REVIEW],
      done: counts[TaskStatus.DONE],
      cancelled: counts[TaskStatus.CANCELLED],
      overdue,
    };
  }

  async getDetail(id: string, tenantId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: TASK_SELECT,
    });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');
    return task;
  }

  async updateStatus(id: string, requestedStatus: unknown, tenantId: string) {
    const nextStatus = parseTaskStatus(requestedStatus);
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: TASK_SELECT,
    });
    if (!task) throw new NotFoundException('TASK_NOT_FOUND');
    if (task.status === nextStatus) return task;
    if (!ALLOWED_TRANSITIONS[task.status].includes(nextStatus)) {
      throw new BadRequestException('TASK_STATUS_TRANSITION_INVALID');
    }

    const updated = await this.prisma.task.updateMany({
      // Keep the transition compare-and-set: a second actor must not overwrite
      // a status that changed after the transition was validated above.
      where: { id, tenantId, deletedAt: null, status: task.status },
      data: { status: nextStatus },
    });
    if (updated.count !== 1) {
      throw new ConflictException('TASK_STATUS_CONCURRENT_UPDATE');
    }

    return this.getDetail(id, tenantId);
  }
}
