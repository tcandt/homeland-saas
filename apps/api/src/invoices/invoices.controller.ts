import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { CreateInvoiceSchema, UpdateInvoiceSchema, PaginationSchema } from '@homeland/shared';

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
    return this.invoicesService.getDetail(id, {
      customer: true,
      contract: { include: { room: { include: { building: true, floor: true } } } },
    });
  }

  @Post()
  @RequirePermissions('invoice.create')
  @ApiOperation({ summary: 'Create invoice' })
  create(@Body() body: any, @CurrentUser('id') userId: string) {
    const input = CreateInvoiceSchema.parse(body);
    const statusMap: Record<string, any> = {
      UNPAID: 'ISSUED',
      PARTIALLY_PAID: 'PARTIAL',
      PAID: 'PAID',
      OVERDUE: 'OVERDUE',
      CANCELLED: 'CANCELLED',
    };
    const data = {
      customerId: input.customerId,
      contractId: input.contractId,
      code: `INV-${Date.now()}`,
      status: statusMap[input.status] || 'DRAFT',
      dueDate: new Date(input.dueDate),
      subtotal: input.totalAmount,
      total: input.totalAmount,
      paidAmount: input.paidAmount || 0,
      discount: 0,
      creditAmount: 0,
    };
    return this.invoicesService.create(data, userId, 'Invoices');
  }

  @Patch(':id')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Update invoice' })
  update(@Param('id') id: string, @Body() body: any, @CurrentUser('id') userId: string) {
    const input = UpdateInvoiceSchema.parse(body);
    const data: any = { ...input };
    if (input.dueDate) data.dueDate = new Date(input.dueDate);
    
    return this.invoicesService.update(id, data, userId, 'Invoices');
  }

  @Delete(':id')
  @RequirePermissions('invoice.delete')
  @ApiOperation({ summary: 'Soft delete invoice' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.invoicesService.softDelete(id, userId, 'Invoices');
  }
}
