import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { Contract, ContractStatus, DepositStatus, InvoiceItemType, InvoiceStatus, RoomStatus } from '@prisma/client';
import { ContractSettlementInput, PaginatedResult } from '@homeland/shared';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';
import { BaseCrudService } from '../shared/services/base-crud.service';
import { mapStatusFilter } from './contracts.adapter';
import { ContractsRepository } from './contracts.repository';

@Injectable()
export class ContractsService extends BaseCrudService<Contract> {
  constructor(
    repository: ContractsRepository,
    auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {
    super(repository, auditService, 'Contract');
  }

  async getDetail(id: string, include?: any): Promise<any> {
    const record = await super.getDetail(id, include);
    if (record.coRepresentativeIds && record.coRepresentativeIds.length > 0) {
      const coReps = await this.prisma.tx.customer.findMany({
        where: { id: { in: record.coRepresentativeIds } },
        select: { id: true, fullName: true, phone: true, identityNo: true, idImages: true },
      });
      return { ...record, coRepresentatives: coReps };
    }
    return record;
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
      customer: { select: { id: true, fullName: true, phone: true } },
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
    return this.buildSettlementPreview(contract, input);
  }

  async terminateContract(id: string, userId: string, input?: Partial<ContractSettlementInput>): Promise<Contract> {
    return this.finalizeContract(id, userId, ContractStatus.TERMINATED, input);
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
      ? this.buildSettlementPreview(contract, input as ContractSettlementInput)
      : this.buildSettlementPreview(contract, {
          actualMoveOutDate: new Date(),
          rentDaysCharged: 0,
        });

    const result = await this.prisma.tx.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id },
        data: { status: targetStatus },
      });

      const updatedRoom = await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.CLEANING },
      });

      const invoice = await tx.invoice.create({
        data: {
          tenantId: contract.tenantId,
          code: `FIN-${Date.now()}`,
          contractId: contract.id,
          customerId: contract.customerId,
          status: InvoiceStatus.DRAFT,
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
      });

      return { updatedContract, updatedRoom, invoice };
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
      },
      userId,
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
    const waterAmount = this.roundMoney(input.waterAmount ?? 0);
    const serviceAmount = this.roundMoney(input.serviceAmount ?? 0);
    const damageFee = this.roundMoney(input.damageFee ?? 0);
    const penaltyFee = this.roundMoney(input.penaltyFee ?? 0);
    const otherChargeAmount = this.roundMoney(input.otherChargeAmount ?? 0);
    const roomRefundAmount = this.roundMoney(input.roomRefundAmount ?? 0);
    const waterSupportAmount = this.roundMoney(input.waterSupportAmount ?? 0);
    const otherCreditAmount = this.roundMoney(input.otherCreditAmount ?? 0);
    const depositToRefund = this.roundMoney(input.depositToRefund ?? 0);
    const depositToDeduct = this.roundMoney(input.depositToDeduct ?? 0);

    const chargeLines = [
      { key: 'rentChargeAmount', type: 'RENT' as InvoiceItemType, description: `Final rent settlement (${rentDaysCharged} days)`, amount: rentChargeAmount },
      { key: 'electricityAmount', type: 'UTILITY_ELECTRICITY' as InvoiceItemType, description: 'Final electricity charge', amount: electricityAmount },
      { key: 'waterAmount', type: 'UTILITY_WATER' as InvoiceItemType, description: 'Final water charge', amount: waterAmount },
      { key: 'serviceAmount', type: 'SERVICE' as InvoiceItemType, description: 'Outstanding service charge', amount: serviceAmount },
      { key: 'damageFee', type: 'PENALTY' as InvoiceItemType, description: 'Damage compensation', amount: damageFee },
      { key: 'penaltyFee', type: 'PENALTY' as InvoiceItemType, description: 'Early termination penalty', amount: penaltyFee },
      { key: 'otherChargeAmount', type: 'OTHER' as InvoiceItemType, description: 'Other final charge', amount: otherChargeAmount },
      { key: 'depositToDeduct', type: 'OTHER' as InvoiceItemType, description: 'Deposit deduction against debt', amount: depositToDeduct },
    ].filter((line) => line.amount > 0);

    const creditLines = [
      { key: 'roomRefundAmount', description: 'Room refund', amount: roomRefundAmount },
      { key: 'waterSupportAmount', description: 'Water support', amount: waterSupportAmount },
      { key: 'otherCreditAmount', description: 'Other credit', amount: otherCreditAmount },
      { key: 'depositToRefund', description: 'Deposit refund', amount: depositToRefund },
    ].filter((line) => line.amount > 0);

    const chargeTotal = this.roundMoney(chargeLines.reduce((sum, line) => sum + line.amount, 0));
    const creditTotal = this.roundMoney(creditLines.reduce((sum, line) => sum + line.amount, 0));
    const netReceivable = this.roundMoney(Math.max(chargeTotal - creditTotal, 0));
    const refundToCustomer = this.roundMoney(Math.max(creditTotal - chargeTotal, 0));

    return {
      contract: {
        id: contract.id,
        code: contract.code,
        customerId: contract.customerId,
        roomId: contract.roomId,
      },
      actualMoveOutDate,
      assumptions: {
        monthlyRent,
        dailyRent: this.roundMoney(dailyRent),
        rentDaysCharged,
        note: input.note || null,
      },
      charges: chargeLines,
      credits: creditLines,
      invoiceItems: chargeLines.map(({ key, ...line }) => line),
      totals: {
        chargeTotal,
        creditTotal,
        netReceivable,
        refundToCustomer,
      },
    };
  }

  private roundMoney(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}
