import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DepositsService } from './deposits.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { CreateDepositSchema, UpdateDepositSchema, CollectDepositSchema, RefundDepositSchema, CancelDepositSchema, PaginationSchema } from './deposits.dto';

@ApiTags('Deposits')
@ApiBearerAuth()
@Controller('deposits')
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

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
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    const input = CreateDepositSchema.parse(body);
    // Note: generate code on backend if not provided. In real world, generate sequence.
    const code = input.code || `DEP-${Math.floor(Math.random() * 1000000)}`;
    const status = input.status || (body?.status as any) || 'PENDING';
    const createInput = { ...input, code, status };
    return this.depositsService.create(createInput, userId, 'Deposits');
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
  collect(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = CollectDepositSchema.parse(body);
    return this.depositsService.collect(id, input.note || null, userId);
  }

  @Post(':id/refund')
  @RequirePermissions('deposit.refund')
  @ApiOperation({ summary: 'Refund deposit' })
  refund(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = RefundDepositSchema.parse(body);
    return this.depositsService.refund(id, input.reason, userId, input.receiptStatus, input.attachmentUrls, input.refundAmount);
  }

  @Post(':id/refund/complete')
  @RequirePermissions('deposit.refund')
  @ApiOperation({ summary: 'Complete a pending deposit refund' })
  completePendingRefund(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    return this.depositsService.completePendingRefund(id, userId, body?.note);
  }

  @Post(':id/cancel')
  @RequirePermissions('deposit.cancel')
  @ApiOperation({ summary: 'Cancel deposit' })
  cancel(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = CancelDepositSchema.parse(body);
    return this.depositsService.cancel(
      id,
      input.reason,
      userId,
      input.resolutionAction,
      input.resolutionAmount,
      input.receiptStatus,
      input.attachmentUrls,
    );
  }

  @Post(':id/convert-contract')
  @RequirePermissions('deposit.convert')
  @ApiOperation({ summary: 'Convert deposit to contract' })
  convertToContract(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.depositsService.convertToContract(id, userId);
  }
}
