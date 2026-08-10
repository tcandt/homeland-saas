import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { CreateContractSchema, UpdateContractSchema, PaginationSchema, ContractSettlementInputSchema } from '@homeland/shared';
import { normalizeContractStatus } from './contracts.adapter';

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @RequirePermissions('contract.read')
  @ApiOperation({ summary: 'List contracts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'roomId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  list(@Query() query: any, @CurrentUser() user: any) {
    const { page, limit, search, sort, order } = PaginationSchema.parse(query);
    const { status, roomId, customerId } = query;
    return this.contractsService.listContracts(page, limit, search, status, roomId, customerId, sort, order, user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('contract.read')
  @ApiOperation({ summary: 'Get contract details' })
  getDetail(@Param('id') id: string) {
    return this.contractsService.getDetail(id, {
      customer: true,
      room: { include: { building: true, floor: true } },
    });
  }

  @Post()
  @RequirePermissions('contract.create')
  @ApiOperation({ summary: 'Create contract' })
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    const input = CreateContractSchema.parse(body);
    const data = {
      customerId: input.customerId,
      roomId: input.roomId,
      code: input.contractCode || `C-${Date.now()}`,
      status: normalizeContractStatus(input.status),
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      monthlyRent: input.rentAmount,
      depositMoney: input.depositAmount,
      signedAt: input.signedAt ? new Date(input.signedAt) : undefined,
      firstPaymentDate: input.firstPaymentDate ? new Date(input.firstPaymentDate) : undefined,
      purpose: input.purpose,
      attachments: input.attachments || [],
      coRepresentativeIds: input.coRepresentativeIds || [],
    };
    return this.contractsService.create(data, userId, 'Contracts');
  }

  @Patch(':id')
  @RequirePermissions('contract.update')
  @ApiOperation({ summary: 'Update contract' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = UpdateContractSchema.parse(body);
    const data: any = {};
    if (input.customerId) data.customerId = input.customerId;
    if (input.roomId) data.roomId = input.roomId;
    if (input.contractCode) data.code = input.contractCode;
    if (input.status) data.status = normalizeContractStatus(input.status);
    if (input.startDate) data.startDate = new Date(input.startDate);
    if (input.endDate) data.endDate = new Date(input.endDate);
    if (input.rentAmount !== undefined) data.monthlyRent = input.rentAmount;
    if (input.depositAmount !== undefined) data.depositMoney = input.depositAmount;
    if (input.signedAt) data.signedAt = new Date(input.signedAt);
    if (input.firstPaymentDate) data.firstPaymentDate = new Date(input.firstPaymentDate);
    if (input.purpose !== undefined) data.purpose = input.purpose;
    if (input.attachments !== undefined) data.attachments = input.attachments;
    if (input.coRepresentativeIds !== undefined) data.coRepresentativeIds = input.coRepresentativeIds;
    
    return this.contractsService.update(id, data, userId, 'Contracts');
  }

  @Delete(':id')
  @RequirePermissions('contract.delete')
  @ApiOperation({ summary: 'Soft delete contract' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.contractsService.softDelete(id, userId, 'Contracts');
  }

  @Post(':id/submit')
  @RequirePermissions('contract.update')
  @ApiOperation({ summary: 'Submit contract for approval' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.contractsService.submitContract(id, userId);
  }

  @Post(':id/approve')
  @RequirePermissions('contract.update')
  @ApiOperation({ summary: 'Approve contract' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.contractsService.approveContract(id, userId);
  }

  @Post(':id/activate')
  @RequirePermissions('contract.update')
  @ApiOperation({ summary: 'Activate contract' })
  activate(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.contractsService.activateContract(id, userId);
  }

  @Post(':id/terminate')
  @RequirePermissions('contract.update')
  @ApiOperation({ summary: 'Terminate contract' })
  terminate(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = body ? ContractSettlementInputSchema.partial().parse(body) : undefined;
    return this.contractsService.terminateContract(id, userId, input);
  }

  @Post(':id/expire')
  @RequirePermissions('contract.update')
  @ApiOperation({ summary: 'Expire contract' })
  expire(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.contractsService.expireContract(id, userId);
  }

  @Post(':id/settlement-preview')
  @RequirePermissions('contract.read')
  @ApiOperation({ summary: 'Preview final settlement for contract termination' })
  settlementPreview(@Param('id') id: string, @Body() body: any) {
    const input = ContractSettlementInputSchema.parse(body);
    return this.contractsService.previewSettlement(id, input);
  }
}
