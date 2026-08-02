import { Controller, Get, Post, Delete, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { PaginationSchema, CreateInvoiceSchema } from '@homeland/shared';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions('invoice.read')
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'roomId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'contractId', required: false })
  @ApiQuery({ name: 'period', required: false })
  @ApiQuery({ name: 'overdue', required: false })
  list(@Query() query: any) {
    const { page, limit, search, sort, order } = PaginationSchema.parse(query);
    const { status, roomId, customerId, contractId, period } = query;
    const overdue = query.overdue === 'true';
    return this.invoicesService.listInvoices(page, limit, search, status, roomId, customerId, contractId, period, overdue, sort, order);
  }

  @Get(':id')
  @RequirePermissions('invoice.read')
  @ApiOperation({ summary: 'Get invoice details' })
  getDetail(@Param('id') id: string) {
    return this.invoicesService.getDetail(id);
  }

  @Post()
  @RequirePermissions('invoice.create')
  @ApiOperation({ summary: 'Create DRAFT invoice' })
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    const input = CreateInvoiceSchema.parse(body);
    const data: any = {
      customerId: input.customerId,
      contractId: input.contractId,
      code: `INV-${Date.now()}`,
      dueDate: new Date(input.dueDate),
      subtotal: input.totalAmount, // To be properly calculated when items are added
      total: input.totalAmount,
      paidAmount: input.paidAmount || 0,
      discount: 0,
      creditAmount: 0,
    };
    return this.invoicesService.create(data, userId, 'Invoices');
  }

  @Post(':id/issue')
  @RequirePermissions('invoice.update') // Assuming manager can issue
  @ApiOperation({ summary: 'Issue a DRAFT invoice' })
  issue(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.invoicesService.issue(id, userId);
  }

  @Post(':id/pay')
  @RequirePermissions('invoice.update') // Assuming finance can pay
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  pay(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    if (!body.amount || typeof body.amount !== 'number') {
      throw new BadRequestException('Amount is required and must be a number');
    }
    const provider = body.provider || 'MANUAL';
    const providerRef = body.providerRef || '';
    return this.invoicesService.pay(id, body.amount, provider, providerRef, userId);
  }

  @Post(':id/cancel')
  @RequirePermissions('invoice.update') // Assuming manager can cancel
  @ApiOperation({ summary: 'Cancel an invoice' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.invoicesService.cancel(id, userId);
  }

  @Post(':id/writeoff')
  @RequirePermissions('invoice.update') // Assuming finance can writeoff
  @ApiOperation({ summary: 'Write off an invoice' })
  writeoff(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.invoicesService.writeoff(id, userId);
  }

  @Delete(':id')
  @RequirePermissions('invoice.delete')
  @ApiOperation({ summary: 'Soft delete invoice' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.invoicesService.softDelete(id, userId, 'Invoices');
  }
}
