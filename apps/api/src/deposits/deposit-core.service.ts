import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  DepositLedgerEntryType,
  DepositOperationStatus,
  DepositOperationType,
  DepositStatus,
  DepositType,
  Prisma,
  ReceiptStatus,
  RentalCycleStatus,
  RoomHoldKind,
  RoomHoldStatus,
  RoomRentalType,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import {
  buildDepositCancellationPlan,
  buildDepositConversionPlan,
  DepositExcessAction,
} from './deposit-core.policy';
import { summarizeAuthoritativeFinance } from './finance-summary.policy';

type TransactionClient = any;

export interface CollectDepositCommand {
  idempotencyKey: string;
  note?: string | null;
  holdExpiresAt?: string | Date | null;
}

export interface ConvertDepositCommand {
  idempotencyKey: string;
  securityRequired: number;
  contractId?: string | null;
  securityDepositId?: string | null;
  excessAction?: DepositExcessAction;
  refundStatus?: 'PENDING' | 'COMPLETED';
}

export interface CancelDepositCommand {
  idempotencyKey: string;
  reason: string;
  refundAmount?: number;
  keepAmount?: number;
  deductAmount?: number;
  refundStatus?: 'PENDING' | 'COMPLETED';
}

export interface RenewRoomHoldCommand {
  idempotencyKey: string;
  expiresAt: string | Date;
}

export interface TransferRoomHoldCommand {
  idempotencyKey: string;
  targetRoomId: string;
  expiresAt?: string | Date | null;
}

export interface ReleaseRoomHoldCommand {
  idempotencyKey: string;
  reason: string;
}

export interface ReverseDepositLedgerCommand {
  idempotencyKey: string;
  reason: string;
}

@Injectable()
export class DepositCoreService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationStatus(tenantId: string, idempotencyKey: string) {
    const key = this.requireIdempotencyKey(idempotencyKey);
    const operation = await this.prisma.tx.depositOperation.findFirst({
      where: { tenantId, idempotencyKey: key },
      select: {
        id: true,
        rentalCycleId: true,
        sourceDepositId: true,
        targetDepositId: true,
        contractId: true,
        type: true,
        status: true,
        result: true,
        errorCode: true,
        receiptId: true,
        createdAt: true,
        completedAt: true,
      },
    });
    if (!operation) throw new BadRequestException('DEPOSIT_OPERATION_NOT_FOUND');
    return operation;
  }

  async getBalance(tenantId: string, depositId: string) {
    const aggregate = await this.prisma.tx.depositLedgerEntry.aggregate({
      where: { tenantId, depositId },
      _sum: { balanceEffect: true },
    });
    return this.toMoney(aggregate?._sum?.balanceEffect || 0);
  }

  async collect(tenantId: string, depositId: string, input: CollectDepositCommand, userId: string) {
    const command = this.normalizeCommand(input);
    const result = await this.runSerializable(async (tx: TransactionClient) => {
      await this.lockCommand(tx, tenantId, command.idempotencyKey);
      const replay = await this.getReplay(tx, tenantId, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      await this.lockDeposit(tx, tenantId, depositId);

      const deposit = await tx.deposit.findFirst({
        where: { id: depositId, tenantId, deletedAt: null },
        include: { room: true, rentalCycle: true },
      });
      if (!deposit) throw new BadRequestException('DEPOSIT_NOT_FOUND');
      if (!deposit.rentalCycleId) throw new BadRequestException('DEPOSIT_RENTAL_CYCLE_REQUIRED');
      if (![DepositStatus.DRAFT, DepositStatus.PENDING].includes(deposit.status)) {
        throw new ConflictException('DEPOSIT_ALREADY_PROCESSED');
      }
      if (this.toMoney(deposit.amount) <= 0) {
        throw new BadRequestException('DEPOSIT_AMOUNT_INVALID');
      }
      const currentBalance = await this.getBalanceInTransaction(tx, tenantId, deposit.id);
      const collectionAmount = this.toMoney(this.toMoney(deposit.amount) - currentBalance);
      if (collectionAmount <= 0) throw new ConflictException('DEPOSIT_ALREADY_FUNDED');

      const operation = await tx.depositOperation.create({
        data: {
          tenantId,
          rentalCycleId: deposit.rentalCycleId,
          sourceDepositId: deposit.id,
          contractId: deposit.contractId,
          type: DepositOperationType.COLLECT,
          status: DepositOperationStatus.PENDING,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          createdBy: userId,
        },
      });

      const hold = [DepositType.BOOKING, DepositType.RESERVATION].includes(deposit.type)
        ? await this.ensureActiveHold(tx, tenantId, deposit, command.input.holdExpiresAt, userId, command.idempotencyKey)
        : null;

      await tx.depositLedgerEntry.create({
        data: {
          tenantId,
          rentalCycleId: deposit.rentalCycleId,
          depositId: deposit.id,
          contractId: deposit.contractId,
          operationId: operation.id,
          type: DepositLedgerEntryType.CASH_IN,
          amount: collectionAmount,
          balanceEffect: collectionAmount,
          idempotencyKey: `${command.idempotencyKey}:cash-in`,
          sourceType: 'DEPOSIT_COLLECTION',
          sourceId: deposit.id,
          metadata: { note: command.input.note || null },
          createdBy: userId,
        },
      });

      const changed = await tx.deposit.updateMany({
        where: { id: deposit.id, tenantId, status: { in: [DepositStatus.DRAFT, DepositStatus.PENDING] } },
        data: { status: DepositStatus.PAID, note: command.input.note || deposit.note },
      });
      if (changed.count !== 1) throw new ConflictException('DEPOSIT_CONCURRENT_UPDATE');

      await tx.rentalCycle.updateMany({
        where: { id: deposit.rentalCycleId, tenantId, status: { in: [RentalCycleStatus.PLANNED, RentalCycleStatus.RESERVED] } },
        data: { status: RentalCycleStatus.RESERVED },
      });

      const response = {
        operationId: operation.id,
        depositId: deposit.id,
        rentalCycleId: deposit.rentalCycleId,
        collectedAmount: collectionAmount,
        balance: this.toMoney(currentBalance + collectionAmount),
        holdId: hold?.id || null,
        status: DepositStatus.PAID,
      };
      await this.enqueueOutbox(tx, tenantId, operation.id, 'deposit.collected', {
        tenantId,
        userId,
        customerId: deposit.customerId,
        roomId: deposit.roomId,
        rentalCycleId: deposit.rentalCycleId,
        sourceId: deposit.id,
        sourceType: 'DEPOSIT',
        amount: collectionAmount,
        occurredAt: new Date().toISOString(),
        metadata: { code: deposit.code, operationId: operation.id },
      });
      await this.completeOperation(tx, tenantId, operation.id, response);
      await this.writeAudit(tx, tenantId, userId, 'COLLECT', deposit.id, deposit, response);
      return response;
    });

    return result;
  }

  async convertToSecurity(tenantId: string, bookingDepositId: string, input: ConvertDepositCommand, userId: string) {
    const command = this.normalizeCommand(input);
    return this.runSerializable(async (tx: TransactionClient) => {
      await this.lockCommand(tx, tenantId, command.idempotencyKey);
      const replay = await this.getReplay(tx, tenantId, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      await this.lockDeposit(tx, tenantId, bookingDepositId);

      const booking = await tx.deposit.findFirst({
        where: { id: bookingDepositId, tenantId, deletedAt: null },
        include: { rentalCycle: true },
      });
      if (!booking) throw new BadRequestException('DEPOSIT_NOT_FOUND');
      if (booking.type !== DepositType.BOOKING && booking.type !== DepositType.RESERVATION) {
        throw new BadRequestException('DEPOSIT_SOURCE_MUST_BE_BOOKING');
      }
      if (booking.status !== DepositStatus.PAID) {
        throw new BadRequestException('DEPOSIT_SOURCE_MUST_BE_PAID');
      }
      if (!booking.rentalCycleId) throw new BadRequestException('DEPOSIT_RENTAL_CYCLE_REQUIRED');

      const bookingBalance = await this.getBalanceInTransaction(tx, tenantId, booking.id);
      const plan = buildDepositConversionPlan(
        bookingBalance,
        command.input.securityRequired,
        command.input.excessAction,
      );

      const contract = command.input.contractId
        ? await tx.contract.findFirst({
            where: {
              id: command.input.contractId,
              tenantId,
              customerId: booking.customerId,
              roomId: booking.roomId,
              rentalCycleId: booking.rentalCycleId,
              deletedAt: null,
            },
          })
        : null;
      if (command.input.contractId && !contract) {
        throw new BadRequestException('DEPOSIT_CONTRACT_SCOPE_MISMATCH');
      }

      const operation = await tx.depositOperation.create({
        data: {
          tenantId,
          rentalCycleId: booking.rentalCycleId,
          sourceDepositId: booking.id,
          contractId: contract?.id || null,
          type: DepositOperationType.CONVERT_TO_SECURITY,
          status: DepositOperationStatus.PENDING,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          createdBy: userId,
        },
      });

      const security = await this.resolveSecurityDeposit(
        tx,
        tenantId,
        booking,
        operation.id,
        command.input.securityDepositId,
        contract?.id || null,
        plan.securityRequired,
      );
      await tx.depositOperation.update({
        where: { id: operation.id, tenantId },
        data: { targetDepositId: security.id },
      });

      if (plan.transferAmount > 0) {
        await tx.depositLedgerEntry.createMany({
          data: [
            this.ledgerData(tenantId, booking, operation.id, DepositLedgerEntryType.TRANSFER_OUT, plan.transferAmount, -plan.transferAmount, `${command.idempotencyKey}:transfer-out`, 'DEPOSIT_CONVERSION', security.id, userId, contract?.id),
            this.ledgerData(tenantId, security, operation.id, DepositLedgerEntryType.TRANSFER_IN, plan.transferAmount, plan.transferAmount, `${command.idempotencyKey}:transfer-in`, 'DEPOSIT_CONVERSION', booking.id, userId, contract?.id),
          ],
        });
      }

      let creditNoteId: string | null = null;
      let refundReceiptId: string | null = null;
      if (plan.excessAmount > 0 && plan.excessAction === 'CREDIT') {
        const credit = await tx.creditNote.create({
          data: {
            tenantId,
            customerId: booking.customerId,
            amount: plan.excessAmount,
            remainingAmount: plan.excessAmount,
            reason: `Phần dư chuyển cọc từ ${booking.code}`,
          },
        });
        creditNoteId = credit.id;
        await tx.depositLedgerEntry.create({
          data: this.ledgerData(tenantId, booking, operation.id, DepositLedgerEntryType.CREDIT, plan.excessAmount, -plan.excessAmount, `${command.idempotencyKey}:credit`, 'CREDIT_NOTE', credit.id, userId, contract?.id),
        });
      }

      if (plan.excessAmount > 0 && plan.excessAction === 'REFUND') {
        const refundStatus = command.input.refundStatus === 'COMPLETED' ? ReceiptStatus.COMPLETED : ReceiptStatus.PENDING;
        const receipt = await tx.receipt.create({
          data: {
            tenantId,
            code: `RCT-${booking.code}-EXCESS-${operation.id.slice(-8).toUpperCase()}`,
            amount: plan.excessAmount,
            status: refundStatus,
            description: `Hoàn phần dư khi chuyển cọc ${booking.code}`,
            date: new Date(),
          },
        });
        refundReceiptId = receipt.id;
        await tx.depositOperation.update({
          where: { id: operation.id, tenantId },
          data: { receiptId: receipt.id },
        });
        if (refundStatus === ReceiptStatus.COMPLETED) {
          await tx.depositLedgerEntry.create({
            data: this.ledgerData(tenantId, booking, operation.id, DepositLedgerEntryType.REFUND, plan.excessAmount, -plan.excessAmount, `${command.idempotencyKey}:refund`, 'RECEIPT', receipt.id, userId, contract?.id),
          });
        }
      }

      await tx.deposit.update({
        where: { id: booking.id, tenantId },
        data: { status: DepositStatus.CONVERTED_TO_CONTRACT, contractId: contract?.id || booking.contractId },
      });
      await tx.deposit.update({
        where: { id: security.id, tenantId },
        data: {
          status: plan.additionalCashRequired === 0 ? DepositStatus.PAID : DepositStatus.PENDING,
          contractId: contract?.id || security.contractId,
        },
      });
      await tx.roomHold.updateMany({
        where: { tenantId, rentalCycleId: booking.rentalCycleId, status: RoomHoldStatus.ACTIVE },
        data: {
          depositId: security.id,
        },
      });

      const response = {
        operationId: operation.id,
        rentalCycleId: booking.rentalCycleId,
        bookingDepositId: booking.id,
        securityDepositId: security.id,
        contractId: contract?.id || null,
        ...plan,
        creditNoteId,
        refundReceiptId,
        refundStatus: refundReceiptId ? (command.input.refundStatus || 'PENDING') : null,
        pending: Boolean(refundReceiptId && command.input.refundStatus !== 'COMPLETED'),
      };
      await this.enqueueOutbox(tx, tenantId, operation.id, 'deposit.converted_to_security', {
        tenantId,
        userId,
        customerId: booking.customerId,
        roomId: booking.roomId,
        rentalCycleId: booking.rentalCycleId,
        sourceId: booking.id,
        sourceType: 'DEPOSIT',
        amount: plan.transferAmount,
        occurredAt: new Date().toISOString(),
        metadata: response,
      });
      if (response.pending) {
        await tx.depositOperation.update({
          where: { id: operation.id, tenantId },
          data: { result: response },
        });
      } else {
        await this.completeOperation(tx, tenantId, operation.id, response);
      }
      await this.writeAudit(tx, tenantId, userId, 'CONVERT_CONTRACT', booking.id, booking, response);
      return response;
    });
  }

  async cancel(tenantId: string, depositId: string, input: CancelDepositCommand, userId: string) {
    const command = this.normalizeCommand(input);
    return this.runSerializable(async (tx: TransactionClient) => {
      await this.lockCommand(tx, tenantId, command.idempotencyKey);
      const replay = await this.getReplay(tx, tenantId, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      await this.lockDeposit(tx, tenantId, depositId);

      const deposit = await tx.deposit.findFirst({
        where: { id: depositId, tenantId, deletedAt: null },
      });
      if (!deposit) throw new BadRequestException('DEPOSIT_NOT_FOUND');
      if (!deposit.rentalCycleId) throw new BadRequestException('DEPOSIT_RENTAL_CYCLE_REQUIRED');
      if (deposit.status !== DepositStatus.PAID) throw new BadRequestException('DEPOSIT_SOURCE_MUST_BE_PAID');

      const availableBalance = await this.getBalanceInTransaction(tx, tenantId, deposit.id);
      const plan = buildDepositCancellationPlan({ availableBalance, ...command.input });
      const operation = await tx.depositOperation.create({
        data: {
          tenantId,
          rentalCycleId: deposit.rentalCycleId,
          sourceDepositId: deposit.id,
          contractId: deposit.contractId,
          type: DepositOperationType.CANCEL,
          status: DepositOperationStatus.PENDING,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          createdBy: userId,
        },
      });

      const entries: any[] = [];
      if (plan.keepAmount > 0) entries.push(this.ledgerData(tenantId, deposit, operation.id, DepositLedgerEntryType.KEEP, plan.keepAmount, -plan.keepAmount, `${command.idempotencyKey}:keep`, 'DEPOSIT_CANCELLATION', deposit.id, userId));
      if (plan.deductAmount > 0) entries.push(this.ledgerData(tenantId, deposit, operation.id, DepositLedgerEntryType.DEDUCT, plan.deductAmount, -plan.deductAmount, `${command.idempotencyKey}:deduct`, 'DEPOSIT_CANCELLATION', deposit.id, userId));

      let receiptId: string | null = null;
      const refundStatus = command.input.refundStatus === 'COMPLETED' ? ReceiptStatus.COMPLETED : ReceiptStatus.PENDING;
      if (plan.refundAmount > 0) {
        const receipt = await tx.receipt.create({
          data: {
            tenantId,
            code: `RCT-${deposit.code}-CANCEL-${operation.id.slice(-8).toUpperCase()}`,
            amount: plan.refundAmount,
            status: refundStatus,
            description: command.input.reason,
            date: new Date(),
          },
        });
        receiptId = receipt.id;
        if (refundStatus === ReceiptStatus.COMPLETED) {
          entries.push(this.ledgerData(tenantId, deposit, operation.id, DepositLedgerEntryType.REFUND, plan.refundAmount, -plan.refundAmount, `${command.idempotencyKey}:refund`, 'RECEIPT', receipt.id, userId));
        }
      }
      if (entries.length > 0) await tx.depositLedgerEntry.createMany({ data: entries });

      const isPendingRefund = plan.refundAmount > 0 && refundStatus === ReceiptStatus.PENDING;
      await tx.deposit.update({
        where: { id: deposit.id, tenantId },
        data: {
          status: DepositStatus.CANCELLED,
          note: command.input.reason,
        },
      });
      await tx.roomHold.updateMany({
        where: { tenantId, depositId: deposit.id, rentalCycleId: deposit.rentalCycleId, status: RoomHoldStatus.ACTIVE },
        data: {
          status: RoomHoldStatus.CANCELLED,
          activeResourceKey: null,
          releasedAt: new Date(),
          releaseReason: command.input.reason,
        },
      });

      if (deposit.type === DepositType.BOOKING || deposit.type === DepositType.RESERVATION) {
        await tx.rentalCycle.updateMany({
          where: {
            id: deposit.rentalCycleId,
            tenantId,
            status: { in: [RentalCycleStatus.PLANNED, RentalCycleStatus.RESERVED] },
          },
          data: { status: RentalCycleStatus.CANCELLED, actualEndAt: new Date(), closedReason: command.input.reason },
        });
      }

      const response = {
        operationId: operation.id,
        depositId: deposit.id,
        rentalCycleId: deposit.rentalCycleId,
        ...plan,
        receiptId,
        refundStatus: receiptId ? refundStatus : null,
        pending: isPendingRefund,
      };
      const cancellationEvent = plan.refundAmount > 0
        ? (isPendingRefund ? 'deposit.refund_requested' : 'deposit.refunded')
        : 'deposit.cancelled';
      await this.enqueueOutbox(tx, tenantId, operation.id, cancellationEvent, {
        tenantId,
        userId,
        customerId: deposit.customerId,
        roomId: deposit.roomId,
        rentalCycleId: deposit.rentalCycleId,
        sourceId: deposit.id,
        sourceType: 'DEPOSIT',
        amount: plan.refundAmount || plan.keepAmount || plan.deductAmount,
        occurredAt: new Date().toISOString(),
        metadata: response,
      });
      if (plan.deductAmount > 0) {
        await this.enqueueOutbox(tx, tenantId, operation.id, 'deposit.deducted', {
          tenantId,
          userId,
          customerId: deposit.customerId,
          roomId: deposit.roomId,
          rentalCycleId: deposit.rentalCycleId,
          sourceId: deposit.id,
          sourceType: 'DEPOSIT',
          amount: plan.deductAmount,
          occurredAt: new Date().toISOString(),
          metadata: { operationId: operation.id, reason: command.input.reason },
        });
      }
      if (receiptId) {
        await tx.depositOperation.update({ where: { id: operation.id, tenantId }, data: { receiptId } });
      }
      if (!isPendingRefund) await this.completeOperation(tx, tenantId, operation.id, response);
      else await tx.depositOperation.update({ where: { id: operation.id, tenantId }, data: { result: response } });
      await this.writeAudit(tx, tenantId, userId, 'CANCEL', deposit.id, deposit, response);
      return response;
    });
  }

  async renewHold(tenantId: string, depositId: string, input: RenewRoomHoldCommand, userId: string) {
    const command = this.normalizeCommand(input);
    return this.runSerializable(async (tx: TransactionClient) => {
      await this.lockCommand(tx, tenantId, command.idempotencyKey);
      const replay = await this.getReplay(tx, tenantId, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      await this.lockDeposit(tx, tenantId, depositId);

      const deposit = await tx.deposit.findFirst({ where: { id: depositId, tenantId, deletedAt: null } });
      if (!deposit) throw new BadRequestException('DEPOSIT_NOT_FOUND');
      if (!deposit.rentalCycleId) throw new BadRequestException('DEPOSIT_RENTAL_CYCLE_REQUIRED');
      await this.lockRoom(tx, tenantId, deposit.roomId);

      const now = new Date();
      await this.expireRoomHolds(tx, tenantId, deposit.roomId, now);
      const hold = await tx.roomHold.findFirst({
        where: {
          tenantId,
          depositId: deposit.id,
          rentalCycleId: deposit.rentalCycleId,
          status: RoomHoldStatus.ACTIVE,
          expiresAt: { gt: now },
        },
      });
      if (!hold) throw new BadRequestException('ROOM_HOLD_NOT_ACTIVE');
      const expiresAt = this.requireFutureDate(command.input.expiresAt, now);
      if (expiresAt <= new Date(hold.expiresAt)) throw new BadRequestException('ROOM_HOLD_RENEWAL_MUST_EXTEND');

      const operation = await tx.depositOperation.create({
        data: {
          tenantId,
          rentalCycleId: deposit.rentalCycleId,
          sourceDepositId: deposit.id,
          contractId: deposit.contractId,
          type: DepositOperationType.RENEW_HOLD,
          status: DepositOperationStatus.PENDING,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          createdBy: userId,
        },
      });
      await tx.roomHold.update({
        where: { id: hold.id },
        data: { expiresAt, releaseReason: null },
      });
      const response = {
        operationId: operation.id,
        holdId: hold.id,
        depositId: deposit.id,
        rentalCycleId: deposit.rentalCycleId,
        roomId: deposit.roomId,
        expiresAt,
        status: RoomHoldStatus.ACTIVE,
      };
      await this.completeOperation(tx, tenantId, operation.id, response);
      await this.writeAudit(tx, tenantId, userId, 'UPDATE', deposit.id, hold, response, 'RoomHold');
      return response;
    });
  }

  async transferHold(tenantId: string, depositId: string, input: TransferRoomHoldCommand, userId: string) {
    const command = this.normalizeCommand(input);
    return this.runSerializable(async (tx: TransactionClient) => {
      await this.lockCommand(tx, tenantId, command.idempotencyKey);
      const replay = await this.getReplay(tx, tenantId, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      await this.lockDeposit(tx, tenantId, depositId);

      const deposit = await tx.deposit.findFirst({ where: { id: depositId, tenantId, deletedAt: null } });
      if (!deposit) throw new BadRequestException('DEPOSIT_NOT_FOUND');
      if (!deposit.rentalCycleId) throw new BadRequestException('DEPOSIT_RENTAL_CYCLE_REQUIRED');
      if (deposit.status !== DepositStatus.PAID) throw new BadRequestException('DEPOSIT_SOURCE_MUST_BE_PAID');
      if (deposit.roomId === command.input.targetRoomId) throw new BadRequestException('ROOM_HOLD_TARGET_SAME_ROOM');
      const contractCount = await tx.contract.count({
        where: { tenantId, rentalCycleId: deposit.rentalCycleId, deletedAt: null },
      });
      if (contractCount > 0) throw new ConflictException('ROOM_HOLD_TRANSFER_CONTRACT_EXISTS');

      await this.lockRooms(tx, tenantId, [deposit.roomId, command.input.targetRoomId]);
      const now = new Date();
      await this.expireRoomHolds(tx, tenantId, deposit.roomId, now);
      await this.expireRoomHolds(tx, tenantId, command.input.targetRoomId, now);
      const sourceHold = await tx.roomHold.findFirst({
        where: {
          tenantId,
          depositId: deposit.id,
          rentalCycleId: deposit.rentalCycleId,
          roomId: deposit.roomId,
          status: RoomHoldStatus.ACTIVE,
          expiresAt: { gt: now },
        },
      });
      if (!sourceHold) throw new BadRequestException('ROOM_HOLD_NOT_ACTIVE');
      const targetRoom = await tx.room.findFirst({
        where: { id: command.input.targetRoomId, tenantId, deletedAt: null },
      });
      if (!targetRoom) throw new BadRequestException('ROOM_NOT_FOUND');
      await this.assertRoomCapacity(tx, tenantId, targetRoom, now);

      const expiresAt = command.input.expiresAt
        ? this.requireFutureDate(command.input.expiresAt, now)
        : new Date(sourceHold.expiresAt);
      if (expiresAt <= now) throw new BadRequestException('ROOM_HOLD_EXPIRY_INVALID');
      const operation = await tx.depositOperation.create({
        data: {
          tenantId,
          rentalCycleId: deposit.rentalCycleId,
          sourceDepositId: deposit.id,
          type: DepositOperationType.TRANSFER_HOLD,
          status: DepositOperationStatus.PENDING,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          createdBy: userId,
        },
      });

      await tx.roomHold.update({
        where: { id: sourceHold.id },
        data: {
          status: RoomHoldStatus.RELEASED,
          activeResourceKey: null,
          releasedAt: now,
          releaseReason: `TRANSFERRED_TO_ROOM:${targetRoom.id}`,
        },
      });
      await tx.deposit.updateMany({
        where: { tenantId, rentalCycleId: deposit.rentalCycleId, deletedAt: null },
        data: { roomId: targetRoom.id },
      });
      await tx.rentalCycle.update({
        where: { id: deposit.rentalCycleId },
        data: { roomId: targetRoom.id },
      });
      const whole = targetRoom.rentalType === RoomRentalType.WHOLE;
      const resourceKey = whole
        ? `${tenantId}:${targetRoom.id}:WHOLE`
        : `${tenantId}:${targetRoom.id}:SHARED:${deposit.rentalCycleId}`;
      const targetHold = await tx.roomHold.create({
        data: {
          tenantId,
          rentalCycleId: deposit.rentalCycleId,
          depositId: deposit.id,
          roomId: targetRoom.id,
          kind: whole ? RoomHoldKind.WHOLE : RoomHoldKind.SHARED_SLOT,
          resourceKey,
          activeResourceKey: resourceKey,
          status: RoomHoldStatus.ACTIVE,
          expiresAt,
          idempotencyKey: `${command.idempotencyKey}:hold`,
          createdBy: userId,
        },
      });
      const response = {
        operationId: operation.id,
        depositId: deposit.id,
        rentalCycleId: deposit.rentalCycleId,
        sourceHoldId: sourceHold.id,
        sourceRoomId: deposit.roomId,
        targetHoldId: targetHold.id,
        targetRoomId: targetRoom.id,
        expiresAt,
        status: RoomHoldStatus.ACTIVE,
      };
      await this.completeOperation(tx, tenantId, operation.id, response);
      await this.writeAudit(tx, tenantId, userId, 'UPDATE', deposit.id, sourceHold, response, 'RoomHold');
      return response;
    });
  }

  async releaseHold(tenantId: string, depositId: string, input: ReleaseRoomHoldCommand, userId: string) {
    const command = this.normalizeCommand(input);
    return this.runSerializable(async (tx: TransactionClient) => {
      await this.lockCommand(tx, tenantId, command.idempotencyKey);
      const replay = await this.getReplay(tx, tenantId, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      await this.lockDeposit(tx, tenantId, depositId);
      const deposit = await tx.deposit.findFirst({ where: { id: depositId, tenantId, deletedAt: null } });
      if (!deposit) throw new BadRequestException('DEPOSIT_NOT_FOUND');
      if (!deposit.rentalCycleId) throw new BadRequestException('DEPOSIT_RENTAL_CYCLE_REQUIRED');
      await this.lockRoom(tx, tenantId, deposit.roomId);
      const hold = await tx.roomHold.findFirst({
        where: {
          tenantId,
          depositId: deposit.id,
          rentalCycleId: deposit.rentalCycleId,
          status: RoomHoldStatus.ACTIVE,
        },
      });
      if (!hold) throw new BadRequestException('ROOM_HOLD_NOT_ACTIVE');
      const operation = await tx.depositOperation.create({
        data: {
          tenantId,
          rentalCycleId: deposit.rentalCycleId,
          sourceDepositId: deposit.id,
          contractId: deposit.contractId,
          type: DepositOperationType.RELEASE_HOLD,
          status: DepositOperationStatus.PENDING,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          createdBy: userId,
        },
      });
      const releasedAt = new Date();
      await tx.roomHold.update({
        where: { id: hold.id },
        data: {
          status: RoomHoldStatus.RELEASED,
          activeResourceKey: null,
          releasedAt,
          releaseReason: command.input.reason,
        },
      });
      const response = {
        operationId: operation.id,
        holdId: hold.id,
        depositId: deposit.id,
        rentalCycleId: deposit.rentalCycleId,
        roomId: deposit.roomId,
        releasedAt,
        reason: command.input.reason,
        status: RoomHoldStatus.RELEASED,
      };
      await this.completeOperation(tx, tenantId, operation.id, response);
      await this.writeAudit(tx, tenantId, userId, 'UPDATE', deposit.id, hold, response, 'RoomHold');
      return response;
    });
  }

  async expireHolds(tenantId: string, asOf: string | Date | undefined, userId: string) {
    const cutOff = asOf ? new Date(asOf) : new Date();
    if (Number.isNaN(cutOff.getTime())) throw new BadRequestException('ROOM_HOLD_EXPIRY_INVALID');
    return this.prisma.tx.$transaction(async (tx: TransactionClient) => {
      const changed = await tx.roomHold.updateMany({
        where: { tenantId, status: RoomHoldStatus.ACTIVE, expiresAt: { lte: cutOff } },
        data: {
          status: RoomHoldStatus.EXPIRED,
          activeResourceKey: null,
          releasedAt: cutOff,
          releaseReason: 'EXPIRED',
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          module: 'DepositsCore',
          entity: 'RoomHold',
          action: 'UPDATE',
          after: { asOf: cutOff, expiredCount: changed.count },
        },
      });
      return { asOf: cutOff, expiredCount: changed.count };
    });
  }

  async reverseLedgerEntry(tenantId: string, entryId: string, input: ReverseDepositLedgerCommand, userId: string) {
    const command = this.normalizeCommand(input);
    return this.runSerializable(async (tx: TransactionClient) => {
      await this.lockCommand(tx, tenantId, command.idempotencyKey);
      const replay = await this.getReplay(tx, tenantId, command.idempotencyKey, command.requestHash);
      if (replay) return replay;
      const entry = await tx.depositLedgerEntry.findFirst({ where: { id: entryId, tenantId } });
      if (!entry) throw new BadRequestException('DEPOSIT_LEDGER_ENTRY_NOT_FOUND');
      if (entry.type === DepositLedgerEntryType.REVERSAL) throw new BadRequestException('DEPOSIT_REVERSAL_OF_REVERSAL_FORBIDDEN');
      const sourceEntries = await tx.depositLedgerEntry.findMany({
        where: { tenantId, operationId: entry.operationId, type: { not: DepositLedgerEntryType.REVERSAL } },
        orderBy: { id: 'asc' },
      });
      if (!sourceEntries.length) throw new BadRequestException('DEPOSIT_LEDGER_OPERATION_EMPTY');
      if (sourceEntries.some((source: any) => ['CREDIT_NOTE', 'RECEIPT'].includes(source.sourceType))) {
        throw new BadRequestException('DEPOSIT_REVERSAL_DOCUMENT_WORKFLOW_REQUIRED');
      }
      await this.lockDeposits(tx, tenantId, sourceEntries.map((source: any) => source.depositId));
      const sourceEntryIds = sourceEntries.map((source: any) => source.id);
      const alreadyReversed = await tx.depositLedgerEntry.findFirst({
        where: { tenantId, reversalOfId: { in: sourceEntryIds } },
      });
      if (alreadyReversed) throw new ConflictException('DEPOSIT_LEDGER_ENTRY_ALREADY_REVERSED');
      const effectByDeposit = new Map<string, number>();
      for (const source of sourceEntries) {
        effectByDeposit.set(source.depositId, this.toMoney(
          (effectByDeposit.get(source.depositId) || 0) + this.toMoney(source.balanceEffect),
        ));
      }
      const balances: Record<string, number> = {};
      for (const [depositId, operationEffect] of effectByDeposit) {
        const currentBalance = await this.getBalanceInTransaction(tx, tenantId, depositId);
        const nextBalance = this.toMoney(currentBalance - operationEffect);
        if (nextBalance < 0) throw new BadRequestException('DEPOSIT_REVERSAL_NEGATIVE_BALANCE');
        balances[depositId] = nextBalance;
      }
      const operation = await tx.depositOperation.create({
        data: {
          tenantId,
          rentalCycleId: entry.rentalCycleId,
          sourceDepositId: entry.depositId,
          contractId: entry.contractId,
          type: DepositOperationType.REVERSE_LEDGER,
          status: DepositOperationStatus.PENDING,
          idempotencyKey: command.idempotencyKey,
          requestHash: command.requestHash,
          createdBy: userId,
        },
      });
      const reversalEntries = sourceEntries.map((source: any) => ({
          id: `dlr_${createHash('sha256').update(`${command.idempotencyKey}:${source.id}`).digest('hex').slice(0, 24)}`,
          tenantId,
          rentalCycleId: source.rentalCycleId,
          depositId: source.depositId,
          contractId: source.contractId,
          operationId: operation.id,
          type: DepositLedgerEntryType.REVERSAL,
          amount: Math.abs(this.toMoney(source.balanceEffect)),
          balanceEffect: -this.toMoney(source.balanceEffect),
          idempotencyKey: `${command.idempotencyKey}:reversal:${source.id}`,
          sourceType: 'LEDGER_REVERSAL',
          sourceId: source.id,
          reversalOfId: source.id,
          metadata: { reason: command.input.reason },
          createdBy: userId,
      }));
      await tx.depositLedgerEntry.createMany({ data: reversalEntries });
      const response = {
        operationId: operation.id,
        reversedOperationId: entry.operationId,
        selectedEntryId: entry.id,
        reversalEntries: reversalEntries.map((reversal: any) => ({
          id: reversal.id,
          reversedEntryId: reversal.reversalOfId,
          depositId: reversal.depositId,
          amount: reversal.amount,
          balanceEffect: reversal.balanceEffect,
        })),
        balances,
        reason: command.input.reason,
      };
      await this.enqueueOutbox(tx, tenantId, operation.id, 'deposit.ledger.reversed', {
        tenantId,
        userId,
        sourceId: entry.operationId,
        sourceType: 'DEPOSIT_LEDGER_OPERATION',
        amount: 0,
        occurredAt: new Date().toISOString(),
        metadata: response,
      });
      await this.completeOperation(tx, tenantId, operation.id, response);
      await this.writeAudit(tx, tenantId, userId, 'UPDATE', entry.operationId, sourceEntries, response, 'DepositLedgerOperation');
      return response;
    });
  }

  async getRentalCycleFinanceSummary(tenantId: string, rentalCycleId: string) {
    const cycle = await this.prisma.tx.rentalCycle.findFirst({
      where: { id: rentalCycleId, tenantId },
      include: this.financeRelations(tenantId),
    });
    if (!cycle) throw new BadRequestException('RENTAL_CYCLE_NOT_FOUND');
    return this.buildRentalCycleFinanceSummary(cycle);
  }

  /**
   * Room-level financial truth for the Finance tab and room directory. It is
   * intentionally a sum of independently payable invoice families, so a
   * credit or overpayment belonging to one tenant can never erase another
   * tenant's open balance in a shared room.
   */
  async getRoomFinanceSummary(tenantId: string, roomId: string) {
    const room = await this.prisma.tx.room.findFirst({
      where: { id: roomId, tenantId, deletedAt: null },
      select: { id: true, code: true, name: true, rentalType: true },
    });
    if (!room) throw new BadRequestException('ROOM_NOT_FOUND');
    const cycles = await this.prisma.tx.rentalCycle.findMany({
      where: { tenantId, roomId },
      include: this.financeRelations(tenantId),
      orderBy: { createdAt: 'desc' },
    });
    const summaries = cycles.map((cycle: any) => this.buildRentalCycleFinanceSummary(cycle));
    return {
      room,
      totals: {
        rentalCycles: summaries.length,
        invoiceTotal: this.sumMoney(summaries.map((summary: any) => summary.invoices.total)),
        cashReceived: this.sumMoney(summaries.map((summary: any) => summary.invoices.paid)),
        creditApplied: this.sumMoney(summaries.map((summary: any) => summary.invoices.credit)),
        creditAdjustments: this.sumMoney(summaries.map((summary: any) => summary.invoices.creditAdjustments)),
        writtenOff: this.sumMoney(summaries.map((summary: any) => summary.invoices.writtenOff)),
        outstanding: this.sumMoney(summaries.map((summary: any) => summary.invoices.outstanding)),
        depositBalance: this.sumMoney(summaries.map((summary: any) => summary.depositLedger.balance)),
      },
      rentalCycles: summaries,
    };
  }

  private financeRelations(tenantId: string): any {
    return {
      customer: { select: { id: true, tenantId: true, fullName: true, phone: true } },
      room: { select: { id: true, tenantId: true, code: true, name: true, rentalType: true } },
      contracts: {
        where: { tenantId, deletedAt: null },
        select: { id: true, code: true, tenantId: true, roomId: true, customerId: true, rentalCycleId: true, status: true, monthlyRent: true, depositMoney: true },
      },
      deposits: {
        where: { tenantId, deletedAt: null },
        select: { id: true, code: true, tenantId: true, roomId: true, customerId: true, rentalCycleId: true, type: true, status: true, amount: true, contractId: true },
      },
      invoices: {
        where: { tenantId, deletedAt: null },
        select: {
          id: true, code: true, tenantId: true, customerId: true, contractId: true, rentalCycleId: true,
          adjustmentOfInvoiceId: true, billingKind: true, status: true, total: true,
          paidAmount: true, creditAmount: true,
          allocations: {
            where: { tenantId, payment: { is: { tenantId } } },
            select: {
              id: true, paymentId: true, invoiceId: true, amount: true,
              payment: { select: { id: true, tenantId: true, status: true, deletedAt: true, provider: true } },
            },
          },
        },
      },
      payments: {
        where: { tenantId, deletedAt: null },
        select: { id: true, tenantId: true, rentalCycleId: true, invoiceId: true, status: true, amount: true, provider: true, paidAt: true },
      },
      depositLedgerEntries: {
        where: { tenantId },
        select: {
          id: true, tenantId: true, rentalCycleId: true, depositId: true, contractId: true,
          operationId: true, type: true, amount: true, balanceEffect: true, sourceType: true, sourceId: true, createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      depositOperations: {
        where: { tenantId, status: DepositOperationStatus.PENDING },
        select: { id: true, tenantId: true, rentalCycleId: true, sourceDepositId: true, targetDepositId: true, contractId: true, type: true, receiptId: true, result: true, createdAt: true },
      },
    };
  }

  private buildRentalCycleFinanceSummary(cycle: any) {
    this.assertFinanceCycleRelations(cycle);
    const authoritative = summarizeAuthoritativeFinance({
      invoices: cycle.invoices,
      depositLedgerEntries: cycle.depositLedgerEntries,
    });
    return {
      rentalCycleId: cycle.id,
      status: cycle.status,
      customer: cycle.customer ? { id: cycle.customer.id, fullName: cycle.customer.fullName, phone: cycle.customer.phone } : null,
      room: cycle.room ? { id: cycle.room.id, code: cycle.room.code, name: cycle.room.name, rentalType: cycle.room.rentalType } : null,
      contracts: cycle.contracts.map((contract: any) => ({
        id: contract.id,
        code: contract.code,
        status: contract.status,
        monthlyRent: this.toMoney(contract.monthlyRent),
        depositMoney: this.toMoney(contract.depositMoney),
        source: { entity: 'Contract', id: contract.id, code: contract.code || null },
      })),
      deposits: cycle.deposits.map((deposit: any) => ({
        id: deposit.id,
        code: deposit.code,
        type: deposit.type,
        status: deposit.status,
        contractId: deposit.contractId,
        amount: this.toMoney(deposit.amount),
        balance: authoritative.depositLedger.balances.get(deposit.id) || 0,
        source: { entity: 'Deposit', id: deposit.id, code: deposit.code || null },
      })),
      depositLedger: {
        totalsByType: authoritative.depositLedger.totalsByType,
        balance: authoritative.depositLedger.balance,
        sourceEntities: authoritative.depositLedger.sourceEntities,
        entries: cycle.depositLedgerEntries.map((entry: any) => ({
          id: entry.id,
          depositId: entry.depositId,
          contractId: entry.contractId,
          operationId: entry.operationId,
          type: entry.type,
          amount: this.toMoney(entry.amount),
          balanceEffect: this.toMoney(entry.balanceEffect),
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          createdAt: entry.createdAt,
          source: { entity: 'DepositLedgerEntry', id: entry.id, code: null },
          operationSource: { entity: 'DepositOperation', id: entry.operationId, code: null },
        })),
      },
      invoices: {
        ...authoritative.invoices,
      },
      payments: {
        // The aggregate is allocated confirmed cash, not raw Payment.amount.
        confirmed: authoritative.invoices.paid,
        items: cycle.payments.map((payment: any) => ({
          id: payment.id,
          invoiceId: payment.invoiceId,
          status: payment.status,
          provider: payment.provider,
          paidAt: payment.paidAt,
          amount: this.toMoney(payment.amount),
          source: { entity: 'Payment', id: payment.id, code: null },
          invoiceSource: { entity: 'Invoice', id: payment.invoiceId, code: null },
        })),
      },
      pendingOperations: cycle.depositOperations.map((operation: any) => ({
        id: operation.id,
        type: operation.type,
        receiptId: operation.receiptId,
        result: operation.result,
        createdAt: operation.createdAt,
        source: { entity: 'DepositOperation', id: operation.id, code: null },
      })),
    };
  }

  private assertFinanceCycleRelations(cycle: any) {
    const invalid =
      cycle.tenantId == null ||
      cycle.customer?.tenantId !== cycle.tenantId ||
      cycle.customer?.id !== cycle.customerId ||
      cycle.room?.tenantId !== cycle.tenantId ||
      cycle.room?.id !== cycle.roomId ||
      cycle.contracts.some((row: any) => row.tenantId !== cycle.tenantId || row.rentalCycleId !== cycle.id || row.customerId !== cycle.customerId || row.roomId !== cycle.roomId) ||
      cycle.deposits.some((row: any) => row.tenantId !== cycle.tenantId || row.rentalCycleId !== cycle.id || row.customerId !== cycle.customerId || row.roomId !== cycle.roomId) ||
      cycle.invoices.some((row: any) => row.tenantId !== cycle.tenantId || row.rentalCycleId !== cycle.id || row.customerId !== cycle.customerId) ||
      cycle.payments.some((row: any) => row.tenantId !== cycle.tenantId || row.rentalCycleId !== cycle.id) ||
      cycle.depositLedgerEntries.some((row: any) => row.tenantId !== cycle.tenantId || row.rentalCycleId !== cycle.id) ||
      cycle.depositOperations.some((row: any) => row.tenantId !== cycle.tenantId || row.rentalCycleId !== cycle.id);
    if (invalid) throw new BadRequestException('FINANCE_CYCLE_RELATION_INVARIANT_VIOLATION');
  }

  async completePendingRefund(tenantId: string, operationId: string, idempotencyKey: string, userId: string) {
    const normalizedKey = this.requireIdempotencyKey(idempotencyKey);
    return this.runSerializable(async (tx: TransactionClient) => {
      await this.lockCommand(tx, tenantId, normalizedKey);
      const completionRequestHash = this.hash({ operationId });
      const existingCompletion = await tx.depositOperation.findFirst({
        where: { tenantId, idempotencyKey: normalizedKey, type: DepositOperationType.COMPLETE_REFUND },
      });
      if (existingCompletion) {
        if (existingCompletion.requestHash !== completionRequestHash) {
          throw new ConflictException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
        }
        if (existingCompletion.status === DepositOperationStatus.COMPLETED) {
          return { ...(existingCompletion.result as Record<string, unknown>), replayed: true };
        }
        throw new ConflictException('DEPOSIT_OPERATION_IN_PROGRESS');
      }

      await this.lockOperation(tx, tenantId, operationId);
      const pending = await tx.depositOperation.findFirst({
        where: { id: operationId, tenantId, status: DepositOperationStatus.PENDING },
      });
      if (!pending?.receiptId) throw new BadRequestException('DEPOSIT_REFUND_PENDING_NOT_FOUND');
      const receipt = await tx.receipt.findFirst({
        where: { id: pending.receiptId, tenantId, status: ReceiptStatus.PENDING },
      });
      if (!receipt) throw new BadRequestException('DEPOSIT_REFUND_PENDING_NOT_FOUND');
      const availableBalance = await this.getBalanceInTransaction(tx, tenantId, pending.sourceDepositId);
      if (this.toMoney(receipt.amount) > availableBalance) {
        throw new BadRequestException('DEPOSIT_REFUND_EXCEEDS_BALANCE');
      }

      const completion = await tx.depositOperation.create({
        data: {
          tenantId,
          rentalCycleId: pending.rentalCycleId,
          sourceDepositId: pending.sourceDepositId,
          targetDepositId: pending.targetDepositId,
          contractId: pending.contractId,
          type: DepositOperationType.COMPLETE_REFUND,
          status: DepositOperationStatus.PENDING,
          idempotencyKey: normalizedKey,
          requestHash: completionRequestHash,
          receiptId: receipt.id,
          createdBy: userId,
        },
      });
      const completedReceipt = await tx.receipt.updateMany({
        where: { id: receipt.id, tenantId, status: ReceiptStatus.PENDING },
        data: { status: ReceiptStatus.COMPLETED },
      });
      if (completedReceipt.count !== 1) throw new ConflictException('DEPOSIT_REFUND_CONCURRENT_UPDATE');
      await tx.depositLedgerEntry.create({
        data: {
          tenantId,
          rentalCycleId: pending.rentalCycleId,
          depositId: pending.sourceDepositId,
          contractId: pending.contractId,
          operationId: completion.id,
          type: DepositLedgerEntryType.REFUND,
          amount: receipt.amount,
          balanceEffect: new Prisma.Decimal(receipt.amount).negated(),
          idempotencyKey: `${normalizedKey}:refund`,
          sourceType: 'RECEIPT',
          sourceId: receipt.id,
          createdBy: userId,
        },
      });

      const response = { operationId: completion.id, completedOperationId: pending.id, receiptId: receipt.id, amount: this.toMoney(receipt.amount), status: 'COMPLETED' };
      await this.enqueueOutbox(tx, tenantId, completion.id, 'deposit.refunded', {
        tenantId,
        userId,
        sourceId: pending.sourceDepositId,
        sourceType: 'DEPOSIT',
        amount: this.toMoney(receipt.amount),
        occurredAt: new Date().toISOString(),
        metadata: { operationId: completion.id, completedOperationId: pending.id, receiptId: receipt.id },
      });
      await this.completeOperation(tx, tenantId, completion.id, response);
      await this.completeOperation(tx, tenantId, pending.id, { ...(pending.result || {}), pending: false, refundStatus: 'COMPLETED' });
      return response;
    });
  }

  private async ensureActiveHold(tx: TransactionClient, tenantId: string, deposit: any, holdExpiresAt: string | Date | null | undefined, userId: string, idempotencyKey: string) {
    await this.lockRoom(tx, tenantId, deposit.roomId);
    const now = new Date();
    await this.expireRoomHolds(tx, tenantId, deposit.roomId, now);
    const existing = await tx.roomHold.findFirst({
      where: { tenantId, depositId: deposit.id, status: RoomHoldStatus.ACTIVE, expiresAt: { gt: now } },
    });
    if (existing) return existing;

    const room = deposit.room || await tx.room.findFirst({ where: { id: deposit.roomId, tenantId, deletedAt: null } });
    if (!room) throw new BadRequestException('ROOM_NOT_FOUND');
    await this.assertRoomCapacity(tx, tenantId, room, now);
    const whole = room.rentalType === RoomRentalType.WHOLE;
    const expiresAt = holdExpiresAt ? new Date(holdExpiresAt) : deposit.expiredAt ? new Date(deposit.expiredAt) : new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) throw new BadRequestException('ROOM_HOLD_EXPIRY_INVALID');
    const resourceKey = whole
      ? `${tenantId}:${room.id}:WHOLE`
      : `${tenantId}:${room.id}:SHARED:${deposit.rentalCycleId}`;
    return tx.roomHold.create({
      data: {
        tenantId,
        rentalCycleId: deposit.rentalCycleId,
        depositId: deposit.id,
        roomId: room.id,
        kind: whole ? RoomHoldKind.WHOLE : RoomHoldKind.SHARED_SLOT,
        resourceKey,
        activeResourceKey: resourceKey,
        status: RoomHoldStatus.ACTIVE,
        expiresAt,
        idempotencyKey: `${idempotencyKey}:hold`,
        createdBy: userId,
      },
    });
  }

  private async resolveSecurityDeposit(tx: TransactionClient, tenantId: string, booking: any, operationId: string, securityDepositId: string | null | undefined, contractId: string | null, requiredAmount: number) {
    if (securityDepositId) {
      const existing = await tx.deposit.findFirst({
        where: {
          id: securityDepositId,
          tenantId,
          rentalCycleId: booking.rentalCycleId,
          customerId: booking.customerId,
          roomId: booking.roomId,
          type: DepositType.SECURITY,
          deletedAt: null,
        },
      });
      if (!existing) throw new BadRequestException('SECURITY_DEPOSIT_SCOPE_MISMATCH');
      if (this.toMoney(existing.amount) !== requiredAmount) throw new BadRequestException('SECURITY_DEPOSIT_REQUIRED_AMOUNT_MISMATCH');
      const existingBalance = await this.getBalanceInTransaction(tx, tenantId, existing.id);
      if (existingBalance !== 0) throw new ConflictException('SECURITY_DEPOSIT_ALREADY_FUNDED');
      return existing;
    }
    return tx.deposit.create({
      data: {
        tenantId,
        code: `SEC-${booking.code}-${operationId.slice(-8).toUpperCase()}`,
        type: DepositType.SECURITY,
        roomId: booking.roomId,
        customerId: booking.customerId,
        contractId,
        rentalCycleId: booking.rentalCycleId,
        amount: requiredAmount,
        status: DepositStatus.PENDING,
        note: `Tạo từ phiếu cọc ${booking.code}`,
      },
    });
  }

  private ledgerData(tenantId: string, deposit: any, operationId: string, type: DepositLedgerEntryType, amount: number, effect: number, idempotencyKey: string, sourceType: string, sourceId: string, userId: string, contractId?: string | null) {
    return {
      tenantId,
      rentalCycleId: deposit.rentalCycleId,
      depositId: deposit.id,
      contractId: contractId || deposit.contractId || null,
      operationId,
      type,
      amount,
      balanceEffect: effect,
      idempotencyKey,
      sourceType,
      sourceId,
      createdBy: userId,
    };
  }

  private async getBalanceInTransaction(tx: TransactionClient, tenantId: string, depositId: string) {
    const aggregate = await tx.depositLedgerEntry.aggregate({ where: { tenantId, depositId }, _sum: { balanceEffect: true } });
    return this.toMoney(aggregate?._sum?.balanceEffect || 0);
  }

  private async getReplay(tx: TransactionClient, tenantId: string, idempotencyKey: string, requestHash: string) {
    const existing = await tx.depositOperation.findFirst({ where: { tenantId, idempotencyKey } });
    if (!existing) return null;
    if (existing.requestHash !== requestHash) throw new ConflictException('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    if (existing.status === DepositOperationStatus.COMPLETED) {
      return { ...(existing.result as Record<string, unknown>), replayed: true };
    }
    throw new ConflictException('DEPOSIT_OPERATION_IN_PROGRESS');
  }

  private async runSerializable<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.tx.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: any) {
        if (this.isSerializationConflict(error) && attempt < 3) continue;
        if (this.isSerializationConflict(error)) throw new ConflictException('DEPOSIT_CONCURRENT_UPDATE');
        throw error;
      }
    }
    throw new ConflictException('DEPOSIT_CONCURRENT_UPDATE');
  }

  private isSerializationConflict(error: any) {
    return error?.code === 'P2034'
      || (error?.code === 'P2010' && error?.meta?.code === '40001');
  }

  private async completeOperation(tx: TransactionClient, tenantId: string, operationId: string, result: any) {
    await tx.depositOperation.update({
      where: { id: operationId, tenantId },
      data: { status: DepositOperationStatus.COMPLETED, result, completedAt: new Date(), errorCode: null },
    });
  }

  private async lockCommand(tx: TransactionClient, tenantId: string, key: string) {
    const lockKey = `${tenantId}:deposit-command:${key}`;
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"`);
  }

  private async lockRoom(tx: TransactionClient, tenantId: string, roomId: string) {
    const rows = await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Room" WHERE "tenantId" = ${tenantId} AND "id" = ${roomId} AND "deletedAt" IS NULL FOR UPDATE`,
    ) as Array<{ id: string }>;
    if (!rows.length) throw new BadRequestException('ROOM_NOT_FOUND');
  }

  private async lockRooms(tx: TransactionClient, tenantId: string, roomIds: string[]) {
    for (const roomId of [...new Set(roomIds)].sort()) {
      await this.lockRoom(tx, tenantId, roomId);
    }
  }

  private async expireRoomHolds(tx: TransactionClient, tenantId: string, roomId: string, asOf: Date) {
    return tx.roomHold.updateMany({
      where: { tenantId, roomId, status: RoomHoldStatus.ACTIVE, expiresAt: { lte: asOf } },
      data: {
        status: RoomHoldStatus.EXPIRED,
        activeResourceKey: null,
        releasedAt: asOf,
        releaseReason: 'EXPIRED',
      },
    });
  }

  private async assertRoomCapacity(tx: TransactionClient, tenantId: string, room: any, now: Date) {
    const [occupancyCount, activeHoldCount] = await Promise.all([
      tx.occupancy.count({ where: { tenantId, roomId: room.id, leftAt: null } }),
      tx.roomHold.count({ where: { tenantId, roomId: room.id, status: RoomHoldStatus.ACTIVE, expiresAt: { gt: now } } }),
    ]);
    const whole = room.rentalType === RoomRentalType.WHOLE;
    if (whole && occupancyCount + activeHoldCount > 0) throw new ConflictException('ROOM_HOLD_CONFLICT');
    if (!whole && occupancyCount + activeHoldCount >= Math.max(Number(room.capacity || 1), 1)) {
      throw new ConflictException('ROOM_CAPACITY_EXCEEDED');
    }
  }

  private async lockDeposit(tx: TransactionClient, tenantId: string, depositId: string) {
    const rows = await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Deposit" WHERE "tenantId" = ${tenantId} AND "id" = ${depositId} AND "deletedAt" IS NULL FOR UPDATE`,
    ) as Array<{ id: string }>;
    if (!rows.length) throw new BadRequestException('DEPOSIT_NOT_FOUND');
  }

  private async lockDeposits(tx: TransactionClient, tenantId: string, depositIds: string[]) {
    for (const depositId of [...new Set(depositIds)].sort()) {
      await this.lockDeposit(tx, tenantId, depositId);
    }
  }

  private async lockOperation(tx: TransactionClient, tenantId: string, operationId: string) {
    const rows = await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "DepositOperation" WHERE "tenantId" = ${tenantId} AND "id" = ${operationId} FOR UPDATE`,
    ) as Array<{ id: string }>;
    if (!rows.length) throw new BadRequestException('DEPOSIT_OPERATION_NOT_FOUND');
  }

  private normalizeCommand<T extends { idempotencyKey: string }>(input: T) {
    const idempotencyKey = this.requireIdempotencyKey(input.idempotencyKey);
    const normalizedInput = { ...input, idempotencyKey };
    return { idempotencyKey, input: normalizedInput, requestHash: this.hash(normalizedInput) };
  }

  private requireIdempotencyKey(value: string) {
    const key = String(value || '').trim();
    if (key.length < 8 || key.length > 128) throw new BadRequestException('IDEMPOTENCY_KEY_INVALID');
    return key;
  }

  private hash(value: unknown) {
    return createHash('sha256').update(this.stableStringify(value)).digest('hex');
  }

  private stableStringify(value: any): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Prisma.Decimal.isDecimal(value)) return JSON.stringify(value.toFixed(2));
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`).join(',')}}`;
  }

  private toMoney(value: Prisma.Decimal | number | string) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  private sumMoney(values: Array<Prisma.Decimal | number | string>) {
    return this.toMoney(values.reduce<number>((sum, value) => sum + this.toMoney(value), 0));
  }

  private requireFutureDate(value: string | Date, now: Date) {
    const result = new Date(value);
    if (Number.isNaN(result.getTime()) || result <= now) throw new BadRequestException('ROOM_HOLD_EXPIRY_INVALID');
    return result;
  }

  private async enqueueOutbox(
    tx: TransactionClient,
    tenantId: string,
    operationId: string,
    eventName: string,
    payload: Record<string, unknown>,
  ) {
    await tx.outboxEvent.create({
      data: {
        tenantId,
        aggregateType: 'DepositOperation',
        aggregateId: operationId,
        eventName,
        payload,
        idempotencyKey: `deposit-operation:${operationId}:${eventName}`,
      },
    });
  }

  private async writeAudit(tx: TransactionClient, tenantId: string, userId: string, action: 'COLLECT' | 'CANCEL' | 'CONVERT_CONTRACT' | 'UPDATE', depositId: string, before: any, after: any, entity = 'Deposit') {
    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'DepositsCore',
        entity,
        entityId: depositId,
        action,
        before,
        after,
      },
    });
  }
}
