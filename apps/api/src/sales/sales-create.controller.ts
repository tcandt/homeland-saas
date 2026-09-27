import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CreateSalesLeadInput, SalesCreateService } from './sales-create.service';

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesCreateController {
  constructor(private readonly salesCreateService: SalesCreateService) {}

  @Post()
  @RequirePermissions('sales.create')
  @ApiOperation({ summary: 'Create a sales lead' })
  create(
    @Body() input: CreateSalesLeadInput,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.salesCreateService.createLead(tenantId, userId, input, idempotencyKey);
  }
}
