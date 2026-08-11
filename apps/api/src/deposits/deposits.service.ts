import { Injectable, BadRequestException } from '@nestjs/common';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { Deposit, DepositStatus, ReceiptStatus } from '@prisma/client';
import { DepositsRepository } from './deposits.repository';
import { AuditService } from '../shared/audit/audit.service';
import { PaginatedResult } from '@homeland/shared';
import { DomainEventPublisher } from '../shared/events/domain-event.publisher';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DepositsService extends BaseCrudService<Deposit> {
  constructor(
    repository: DepositsRepository,
    auditService: AuditService,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly prisma: PrismaService,
  ) {
    super(repository, auditService, 'Deposit');
  }

  async create(data: any, userId?: string, moduleName?: string) {
    const record = await super.create(data, userId, moduleName);
    const deposit = await this.getDetail((record as any).id);

    this.eventPublisher.publish('deposit.created', {
      tenantId: deposit.tenantId,
      userId,
      customerId: deposit.customerId,
      customerName: deposit.customer?.fullName,
      customerPhone: deposit.customer?.phone,
      metadata: {
        code: deposit.code,
        roomCode: deposit.room?.code,
        buildingName: deposit.room?.building?.name,
        title: `Tạo phiếu đặt cọc ${deposit.code}`,
        message: `Phiếu đặt cọc ${deposit.code} đã được tạo cho phòng ${deposit.room?.code || 'chưa gắn phòng'}.`,
      },
      sourceId: deposit.id,
      sourceType: 'DEPOSIT',
      amount: Number(deposit.amount || 0),
      occurredAt: new Date(),
    });

    return record;
  }

  async listDeposits(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    type?: string,
    sort?: string,
    order?: string
  ): Promise<PaginatedResult<Deposit>> {
    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customer: { fullName: { contains: search, mode: 'insensitive' } } },
        { room: { code: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) where.status = status;
    if (type) where.type = type;

    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      customer: { select: { id: true, fullName: true, phone: true } },
      room: { 
        select: { id: true, code: true, name: true, building: { select: { id: true, name: true } } } 
      }
    });
  }

  async getDetail(id: string, include?: any): Promise<any> {
    const deposit = await this.repository.findById(id, {
      customer: true,
      room: { include: { building: true, floor: true } },
      contract: true,
      ...include,
    });
    if (!deposit) {
      return null;
    }
    return {
      ...deposit,
      refundSummary: await this.getRefundSummary(deposit),
    };
  }

  async collect(id: string, note: string | null, userId: string) {
    const deposit = await this.getDetail(id);
    if (!deposit) throw new BadRequestException('Deposit not found');
    if (deposit.status !== DepositStatus.DRAFT && deposit.status !== DepositStatus.PENDING) {
      throw new BadRequestException('Can only collect DRAFT or PENDING deposits');
    }

    const updateData = { status: DepositStatus.PAID, note: note || deposit.note };
    const updated = await this.repository.update(id, updateData);
    
    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Deposit',
      entityId: id,
      action: 'COLLECT',
      before: deposit,
      after: updated,
    });

    // Emit Domain Event
    this.eventPublisher.publish('deposit.collected', {
      tenantId: deposit.tenantId,
      userId,
      customerId: deposit.customerId,
      customerName: deposit.customer?.fullName,
      customerPhone: deposit.customer?.phone,
      metadata: { code: deposit.code },
      sourceId: deposit.id,
      sourceType: 'DEPOSIT',
      amount: Number(deposit.amount),
      paymentProvider: 'MANUAL',
      occurredAt: new Date(),
    });

    return updated;
  }

  async refund(id: string, reason: string, userId: string, receiptStatus?: 'PENDING' | 'COMPLETED', attachmentUrls?: string[]) {
    const deposit = await this.getDetail(id);
    if (!deposit) throw new BadRequestException('Deposit not found');
    if (deposit.status !== DepositStatus.PAID) {
      throw new BadRequestException('Can only refund PAID deposits');
    }

    const normalizedReason = String(reason || '').trim();
    const receiptMode = receiptStatus === 'PENDING' ? ReceiptStatus.PENDING : ReceiptStatus.COMPLETED;
    const proofUrls = Array.isArray(attachmentUrls) ? attachmentUrls.filter(Boolean) : [];
    const refundNote = [normalizedReason, proofUrls.length > 0 ? `Chung tu: ${proofUrls.join(', ')}` : null].filter(Boolean).join('\n');
    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedDeposit = await tx.deposit.update({
        where: { id },
        data: {
          status: DepositStatus.REFUNDED,
          note: refundNote || normalizedReason,
        },
      });

      const receipt = await tx.receipt.create({
        data: {
          tenantId: deposit.tenantId,
          code: this.buildRefundReceiptCode(deposit.code),
          amount: Number(deposit.amount || 0),
          status: receiptMode,
          description: normalizedReason
            ? `Deposit refund for ${deposit.code} - ${normalizedReason}`
            : `Deposit refund for ${deposit.code}`,
          date: new Date(),
        },
      });

      const task =
        receiptMode === ReceiptStatus.PENDING
          ? await tx.task.create({
              data: {
                tenantId: deposit.tenantId,
                title: `Xu ly hoan coc ${deposit.code}`,
                description: [
                  `Can hoan ${Number(deposit.amount || 0).toLocaleString('vi-VN')} VND cho khach.`,
                  normalizedReason ? `Ly do: ${normalizedReason}` : null,
                  proofUrls.length > 0 ? `Chung tu: ${proofUrls.join(', ')}` : null,
                ].filter(Boolean).join('\n'),
                status: 'TODO' as any,
                priority: 'HIGH' as any,
                dueDate: new Date(),
              },
            })
          : null;

      return { updatedDeposit, receipt, task };
    });

    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Deposit',
      entityId: id,
      action: 'REFUND',
      before: deposit,
      after: {
        ...result.updatedDeposit,
        refundReceipt: result.receipt ? { id: result.receipt.id, code: result.receipt.code, status: result.receipt.status } : null,
        refundTask: result.task ? { id: result.task.id, title: result.task.title, status: result.task.status } : null,
      },
    });

    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Receipt',
      entityId: result.receipt.id,
      action: 'CREATE',
      before: null,
      after: result.receipt,
    });

    if (result.task) {
      await this.auditService.log({
        tenantId: deposit.tenantId,
        userId,
        module: 'Deposits',
        entity: 'Task',
        entityId: result.task.id,
        action: 'CREATE',
        before: null,
        after: result.task,
      });
    }

    if (receiptMode === ReceiptStatus.COMPLETED) {
      this.eventPublisher.publish('deposit.refunded', {
        tenantId: deposit.tenantId,
        userId,
        customerId: deposit.customerId,
        customerName: deposit.customer?.fullName,
        customerPhone: deposit.customer?.phone,
        metadata: {
          code: deposit.code,
          note: normalizedReason,
          refundSourceType: 'DEPOSIT',
          attachmentUrls: proofUrls,
        },
        sourceId: deposit.id,
        sourceType: 'REFUND',
        amount: Number(deposit.amount),
        paymentProvider: 'MANUAL',
        occurredAt: new Date(),
      });
    } else {
      this.eventPublisher.publish('deposit.refund_requested', {
        tenantId: deposit.tenantId,
        userId,
        customerId: deposit.customerId,
        customerName: deposit.customer?.fullName,
        customerPhone: deposit.customer?.phone,
        metadata: {
          code: deposit.code,
          note: normalizedReason,
          refundSourceType: 'DEPOSIT',
          attachmentUrls: proofUrls,
          receiptId: result.receipt.id,
          receiptCode: result.receipt.code,
          taskId: result.task?.id || null,
          taskTitle: result.task?.title || null,
        },
        sourceId: deposit.id,
        sourceType: 'REFUND',
        amount: Number(deposit.amount),
        paymentProvider: 'MANUAL',
        occurredAt: new Date(),
      });
    }

    return result.updatedDeposit;
  }

  async completePendingRefund(id: string, userId: string, note?: string) {
    const deposit = await this.getDetail(id);
    if (!deposit) throw new BadRequestException('Deposit not found');
    if (deposit.status !== DepositStatus.REFUNDED) {
      throw new BadRequestException('Can only complete pending refund for REFUNDED deposits');
    }

    const receipt = await this.prisma.receipt.findFirst({
      where: {
        tenantId: deposit.tenantId,
        status: ReceiptStatus.PENDING,
        code: { startsWith: this.buildRefundReceiptPrefix(deposit.code) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!receipt) {
      throw new BadRequestException('DEPOSIT_REFUND_PENDING_NOT_FOUND');
    }

    const pendingTask = await this.prisma.task.findFirst({
      where: {
        tenantId: deposit.tenantId,
        title: `Xu ly hoan coc ${deposit.code}`,
        status: 'TODO' as any,
      },
      orderBy: { createdAt: 'desc' },
    });

    const completionNote = String(note || '').trim();
    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedReceipt = await tx.receipt.update({
        where: { id: receipt.id },
        data: {
          status: ReceiptStatus.COMPLETED,
          description: completionNote ? `${receipt.description || ''}\nCompleted note: ${completionNote}`.trim() : receipt.description,
        },
      });

      const updatedTask = pendingTask
        ? await tx.task.update({
            where: { id: pendingTask.id },
            data: {
              status: 'DONE' as any,
              description: completionNote ? `${pendingTask.description || ''}\nHoan tat: ${completionNote}`.trim() : pendingTask.description,
            },
          })
        : null;

      return { updatedReceipt, updatedTask };
    });

    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Receipt',
      entityId: result.updatedReceipt.id,
      action: 'UPDATE',
      before: receipt,
      after: result.updatedReceipt,
    });

    if (pendingTask && result.updatedTask) {
      await this.auditService.log({
        tenantId: deposit.tenantId,
        userId,
        module: 'Deposits',
        entity: 'Task',
        entityId: result.updatedTask.id,
        action: 'UPDATE',
        before: pendingTask,
        after: result.updatedTask,
      });
    }

    this.eventPublisher.publish('deposit.refunded', {
      tenantId: deposit.tenantId,
      userId,
      customerId: deposit.customerId,
      customerName: deposit.customer?.fullName,
      customerPhone: deposit.customer?.phone,
      metadata: {
        code: deposit.code,
        refundSourceType: 'DEPOSIT',
        refundCompletionNote: completionNote || null,
        completedFromPending: true,
      },
      sourceId: deposit.id,
      sourceType: 'REFUND',
      amount: Number(result.updatedReceipt.amount || deposit.amount || 0),
      paymentProvider: 'MANUAL',
      occurredAt: new Date(),
    });

    return {
      success: true,
      receiptId: result.updatedReceipt.id,
      taskId: result.updatedTask?.id || null,
      amount: Number(result.updatedReceipt.amount || 0),
    };
  }

  async cancel(id: string, reason: string, userId: string, resolutionAction?: 'REFUND' | 'KEEP' | 'DEDUCT') {
    const deposit = await this.getDetail(id);
    if (!deposit) throw new BadRequestException('Deposit not found');
    if (deposit.status !== DepositStatus.DRAFT && deposit.status !== DepositStatus.PENDING && deposit.status !== DepositStatus.PAID) {
      throw new BadRequestException('Deposit status cannot be cancelled');
    }
    if (deposit.status === DepositStatus.PAID && !resolutionAction) {
      throw new BadRequestException('Paid deposits require REFUND, KEEP, or DEDUCT resolution before cancel');
    }

    const updateData = {
      status: DepositStatus.CANCELLED,
      note: deposit.status === DepositStatus.PAID ? `[${resolutionAction}] ${reason}` : reason,
    };
    const updated = await this.repository.update(id, updateData);
    
    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Deposit',
      entityId: id,
      action: 'CANCEL',
      before: deposit,
      after: updated,
    });

    if (deposit.status === DepositStatus.PAID && resolutionAction === 'DEDUCT') {
      this.eventPublisher.publish('deposit.deducted', {
        tenantId: deposit.tenantId,
        userId,
        customerId: deposit.customerId,
        customerName: deposit.customer?.fullName,
        customerPhone: deposit.customer?.phone,
        metadata: {
          code: deposit.code,
          note: reason,
          adjustmentType: 'DEPOSIT_DEDUCTION',
          resolutionAction,
        },
        sourceId: deposit.id,
        sourceType: 'ADJUSTMENT',
        amount: Number(deposit.amount),
        paymentProvider: 'MANUAL',
        occurredAt: new Date(),
      });
    }

    return updated;
  }

  async convertToContract(id: string, userId: string) {
    const deposit = await this.repository.findById(id);
    if (!deposit) throw new BadRequestException('Deposit not found');
    if (deposit.status !== DepositStatus.PAID) {
      throw new BadRequestException('Only PAID deposits can be converted to contracts');
    }

    // In a real application, you would generate a contract and invoice here.
    // For this mock implementation, we just mark the deposit as CONVERTED_TO_CONTRACT
    // and theoretically link it to a newly generated contract.
    const now = new Date();
    
    // In actual implementation, we would inject ContractsService and create a contract
    // We will simulate it by updating deposit status
    
    const updateData = { status: DepositStatus.CONVERTED_TO_CONTRACT };
    const updated = await this.repository.update(id, updateData);
    
    await this.auditService.log({
      tenantId: deposit.tenantId,
      userId,
      module: 'Deposits',
      entity: 'Deposit',
      entityId: id,
      action: 'CONVERT_CONTRACT',
      before: deposit,
      after: updated,
    });

    return {
      deposit: updated,
      // contract: newContract
    };
  }

  private async getRefundSummary(deposit: any) {
    if (!deposit?.id || !deposit?.code) return null;

    const [receipt, task] = await Promise.all([
      this.prisma.receipt.findFirst({
        where: {
          tenantId: deposit.tenantId,
          code: { startsWith: this.buildRefundReceiptPrefix(deposit.code) },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.findFirst({
        where: {
          tenantId: deposit.tenantId,
          title: `Xu ly hoan coc ${deposit.code}`,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!receipt && !task) return null;

    const receiptStatus = String(receipt?.status || '');
    const taskStatus = String(task?.status || '');

    return {
      receiptId: receipt?.id || null,
      receiptCode: receipt?.code || null,
      receiptStatus: receipt?.status || null,
      receiptAmount: Number(receipt?.amount || 0),
      receiptDescription: receipt?.description || null,
      taskId: task?.id || null,
      taskTitle: task?.title || null,
      taskStatus: task?.status || null,
      pending: receiptStatus === ReceiptStatus.PENDING || taskStatus === 'TODO' || taskStatus === 'IN_PROGRESS',
      completed: receiptStatus === ReceiptStatus.COMPLETED && (!task || taskStatus === 'DONE'),
    };
  }

  private buildRefundReceiptCode(depositCode: string) {
    return `${this.buildRefundReceiptPrefix(depositCode)}${Date.now()}`;
  }

  private buildRefundReceiptPrefix(depositCode: string) {
    const normalizedCode = String(depositCode || 'DEPOSIT').replace(/[^A-Z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toUpperCase();
    return `RCT-${normalizedCode}-REFUND-`;
  }
}
