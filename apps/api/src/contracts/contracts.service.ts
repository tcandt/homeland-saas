import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { Contract, ContractStatus, DepositStatus, InvoiceItemType, InvoiceStatus, ReceiptStatus, RoomStatus } from '@prisma/client';
import { ContractSettlementInput, PaginatedResult } from '@homeland/shared';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';
import { DomainEventPublisher } from '../shared/events/domain-event.publisher';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { HunonicService } from '../hunonic/hunonic.service';
import { mapStatusFilter } from './contracts.adapter';
import { ContractsRepository } from './contracts.repository';
import { buildRoomContext } from '../shared/context/room-context';

@Injectable()
export class ContractsService extends BaseCrudService<Contract> {
  constructor(
    repository: ContractsRepository,
    auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly hunonicService: HunonicService,
  ) {
    super(repository, auditService, 'Contract');
  }

  async create(data: any, userId?: string, moduleName?: string): Promise<Contract> {
    const created = await super.create(data, userId, moduleName);
    if (Number(created.depositMoney || 0) > 0) {
      await this.syncContractDeposit(created);
    }
    return created;
  }

  async update(id: string, data: any, userId?: string, moduleName?: string): Promise<Contract> {
    const updated = await super.update(id, data, userId, moduleName);
    if (data.depositMoney !== undefined || data.status !== undefined) {
      await this.syncContractDeposit(updated);
    }
    return updated;
  }

  async syncContractDeposit(contract: any) {
    if (!contract?.id || !contract?.tenantId) return;
    const amount = Number(contract.depositMoney || 0);
    if (amount <= 0) return;

    try {
      const existingDeposit = await this.prisma.tx.deposit.findFirst({
        where: {
          tenantId: contract.tenantId,
          OR: [
            { contractId: contract.id },
            {
              contractId: null,
              roomId: contract.roomId,
              customerId: contract.customerId,
              status: { in: [DepositStatus.PAID, DepositStatus.DRAFT, DepositStatus.PENDING] },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      const targetStatus =
        contract.status === ContractStatus.ACTIVE || contract.status === ContractStatus.APPROVED
          ? DepositStatus.CONVERTED_TO_CONTRACT
          : contract.status === ContractStatus.TERMINATED || contract.status === ContractStatus.EXPIRED
            ? DepositStatus.REFUNDED
            : DepositStatus.DRAFT;

      if (existingDeposit) {
        await this.prisma.tx.deposit.update({
          where: { id: existingDeposit.id },
          data: {
            contractId: contract.id,
            amount: contract.depositMoney,
            status: existingDeposit.status === DepositStatus.REFUNDED ? DepositStatus.REFUNDED : targetStatus,
            type: existingDeposit.type || 'SECURITY',
          },
        });
      } else {
        await this.prisma.tx.deposit.create({
          data: {
            tenantId: contract.tenantId,
            code: `DC-${contract.code || Date.now()}`,
            type: 'SECURITY',
            roomId: contract.roomId,
            customerId: contract.customerId,
            contractId: contract.id,
            amount: contract.depositMoney,
            status: targetStatus,
            note: `Cọc bảo đảm hợp đồng ${contract.code}`,
          },
        });
      }
    } catch (e) {
      // Don't fail contract operation if deposit sync fails
    }
  }

  async getDetail(id: string, include?: any): Promise<any> {
    const record = await super.getDetail(id, include);
    const settlementRefund = await this.getSettlementRefundSummary(record);
    if (record.coRepresentativeIds && record.coRepresentativeIds.length > 0) {
      const coReps = await this.prisma.tx.customer.findMany({
        where: { id: { in: record.coRepresentativeIds } },
        select: { id: true, fullName: true, phone: true, identityNo: true, idImages: true },
      });
      return { ...record, coRepresentatives: coReps, settlementRefund };
    }
    return { ...record, settlementRefund };
  }

  async listContracts(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    roomId?: string,
    customerId?: string,
    sort?: string,
    order?: string,
    tenantId?: string,
  ): Promise<PaginatedResult<Contract>> {
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { customer: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status) where.status = mapStatusFilter(status);
    if (roomId) where.roomId = roomId;
    if (customerId) where.customerId = customerId;

    const orderBy = { [sort || 'createdAt']: order || 'desc' };

    return this.repository.paginate(where, page, limit, orderBy, {
      customer: { select: { id: true, fullName: true, phone: true, gender: true } },
      room: {
        select: { id: true, code: true, building: { select: { id: true, name: true } } },
      },
    });
  }

  async submitContract(id: string, userId: string): Promise<Contract> {
    const contract = await this.getDetail(id);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit contract in ${contract.status} status. Only DRAFT is allowed.`);
    }

    const updated = await this.prisma.tx.contract.update({
      where: { id },
      data: { status: ContractStatus.PENDING_APPROVAL },
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: this.entityName,
      entityId: id,
      module: 'Contracts',
      before: contract,
      after: updated,
      userId,
    });

    return updated;
  }

  async approveContract(id: string, userId: string): Promise<Contract> {
    const contract = await this.getDetail(id);

    if (contract.status !== ContractStatus.PENDING_APPROVAL) {
      throw new BadRequestException(`Cannot approve contract in ${contract.status} status. Only PENDING_APPROVAL is allowed.`);
    }

    const room = await this.prisma.tx.room.findUnique({ where: { id: contract.roomId } });
    if (!room || room.status !== RoomStatus.AVAILABLE) {
      throw new ConflictException(`Room ${room?.code || contract.roomId} is not AVAILABLE.`);
    }

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id },
        data: { status: ContractStatus.APPROVED },
      });

      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.RESERVED },
      });

      const deposit = await tx.deposit.create({
        data: {
          tenantId: contract.tenantId,
          code: `DEP-${Date.now()}`,
          roomId: contract.roomId,
          customerId: contract.customerId,
          contractId: contract.id,
          amount: contract.depositMoney,
          status: 'DRAFT',
        },
      });

      return { updatedContract, updatedRoom, deposit };
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: this.entityName,
      entityId: id,
      module: 'Contracts',
      before: contract,
      after: result.updatedContract,
      userId,
    });

    return result.updatedContract;
  }

  async activateContract(id: string, userId: string): Promise<Contract> {
    const contract = await this.getDetail(id);

    if (contract.status !== ContractStatus.APPROVED) {
      throw new BadRequestException(`Cannot activate contract in ${contract.status} status. Only APPROVED is allowed.`);
    }

    const room = await this.prisma.tx.room.findUnique({ where: { id: contract.roomId } });
    if (!room || room.status !== RoomStatus.RESERVED) {
      throw new ConflictException(`Room ${room?.code || contract.roomId} is not RESERVED.`);
    }

    const deposit = await this.prisma.tx.deposit.findFirst({
      where: { contractId: contract.id },
    });

    if (!deposit) {
      throw new BadRequestException('Cannot activate contract: Deposit is missing.');
    }

    if (deposit.status !== DepositStatus.PAID && deposit.status !== DepositStatus.CONVERTED_TO_CONTRACT) {
      throw new BadRequestException(`Cannot activate contract: Deposit is in ${deposit.status} status. Must be PAID.`);
    }

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id },
        data: { status: ContractStatus.ACTIVE },
      });

      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      const updatedDeposit = await tx.deposit.update({
        where: { id: deposit.id },
        data: { status: DepositStatus.CONVERTED_TO_CONTRACT },
      });

      const invoice = await tx.invoice.create({
        data: {
          tenantId: contract.tenantId,
          code: `INV-${Date.now()}`,
          contractId: contract.id,
          customerId: contract.customerId,
          status: InvoiceStatus.ISSUED,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          subtotal: contract.monthlyRent,
          discount: 0,
          total: contract.monthlyRent,
          paidAmount: 0,
          creditAmount: 0,
          items: {
            create: [
              {
                tenantId: contract.tenantId,
                type: 'RENT',
                description: 'First month rent',
                quantity: 1,
                unitPrice: contract.monthlyRent,
                amount: contract.monthlyRent,
              },
            ],
          },
        },
      });

      return { updatedContract, updatedRoom, updatedDeposit, invoice };
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: this.entityName,
      entityId: id,
      module: 'Contracts',
      before: contract,
      after: result.updatedContract,
      userId,
    });

    return result.updatedContract;
  }

  async expireContract(id: string, userId: string): Promise<Contract> {
    return this.finalizeContract(id, userId, ContractStatus.EXPIRED);
  }

  async previewSettlement(id: string, input: ContractSettlementInput) {
    const contract = await this.getDetail(id);
    return this.composeSettlementPreview(contract, input);
  }

  async terminateContract(id: string, userId: string, input?: Partial<ContractSettlementInput>): Promise<Contract> {
    return this.finalizeContract(id, userId, ContractStatus.TERMINATED, input);
  }

  async completePendingSettlementRefund(id: string, userId: string, note?: string) {
    const contract = await this.getDetail(id);
    if (contract.status !== ContractStatus.TERMINATED && contract.status !== ContractStatus.EXPIRED) {
      throw new BadRequestException(`Cannot complete settlement refund in ${contract.status} status.`);
    }

    const refundReceiptPrefix = this.buildRefundReceiptPrefix(contract.code);
    const refundReceipt = await this.prisma.receipt.findFirst({
      where: {
        tenantId: contract.tenantId,
        status: ReceiptStatus.PENDING,
        code: { startsWith: refundReceiptPrefix },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!refundReceipt) {
      throw new BadRequestException('SETTLEMENT_REFUND_PENDING_NOT_FOUND');
    }

    const refundTaskTitle = `Xu ly hoan tien quyet toan ${contract.code}`;
    const pendingTask = await this.prisma.task.findFirst({
      where: {
        tenantId: contract.tenantId,
        status: 'TODO' as any,
        title: refundTaskTitle,
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedReceipt = await tx.receipt.update({
        where: { id: refundReceipt.id },
        data: {
          status: ReceiptStatus.COMPLETED,
          description: note
            ? `${refundReceipt.description || `Contract settlement refund for ${contract.code}`}\nCompleted note: ${note}`.trim()
            : refundReceipt.description,
        },
      });

      const updatedTask = pendingTask
        ? await tx.task.update({
            where: { id: pendingTask.id },
            data: {
              status: 'DONE' as any,
              description: note
                ? `${pendingTask.description || ''}\nHoan tat: ${note}`.trim()
                : pendingTask.description,
            },
          })
        : null;

      return { updatedReceipt, updatedTask };
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: 'Receipt',
      entityId: result.updatedReceipt.id,
      module: 'Contracts',
      before: refundReceipt,
      after: result.updatedReceipt,
      userId,
    });

    if (pendingTask && result.updatedTask) {
      await this.auditService.log({
        action: 'UPDATE',
        entity: 'Task',
        entityId: result.updatedTask.id,
        module: 'Contracts',
        before: pendingTask,
        after: result.updatedTask,
        userId,
      });
    }

    const settlementAudit = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: contract.tenantId,
        entity: this.entityName,
        entityId: contract.id,
        module: 'Contracts',
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });
    const accountingBreakdown = (settlementAudit?.after as any)?.settlement?.accountingBreakdown || null;

    this.eventPublisher.publish('contract.settlement.refunded', {
      tenantId: contract.tenantId,
      userId,
      customerId: contract.customerId,
      customerName: contract.customer?.fullName,
      customerPhone: contract.customer?.phone,
      ...buildRoomContext(contract.room, contract),
      metadata: {
        code: contract.code,
        refundSourceType: 'CONTRACT_SETTLEMENT',
        refundCompletionNote: note || null,
        completedFromPending: true,
        ...(accountingBreakdown ? { accountingBreakdown } : {}),
      },
      sourceId: contract.id,
      sourceType: 'REFUND',
      amount: Number(result.updatedReceipt.amount || 0),
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

  private async finalizeContract(
    id: string,
    userId: string,
    targetStatus: ContractStatus,
    input?: Partial<ContractSettlementInput>,
  ): Promise<Contract> {
    const contract = await this.getDetail(id);

    if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.EXPIRING) {
      throw new BadRequestException(`Cannot finalize contract in ${contract.status} status. Only ACTIVE or EXPIRING is allowed.`);
    }

    const settlement = input?.actualMoveOutDate
      ? await this.composeSettlementPreview(contract, input as ContractSettlementInput)
      : await this.composeSettlementPreview(contract, {
          actualMoveOutDate: new Date(),
          roomTurnoverStatus: 'AVAILABLE',
          rentDaysCharged: 0,
        });

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id },
        data: { status: targetStatus },
      });

      if (contract.customerId && tx.customer?.updateMany) {
        await tx.customer.updateMany({
          where: {
            id: contract.customerId,
            contracts: { none: { status: ContractStatus.ACTIVE, id: { not: contract.id } } },
          },
          data: {
            roomId: null,
            zaloChatId: null,
            zaloUserId: null,
            zaloPhone: null,
          },
        });
      }

      const remainingActiveContracts = tx.contract?.count
        ? await tx.contract.count({
            where: {
              tenantId: contract.tenantId,
              roomId: contract.roomId,
              status: ContractStatus.ACTIVE,
              id: { not: contract.id },
            },
          })
        : 0;

      const targetRoomStatus =
        remainingActiveContracts > 0
          ? RoomStatus.OCCUPIED
          : settlement.roomTurnoverStatus;

      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: targetRoomStatus },
      });

      const invoice = settlement.totals.netReceivable > 0
        ? await tx.invoice.create({
            data: {
              tenantId: contract.tenantId,
              code: `FIN-${Date.now()}`,
              contractId: contract.id,
              customerId: contract.customerId,
              status: InvoiceStatus.ISSUED,
              dueDate: settlement.actualMoveOutDate,
              subtotal: settlement.totals.chargeTotal,
              discount: 0,
              total: settlement.totals.chargeTotal,
              paidAmount: 0,
              creditAmount: Math.min(settlement.totals.creditTotal, settlement.totals.chargeTotal),
              items: {
                create: settlement.invoiceItems.map((item) => ({
                  tenantId: contract.tenantId,
                  type: item.type,
                  description: item.description,
                  quantity: 1,
                  unitPrice: item.amount,
                  amount: item.amount,
                })),
              },
            },
          })
        : null;

      const refundReceipt = settlement.totals.refundToCustomer > 0
        ? await tx.receipt.create({
            data: {
              tenantId: contract.tenantId,
              code: this.buildRefundReceiptCode(contract.code),
              amount: settlement.totals.refundToCustomer,
              status: settlement.refund.receiptStatus,
              description: settlement.refund.reason
                ? `Contract settlement refund for ${contract.code} - ${settlement.refund.reason}`
                : `Contract settlement refund for ${contract.code}`,
              date: settlement.actualMoveOutDate,
            },
          })
        : null;

      const refundTask =
        settlement.totals.refundToCustomer > 0 && settlement.refund.receiptStatus !== ReceiptStatus.COMPLETED
          ? await tx.task.create({
              data: {
                tenantId: contract.tenantId,
                title: `Xu ly hoan tien quyet toan ${contract.code}`,
                description: [
                  `Can hoan ${settlement.totals.refundToCustomer.toLocaleString('vi-VN')} VND cho khach.`,
                  settlement.refund.reason ? `Ly do: ${settlement.refund.reason}` : null,
                  Array.isArray(settlement.refund.attachmentUrls) && settlement.refund.attachmentUrls.length > 0
                    ? `Chung tu: ${settlement.refund.attachmentUrls.join(', ')}`
                    : null,
                ].filter(Boolean).join('\n'),
                status: 'TODO' as any,
                priority: 'HIGH' as any,
                dueDate: settlement.actualMoveOutDate,
              },
            })
          : null;

      if (tx.deposit?.updateMany) {
        await tx.deposit.updateMany({
          where: {
            tenantId: contract.tenantId,
            contractId: contract.id,
          },
          data: {
            status:
              settlement.refund.receiptStatus === ReceiptStatus.PENDING
                ? DepositStatus.PENDING
                : DepositStatus.REFUNDED,
          },
        });
      }

      return { updatedContract, updatedRoom, invoice, refundReceipt, refundTask };
    });

    await this.auditService.log({
      action: 'UPDATE',
      entity: this.entityName,
      entityId: id,
      module: 'Contracts',
      before: contract,
      after: {
        ...result.updatedContract,
        settlement,
        refundReceipt: result.refundReceipt
          ? {
              id: result.refundReceipt.id,
              code: result.refundReceipt.code,
              amount: result.refundReceipt.amount,
              status: result.refundReceipt.status,
            }
          : null,
        refundTask: result.refundTask
          ? {
              id: result.refundTask.id,
              title: result.refundTask.title,
              status: result.refundTask.status,
            }
          : null,
      },
      userId,
    });

    if (result.refundReceipt) {
      await this.auditService.log({
        action: 'CREATE',
        entity: 'Receipt',
        entityId: result.refundReceipt.id,
        module: 'Contracts',
        before: null,
        after: result.refundReceipt,
        userId,
      });
    }

    if (result.refundTask) {
      await this.auditService.log({
        action: 'CREATE',
        entity: 'Task',
        entityId: result.refundTask.id,
        module: 'Contracts',
        before: null,
        after: result.refundTask,
        userId,
      });
    }

    if (settlement.totals.refundToCustomer > 0 && settlement.refund.receiptStatus === ReceiptStatus.COMPLETED) {
      this.eventPublisher.publish('contract.settlement.refunded', {
        tenantId: contract.tenantId,
        userId,
        customerId: contract.customerId,
        customerName: contract.customer?.fullName,
        customerPhone: contract.customer?.phone,
        ...buildRoomContext(contract.room, contract),
        metadata: {
          code: contract.code,
          refundSourceType: 'CONTRACT_SETTLEMENT',
          actualMoveOutDate: settlement.actualMoveOutDate,
          settlement,
          accountingBreakdown: settlement.accountingBreakdown,
          refundReason: settlement.refund.reason,
          refundAttachmentUrls: settlement.refund.attachmentUrls,
        },
        sourceId: contract.id,
        sourceType: 'REFUND',
        amount: settlement.totals.refundToCustomer,
        paymentProvider: 'MANUAL',
        occurredAt: new Date(),
      });
    }

    const depositAppliedAmount = Number(settlement.accountingBreakdown.depositAppliedAmount || 0);
    if (depositAppliedAmount > 0) {
      this.eventPublisher.publish('deposit.deducted', {
        tenantId: contract.tenantId,
        userId,
        customerId: contract.customerId,
        customerName: contract.customer?.fullName,
        customerPhone: contract.customer?.phone,
        ...buildRoomContext(contract.room, contract),
        metadata: {
          code: contract.code,
          adjustmentType: 'DEPOSIT_SETTLEMENT_APPLICATION',
          resolutionAction: 'DEDUCT',
          contractId: contract.id,
          invoiceId: result.invoice?.id || null,
          actualMoveOutDate: settlement.actualMoveOutDate,
        },
        sourceId: contract.id,
        sourceType: 'ADJUSTMENT',
        amount: depositAppliedAmount,
        paymentProvider: 'MANUAL',
        occurredAt: new Date(),
      });
    }

    this.eventPublisher.publish('contract.settlement.completed', {
      tenantId: contract.tenantId,
      userId,
      customerId: contract.customerId,
      customerName: contract.customer?.fullName,
      customerPhone: contract.customer?.phone,
      ...buildRoomContext(contract.room, contract),
      metadata: {
        code: contract.code,
        settlement,
        roomId: contract.roomId,
        title: `Quyet toan hop dong ${contract.code}`,
        message:
          settlement.totals.netReceivable > 0
            ? `Hop dong ${contract.code} da quyet toan. Khach can thanh toan them ${settlement.totals.netReceivable.toLocaleString('vi-VN')} VND.`
            : settlement.totals.refundToCustomer > 0
              ? settlement.refund.receiptStatus === ReceiptStatus.COMPLETED
                ? `Hop dong ${contract.code} da quyet toan. He thong da hoan ${settlement.totals.refundToCustomer.toLocaleString('vi-VN')} VND cho khach.`
                : `Hop dong ${contract.code} da quyet toan. He thong dang cho xu ly hoan ${settlement.totals.refundToCustomer.toLocaleString('vi-VN')} VND cho khach.`
              : `Hop dong ${contract.code} da quyet toan xong va khong con cong no.`,
      },
      sourceId: contract.id,
      sourceType: 'CONTRACT',
      amount: settlement.totals.netReceivable,
      occurredAt: new Date(),
    });

    return result.updatedContract;
  }

  private buildSettlementPreview(contract: any, input: ContractSettlementInput) {
    const actualMoveOutDate = new Date(input.actualMoveOutDate);
    if (Number.isNaN(actualMoveOutDate.getTime())) {
      throw new BadRequestException('SETTLEMENT_MOVE_OUT_DATE_INVALID');
    }

    const monthlyRent = Number(contract.monthlyRent || 0);
    const dailyRent = monthlyRent > 0 ? monthlyRent / 30 : 0;
    const rentDaysCharged = input.rentDaysCharged ?? 0;
    const rentChargeAmount = this.roundMoney(input.baseRentAmount ?? dailyRent * rentDaysCharged);
    const electricityAmount = this.roundMoney(input.electricityAmount ?? 0);
    const waterUsage = this.resolveWaterUsage(input);
    const waterUnitPrice = this.roundMoney(input.waterUnitPrice ?? 0);
    const waterAmount = this.roundMoney(
      input.waterAmount ?? ((waterUsage !== null && waterUnitPrice > 0) ? waterUsage * waterUnitPrice : 0),
    );
    const serviceAmount = this.roundMoney(input.serviceAmount ?? 0);
    const damageFee = this.roundMoney(input.damageFee ?? 0);
    const penaltyFee = this.roundMoney(input.penaltyFee ?? 0);
    const otherChargeAmount = this.roundMoney(input.otherChargeAmount ?? 0);
    const roomRefundAmount = this.roundMoney(input.roomRefundAmount ?? 0);
    const waterSupportAmount = this.roundMoney(input.waterSupportAmount ?? 0);
    const otherCreditAmount = this.roundMoney(input.otherCreditAmount ?? 0);
    const depositToRefund = this.roundMoney(input.depositToRefund ?? 0);
    const depositToDeduct = this.roundMoney(input.depositToDeduct ?? 0);
    const depositBalance = this.roundMoney(Number(contract.depositMoney || 0));
    const refundReceiptStatus = input.refundReceiptStatus === 'PENDING' ? ReceiptStatus.PENDING : ReceiptStatus.COMPLETED;
    const refundReason = String(input.refundReason || '').trim() || null;
    const refundAttachmentUrls = Array.isArray(input.refundAttachmentUrls) ? input.refundAttachmentUrls.filter(Boolean) : [];

    if (depositToRefund + depositToDeduct > depositBalance) {
      throw new BadRequestException('SETTLEMENT_DEPOSIT_EXCEEDS_BALANCE');
    }

    const chargeLines = [
      { key: 'rentChargeAmount', type: 'RENT' as InvoiceItemType, description: `Tiền thuê phát sinh (${rentDaysCharged} ngày)`, amount: rentChargeAmount },
      { key: 'electricityAmount', type: 'UTILITY_ELECTRICITY' as InvoiceItemType, description: 'Tiền điện chốt kỳ', amount: electricityAmount },
      { key: 'waterAmount', type: 'UTILITY_WATER' as InvoiceItemType, description: 'Tiền nước quyết toán', amount: waterAmount },
      { key: 'serviceAmount', type: 'SERVICE' as InvoiceItemType, description: 'Phí dịch vụ phát sinh', amount: serviceAmount },
      { key: 'damageFee', type: 'PENALTY' as InvoiceItemType, description: 'Bồi thường hư hỏng', amount: damageFee },
      { key: 'penaltyFee', type: 'PENALTY' as InvoiceItemType, description: 'Phí phạt vi phạm / trả sớm', amount: penaltyFee },
      { key: 'otherChargeAmount', type: 'OTHER' as InvoiceItemType, description: 'Khoản thu phát sinh khác', amount: otherChargeAmount },
    ].filter((line) => line.amount > 0);

    const creditLines = [
      { key: 'roomRefundAmount', description: 'Hoàn tiền phòng dư', amount: roomRefundAmount },
      { key: 'waterSupportAmount', description: 'Hỗ trợ tiền nước', amount: waterSupportAmount },
      { key: 'otherCreditAmount', description: 'Khoản giảm trừ khác', amount: otherCreditAmount },
      { key: 'depositToDeduct', description: 'Khấu trừ cọc vào công nợ', amount: depositToDeduct },
      { key: 'depositToRefund', description: 'Tiền cọc hoàn trả khách', amount: depositToRefund },
    ].filter((line) => line.amount > 0);

    const chargeTotal = this.roundMoney(chargeLines.reduce((sum, line) => sum + line.amount, 0));
    const creditTotal = this.roundMoney(creditLines.reduce((sum, line) => sum + line.amount, 0));
    const netReceivable = this.roundMoney(Math.max(chargeTotal - creditTotal, 0));
    const refundToCustomer = this.roundMoney(Math.max(creditTotal - chargeTotal, 0));
    const operationalCreditTotal = this.roundMoney(roomRefundAmount + waterSupportAmount + otherCreditAmount);
    const depositCreditTotal = this.roundMoney(depositToRefund + depositToDeduct);
    const depositAppliedAmount = this.roundMoney(
      Math.min(depositCreditTotal, Math.max(chargeTotal - operationalCreditTotal, 0)),
    );
    const depositRefundAmount = this.roundMoney(Math.max(depositCreditTotal - depositAppliedAmount, 0));
    const revenueRefundAmount = this.roundMoney(Math.max(operationalCreditTotal - chargeTotal, 0));

    return {
      contract: {
        id: contract.id,
        code: contract.code,
        customerId: contract.customerId,
        roomId: contract.roomId,
      },
      actualMoveOutDate,
      roomTurnoverStatus:
        input.roomTurnoverStatus === 'MAINTENANCE' || (damageFee > 0 && input.roomTurnoverStatus !== 'AVAILABLE')
          ? RoomStatus.MAINTENANCE
          : input.roomTurnoverStatus === 'CLEANING'
            ? RoomStatus.CLEANING
            : RoomStatus.AVAILABLE,
      assumptions: {
        monthlyRent,
        dailyRent: this.roundMoney(dailyRent),
        rentDaysCharged,
        depositBalance,
        note: input.note || null,
      },
      refund: {
        receiptStatus: refundReceiptStatus,
        reason: refundReason,
        attachmentUrls: refundAttachmentUrls,
      },
      charges: chargeLines,
      credits: creditLines,
      accountingBreakdown: {
        operationalCreditTotal,
        depositCreditTotal,
        depositAppliedAmount,
        depositRefundAmount,
        revenueRefundAmount,
      },
      invoiceItems: chargeLines.map(({ key, ...line }) => line),
      totals: {
        chargeTotal,
        creditTotal,
        netReceivable,
        refundToCustomer,
      },
    };
  }

  private async getSettlementRefundSummary(contract: any) {
    if (!contract?.id || !contract?.code) {
      return null;
    }

    const refundReceiptPrefix = this.buildRefundReceiptPrefix(contract.code);
    const [receipt, task] = await Promise.all([
      this.prisma.receipt.findFirst({
        where: {
          tenantId: contract.tenantId,
          code: { startsWith: refundReceiptPrefix },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.findFirst({
        where: {
          tenantId: contract.tenantId,
          title: `Xu ly hoan tien quyet toan ${contract.code}`,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!receipt && !task) {
      return null;
    }

    const receiptStatus = String(receipt?.status || '');
    const taskStatus = String(task?.status || '');
    const isPending = receiptStatus === ReceiptStatus.PENDING || taskStatus === 'TODO' || taskStatus === 'IN_PROGRESS';
    const isCompleted = receiptStatus === ReceiptStatus.COMPLETED && (!task || taskStatus === 'DONE');

    return {
      receiptId: receipt?.id || null,
      receiptCode: receipt?.code || null,
      receiptStatus: receipt?.status || null,
      receiptAmount: Number(receipt?.amount || 0),
      receiptDescription: receipt?.description || null,
      taskId: task?.id || null,
      taskTitle: task?.title || null,
      taskStatus: task?.status || null,
      pending: isPending,
      completed: isCompleted,
    };
  }

  private roundMoney(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private async composeSettlementPreview(contract: any, input: ContractSettlementInput) {
    const actualMoveOutDate = this.resolveMoveOutDate(input.actualMoveOutDate);
    const utilitySnapshot = await this.getUtilitySnapshot(contract.tenantId, contract.roomId, actualMoveOutDate);
    const electricityClosingKwh =
      input.electricityClosingKwh !== undefined && input.electricityClosingKwh !== null
        ? Number(input.electricityClosingKwh || 0)
        : null;
    if (utilitySnapshot.electricity && electricityClosingKwh !== null) {
      utilitySnapshot.electricity = this.applyManualElectricityClosingKwh(
        utilitySnapshot.electricity,
        electricityClosingKwh,
      );
    }
    const waterUsage = this.resolveWaterUsage(input);
    const waterUnitPrice = this.roundMoney(Number(input.waterUnitPrice || 0));
    const derivedWaterAmount =
      waterUsage !== null && waterUnitPrice > 0
        ? this.roundMoney(waterUsage * waterUnitPrice)
        : 0;
    const waterAmount = input.waterAmount ?? derivedWaterAmount;
    utilitySnapshot.water =
      waterUsage !== null || waterAmount > 0
        ? {
            previousReading: Number(input.waterPreviousReading || 0),
            currentReading: Number(input.waterCurrentReading || 0),
            usage: Number(waterUsage || 0),
            unitPrice: waterUnitPrice,
            amount: this.roundMoney(Number(waterAmount || 0)),
            source:
              input.waterAmount !== undefined && input.waterAmount !== null
                ? 'MANUAL_AMOUNT'
                : waterUsage !== null && waterUnitPrice > 0
                  ? 'MANUAL_READING'
                  : 'MANUAL_AMOUNT',
          }
        : null;
    const preview = this.buildSettlementPreview(contract, {
      ...input,
      actualMoveOutDate,
      electricityAmount:
        input.electricityAmount ?? utilitySnapshot.electricity?.calculatedAmountVnd ?? utilitySnapshot.electricity?.monthAmountVnd ?? 0,
      waterAmount,
    });
    return {
      ...preview,
      utilitySnapshot,
      settlementSnapshot: this.buildSettlementSnapshot(utilitySnapshot, actualMoveOutDate),
    };
  }

  private resolveMoveOutDate(value: string | Date) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split('-').map(Number);
        // End of day in Vietnam time (GMT+7): 23:59:59.999 -> 16:59:59.999 UTC
        return new Date(Date.UTC(year, month - 1, day, 16, 59, 59, 999));
      }
    }
    const actualMoveOutDate = new Date(value);
    if (Number.isNaN(actualMoveOutDate.getTime())) {
      throw new BadRequestException('SETTLEMENT_MOVE_OUT_DATE_INVALID');
    }
    return actualMoveOutDate;
  }

  private async getUtilitySnapshot(tenantId: string, roomId: string, moveOutDate: Date) {
    if (!tenantId || !roomId) {
      return { electricity: null, water: null };
    }

    const mapping = await (this.prisma as any).hunonicMeterMapping.findFirst({
      where: {
        tenantId,
        roomId,
        enabled: true,
      },
      include: {
        readings: {
          where: {
            readingAt: {
              lte: moveOutDate,
            },
          },
          orderBy: { readingAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!mapping) {
      return { electricity: null, water: null };
    }

    const latestReading = Array.isArray(mapping.readings) && mapping.readings.length > 0
      ? mapping.readings[0]
      : await (this.prisma as any).hunonicMeterReading.findFirst({
          where: {
            tenantId,
            meterMappingId: mapping.id,
          },
          orderBy: { readingAt: 'desc' },
        });
    const period = latestReading?.currentMonth || this.getSettlementPeriod(moveOutDate);
    let pricing: Awaited<ReturnType<HunonicService['getRoomElectricityPricing']>> = null;
    try {
      pricing = await this.hunonicService.getRoomElectricityPricing(tenantId, roomId);
    } catch {
      pricing = null;
    }
    const room = (this.prisma as any).room?.findUnique
      ? await (this.prisma as any).room.findUnique({
          where: { id: roomId },
          select: { id: true, code: true, name: true, rentalType: true, capacity: true, bedCount: true },
        })
      : null;
    const isSharedRoom = room?.rentalType === 'SHARED';
    let activeOccupants = 1;
    if (isSharedRoom) {
      const activeContracts = (this.prisma as any).contract?.count
        ? await (this.prisma as any).contract.count({
            where: {
              tenantId,
              roomId,
              status: 'ACTIVE',
            },
          })
        : 0;
      activeOccupants = Math.max(1, activeContracts || room?.capacity || room?.bedCount || 1);
    }

    const totalRoomMonthKwh = Number(latestReading?.energyMonthKwh ?? mapping.lastReadingKwh ?? 0);
    const totalRoomAmountVnd = Number(latestReading?.moneyMonthVnd ?? mapping.lastAmountVnd ?? 0);
    const totalCalculatedAmountVnd = this.calculateElectricityAmount(totalRoomMonthKwh, pricing) ?? totalRoomAmountVnd;

    const monthKwh = isSharedRoom
      ? Math.round((totalRoomMonthKwh / activeOccupants) * 100) / 100
      : totalRoomMonthKwh;
    const monthAmountVnd = isSharedRoom
      ? Math.round(totalRoomAmountVnd / activeOccupants)
      : totalRoomAmountVnd;
    const calculatedAmountVnd = isSharedRoom
      ? Math.round(totalCalculatedAmountVnd / activeOccupants)
      : totalCalculatedAmountVnd;

    return {
      electricity: {
        meterId: mapping.id,
        providerMeterId: mapping.providerMeterId,
        displayName: mapping.displayName,
        deviceName: mapping.deviceName,
        status: mapping.lastStatus,
        isSharedRoom,
        activeOccupants,
        totalRoomMonthKwh,
        totalRoomAmountVnd,
        totalCalculatedAmountVnd,
        monthKwh,
        monthAmountVnd,
        calculatedAmountVnd,
        rateMode: pricing?.currentMode || null,
        customRateVnd: pricing?.customRateVnd ?? null,
        residentialSteps: pricing?.residentialSteps || [],
        powerCurrentW: Number(latestReading?.powerCurrentW ?? 0),
        readingAt: latestReading?.readingAt ?? mapping.lastSyncedAt ?? null,
        currentMonth: period,
        source: latestReading ? 'HUNONIC_READING' : 'HUNONIC_MAPPING',
        calculationSource: pricing?.currentMode === 'custom'
          ? 'CUSTOM_RATE'
          : pricing?.currentMode === 'residential'
            ? 'RESIDENTIAL_STEPS'
            : 'HUNONIC_AMOUNT',
        sharedSplitNote: isSharedRoom
          ? `Phòng ghép (${activeOccupants} người) · Chia đều 1/${activeOccupants}`
          : null,
      },
      water: null,
    };
  }

  private resolveWaterUsage(input: Partial<ContractSettlementInput>) {
    if (input.waterUsage !== undefined && input.waterUsage !== null) {
      return Number(input.waterUsage || 0);
    }
    if (input.waterCurrentReading !== undefined && input.waterPreviousReading !== undefined) {
      const usage = Number(input.waterCurrentReading || 0) - Number(input.waterPreviousReading || 0);
      if (usage < 0) {
        throw new BadRequestException('SETTLEMENT_WATER_READING_INVALID');
      }
      return usage;
    }
    return null;
  }

  private calculateElectricityAmount(
    monthKwh: number,
    pricing: Awaited<ReturnType<HunonicService['getRoomElectricityPricing']>> | null,
  ) {
    if (!pricing || !Number.isFinite(monthKwh) || monthKwh <= 0) return null;

    if (pricing.currentMode === 'custom') {
      const customRateVnd = Number(pricing.customRateVnd || 0);
      if (!Number.isFinite(customRateVnd) || customRateVnd <= 0) return null;
      return Math.round(monthKwh * customRateVnd);
    }

    if (pricing.currentMode !== 'residential' || !Array.isArray(pricing.residentialSteps) || pricing.residentialSteps.length === 0) {
      return null;
    }

    let remaining = monthKwh;
    let total = 0;
    const steps = pricing.residentialSteps
      .map((step) => ({
        minRate: Number(step.minRate ?? 0),
        maxRate: step.maxRate === null || step.maxRate === undefined ? null : Number(step.maxRate),
        price: Number(step.price ?? 0),
      }))
      .filter((step) => Number.isFinite(step.price) && step.price > 0)
      .sort((a, b) => a.minRate - b.minRate);

    for (const step of steps) {
      if (remaining <= 0) break;
      const lowerBound = Math.max(0, step.minRate);
      const upperBound = step.maxRate === null || !Number.isFinite(step.maxRate) ? Number.POSITIVE_INFINITY : Math.max(lowerBound, step.maxRate);
      const capacity = upperBound === Number.POSITIVE_INFINITY ? remaining : Math.max(0, upperBound - lowerBound);
      if (capacity <= 0) continue;
      const usage = Math.min(remaining, capacity);
      total += usage * step.price;
      remaining -= usage;
    }

    if (remaining > 0 && steps.length > 0) {
      total += remaining * steps[steps.length - 1].price;
    }

    return Math.round(total);
  }

  private applyManualElectricityClosingKwh(electricitySnapshot: any, closingKwh: number) {
    const normalizedClosingKwh = this.roundMoney(Number(closingKwh || 0));
    const calculatedAmountVnd = this.calculateElectricityAmount(
      normalizedClosingKwh,
      {
        currentMode:
          electricitySnapshot?.rateMode === 'custom'
            ? 'custom'
            : electricitySnapshot?.rateMode === 'residential'
              ? 'residential'
              : null,
        customRateVnd: electricitySnapshot?.customRateVnd ?? null,
        residentialSteps: electricitySnapshot?.residentialSteps || [],
      } as Awaited<ReturnType<HunonicService['getRoomElectricityPricing']>>,
    );

    return {
      ...electricitySnapshot,
      closingKwh: normalizedClosingKwh,
      monthKwh: normalizedClosingKwh,
      calculatedAmountVnd:
        calculatedAmountVnd !== null && calculatedAmountVnd !== undefined
          ? calculatedAmountVnd
          : Number(electricitySnapshot?.calculatedAmountVnd || electricitySnapshot?.monthAmountVnd || 0),
      source: 'MANUAL_MOVE_OUT_READING',
      readingAt: electricitySnapshot?.readingAt || new Date(),
    };
  }

  private buildSettlementSnapshot(utilitySnapshot: { electricity: any | null; water?: any | null }, actualMoveOutDate?: Date) {
    if (!utilitySnapshot?.electricity && !utilitySnapshot?.water) {
      return {
        capturedAt: (actualMoveOutDate || new Date()).toISOString(),
        electricity: null,
        water: null,
      };
    }

    return {
      capturedAt: (actualMoveOutDate || new Date()).toISOString(),
      electricity: utilitySnapshot.electricity ? {
        meterId: utilitySnapshot.electricity.meterId,
        providerMeterId: utilitySnapshot.electricity.providerMeterId,
        displayName: utilitySnapshot.electricity.displayName,
        deviceName: utilitySnapshot.electricity.deviceName,
        currentMonth: utilitySnapshot.electricity.currentMonth,
        closingKwh: Number(
          utilitySnapshot.electricity.closingKwh ?? (utilitySnapshot.electricity.monthKwh || 0),
        ),
        monthKwh: Number(utilitySnapshot.electricity.monthKwh || 0),
        monthAmountVnd: Number(utilitySnapshot.electricity.monthAmountVnd || 0),
        calculatedAmountVnd: Number(utilitySnapshot.electricity.calculatedAmountVnd || 0),
        rateMode: utilitySnapshot.electricity.rateMode,
        customRateVnd: utilitySnapshot.electricity.customRateVnd,
        residentialSteps: utilitySnapshot.electricity.residentialSteps || [],
        powerCurrentW: Number(utilitySnapshot.electricity.powerCurrentW || 0),
        readingAt: utilitySnapshot.electricity.readingAt,
        source: utilitySnapshot.electricity.source,
        calculationSource: utilitySnapshot.electricity.calculationSource,
      } : null,
      water: utilitySnapshot.water ? {
        previousReading: Number(utilitySnapshot.water.previousReading || 0),
        currentReading: Number(utilitySnapshot.water.currentReading || 0),
        usage: Number(utilitySnapshot.water.usage || 0),
        unitPrice: Number(utilitySnapshot.water.unitPrice || 0),
        amount: Number(utilitySnapshot.water.amount || 0),
        source: utilitySnapshot.water.source,
      } : null,
    };
  }

  private getSettlementPeriod(moveOutDate: Date) {
    return `${moveOutDate.getFullYear()}-${String(moveOutDate.getMonth() + 1).padStart(2, '0')}`;
  }

  private buildRefundReceiptCode(contractCode: string) {
    return `${this.buildRefundReceiptPrefix(contractCode)}${Date.now()}`;
  }

  private buildRefundReceiptPrefix(contractCode: string) {
    const normalizedCode = String(contractCode || 'CONTRACT').replace(/[^A-Z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toUpperCase();
    return `RCT-${normalizedCode}-`;
  }
}
