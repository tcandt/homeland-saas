import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DepositsService } from './deposits.service';
import { DepositCoreService } from './deposit-core.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { CreateDepositSchema, UpdateDepositSchema, CollectDepositSchema, RefundDepositSchema, CancelDepositSchema, PaginationSchema, ConvertDepositToSecuritySchema, CoreCancelDepositSchema, CompleteCoreRefundSchema, RenewRoomHoldSchema, TransferRoomHoldSchema, ReleaseRoomHoldSchema, ExpireRoomHoldsSchema, ReverseDepositLedgerSchema } from './deposits.dto';

@ApiTags('Deposits')
@ApiBearerAuth()
@Controller('deposits')
export class DepositsController {
  constructor(
    private readonly depositsService: DepositsService,
    private readonly depositCoreService: DepositCoreService,
  ) {}

  @Get('stats')
  @RequirePermissions('deposit.read')
  @ApiOperation({ summary: 'Get deposits KPI & pipeline stats' })
  @ApiQuery({ name: 'buildingId', required: false })
  getStats(
    @CurrentUser('tenantId') tenantId: string,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.depositsService.getDepositStats(tenantId, buildingId);
  }

  @Get()
  @RequirePermissions('deposit.read')
  @ApiOperation({ summary: 'List deposits' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  list(
    @Query() query: any,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const { page, limit, search, sort, order } = PaginationSchema.parse(query);
    const status = query.status;
    const type = query.type;
    const buildingId = query.buildingId;
    return this.depositsService.listDeposits(page, limit, search, status, type, sort, order, buildingId, tenantId);
  }

  @Get('operations/status')
  @RequirePermissions('deposit.read')
  @ApiOperation({ summary: 'Get deposit command status by idempotency key' })
  getOperationStatus(
    @Query('idempotencyKey') idempotencyKey: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.depositCoreService.getOperationStatus(tenantId, idempotencyKey);
  }

  @Get('rental-cycles/:rentalCycleId/finance-summary')
  @RequirePermissions('deposit.read')
  @ApiOperation({ summary: 'Get authoritative finance summary for one rental cycle' })
  getRentalCycleFinanceSummary(
    @Param('rentalCycleId') rentalCycleId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.depositCoreService.getRentalCycleFinanceSummary(tenantId, rentalCycleId);
  }

  @Get('rooms/:roomId/finance-summary')
  @RequirePermissions('deposit.read')
  @ApiOperation({ summary: 'Get authoritative room finance summary across rental cycles' })
  getRoomFinanceSummary(
    @Param('roomId') roomId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.depositCoreService.getRoomFinanceSummary(tenantId, roomId);
  }

  @Post('holds/expire')
  @RequirePermissions('deposit.update')
  @ApiOperation({ summary: 'Expire due room holds without changing money balances' })
  expireHolds(
    @Body() body: any,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const input = ExpireRoomHoldsSchema.parse(body || {});
    return this.depositCoreService.expireHolds(tenantId, input.asOf, userId);
  }

  @Post('ledger/:entryId/reverse')
  @RequirePermissions('deposit.refund')
  @ApiOperation({ summary: 'Reverse one immutable deposit ledger entry' })
  reverseLedgerEntry(
    @Param('entryId') entryId: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const input = ReverseDepositLedgerSchema.parse(body);
    return this.depositCoreService.reverseLedgerEntry(tenantId, entryId, {
      idempotencyKey: idempotencyHeader || input.idempotencyKey || '',
      reason: input.reason,
    }, userId);
  }

  @Get(':id')
  @RequirePermissions('deposit.read')
  @ApiOperation({ summary: 'Get deposit details' })
  getDetail(@Param('id') id: string) {
    return this.depositsService.getDetail(id);
  }

  @Post('cleanup-orphans')
  @RequirePermissions('deposit.delete')
  @ApiOperation({ summary: 'Clean up orphaned and invalid deposits' })
  cleanupOrphans(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.depositsService.cleanupOrphanDeposits(tenantId, userId);
  }

  @Post()
  @RequirePermissions('deposit.create')
  @ApiOperation({ summary: 'Create deposit' })
  create(
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const input = CreateDepositSchema.parse(body);
    const status = input.status || (body?.status as any) || 'PENDING';
    return this.depositCoreService.create(tenantId, {
      code: input.code,
      roomId: input.roomId,
      customerId: input.customerId,
      contractId: input.contractId,
      rentalCycleId: input.rentalCycleId,
      type: input.type,
      amount: input.amount,
      expiredAt: input.expiredAt,
      note: input.note,
      status,
      idempotencyKey: idempotencyHeader || body?.idempotencyKey || '',
    }, userId);
  }

  @Patch(':id')
  @RequirePermissions('deposit.update')
  @ApiOperation({ summary: 'Update deposit' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = UpdateDepositSchema.parse(body);
    return this.depositsService.update(id, input, userId, 'Deposits');
  }

  @Delete(':id')
  @RequirePermissions('deposit.delete')
  @ApiOperation({ summary: 'Soft delete deposit' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.depositsService.softDelete(id, userId, 'Deposits');
  }

  @Post(':id/collect')
  @RequirePermissions('deposit.collect')
  @ApiOperation({ summary: 'Collect deposit' })
  collect(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('id') userId: string,
  ) {
    const input = CollectDepositSchema.parse(body);
    return this.depositsService.collect(
      id,
      input.note || null,
      userId,
      idempotencyHeader || input.idempotencyKey || '',
      input.holdExpiresAt || null,
    );
  }

  @Post(':id/hold/renew')
  @RequirePermissions('deposit.update')
  @ApiOperation({ summary: 'Extend an active room hold' })
  renewHold(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const input = RenewRoomHoldSchema.parse(body);
    return this.depositCoreService.renewHold(tenantId, id, {
      idempotencyKey: idempotencyHeader || input.idempotencyKey || '',
      expiresAt: input.expiresAt,
    }, userId);
  }

  @Post(':id/hold/transfer')
  @RequirePermissions('deposit.update')
  @ApiOperation({ summary: 'Move an active hold to another room atomically' })
  transferHold(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const input = TransferRoomHoldSchema.parse(body);
    return this.depositCoreService.transferHold(tenantId, id, {
      idempotencyKey: idempotencyHeader || input.idempotencyKey || '',
      targetRoomId: input.targetRoomId,
      expiresAt: input.expiresAt,
    }, userId);
  }

  @Post(':id/hold/release')
  @RequirePermissions('deposit.cancel')
  @ApiOperation({ summary: 'Release one active room hold without mutating its deposit ledger' })
  releaseHold(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const input = ReleaseRoomHoldSchema.parse(body);
    return this.depositCoreService.releaseHold(tenantId, id, {
      idempotencyKey: idempotencyHeader || input.idempotencyKey || '',
      reason: input.reason,
    }, userId);
  }

  @Post(':id/refund')
  @RequirePermissions('deposit.refund')
  @ApiOperation({ summary: 'Refund deposit' })
  refund(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('id') userId: string,
  ) {
    const input = RefundDepositSchema.parse(body);
    return this.depositsService.refund(id, input.reason!, userId, input.receiptStatus, input.attachmentUrls, input.refundAmount, idempotencyHeader || input.idempotencyKey);
  }

  @Post(':id/refund/complete')
  @RequirePermissions('deposit.refund')
  @ApiOperation({ summary: 'Complete a pending deposit refund' })
  completePendingRefund(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('id') userId: string,
  ) {
    return this.depositsService.completePendingRefund(id, userId, body?.note, idempotencyHeader || body?.idempotencyKey);
  }

  @Post(':id/cancel')
  @RequirePermissions('deposit.cancel')
  @ApiOperation({ summary: 'Cancel deposit' })
  cancel(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('id') userId: string,
  ) {
    const input = CancelDepositSchema.parse(body);
    return this.depositsService.cancel(
      id,
      input.reason,
      userId,
      input.resolutionAction,
      input.resolutionAmount,
      input.receiptStatus,
      input.attachmentUrls,
      idempotencyHeader || input.idempotencyKey,
    );
  }

  @Post(':id/convert-contract')
  @RequirePermissions('deposit.convert')
  @ApiOperation({ summary: 'Atomically convert booking deposit to security deposit' })
  convertToContract(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const input = ConvertDepositToSecuritySchema.parse(body);
    return this.depositCoreService.convertToSecurity(tenantId, id, {
      idempotencyKey: idempotencyHeader || input.idempotencyKey || '',
      securityRequired: input.securityRequired!,
      contractId: input.contractId,
      securityDepositId: input.securityDepositId,
      excessAction: input.excessAction,
      refundStatus: input.refundStatus,
    }, userId);
  }

  @Post(':id/commands/cancel')
  @RequirePermissions('deposit.cancel')
  @ApiOperation({ summary: 'Cancel deposit using immutable ledger allocations' })
  cancelCore(
    @Param('id') id: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const input = CoreCancelDepositSchema.parse(body);
    return this.depositCoreService.cancel(tenantId, id, {
      idempotencyKey: idempotencyHeader || input.idempotencyKey || '',
      reason: input.reason!,
      refundAmount: input.refundAmount,
      keepAmount: input.keepAmount,
      deductAmount: input.deductAmount,
      refundStatus: input.refundStatus,
    }, userId);
  }

  @Post('operations/:operationId/refund/complete')
  @RequirePermissions('deposit.refund')
  @ApiOperation({ summary: 'Complete one pending refund operation without duplicating cash-out' })
  completeCoreRefund(
    @Param('operationId') operationId: string,
    @Body() body: any,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    const input = CompleteCoreRefundSchema.parse(body);
    return this.depositCoreService.completePendingRefund(
      tenantId,
      operationId,
      idempotencyHeader || input.idempotencyKey || '',
      userId,
    );
  }
}
