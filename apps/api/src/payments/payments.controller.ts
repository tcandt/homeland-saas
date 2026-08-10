import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { Public } from '../shared/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('invoices/:invoiceId/request')
  @ApiBearerAuth()
  @RequirePermissions('invoice.read')
  @ApiOperation({ summary: 'Create SePay payment request for an invoice' })
  createInvoiceRequest(@Param('invoiceId') invoiceId: string, @CurrentUser('id') userId: string) {
    return this.paymentsService.createInvoiceRequest(invoiceId, userId);
  }

  @Post('invoices/:invoiceId/send-zalo')
  @ApiBearerAuth()
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Send invoice QR to customer via Zalo' })
  sendInvoiceToZalo(@Param('invoiceId') invoiceId: string, @CurrentUser('id') userId: string) {
    return this.paymentsService.sendInvoiceRequestToZalo(invoiceId, userId);
  }

  @Post('deposits/:depositId/request')
  @ApiBearerAuth()
  @RequirePermissions('deposit.read')
  @ApiOperation({ summary: 'Create SePay payment request for a deposit' })
  createDepositRequest(@Param('depositId') depositId: string, @CurrentUser('id') userId: string) {
    return this.paymentsService.createDepositRequest(depositId, userId);
  }

  @Post('deposits/:depositId/send-zalo')
  @ApiBearerAuth()
  @RequirePermissions('deposit.update')
  @ApiOperation({ summary: 'Send deposit QR to customer via Zalo' })
  sendDepositToZalo(@Param('depositId') depositId: string, @CurrentUser('id') userId: string) {
    return this.paymentsService.sendDepositRequestToZalo(depositId, userId);
  }

  @Get('requests/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payment request' })
  getRequest(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.paymentsService.getRequest(id, tenantId);
  }

  @Post('sepay/manual-assign')
  @ApiBearerAuth()
  @RequirePermissions('finance.update')
  @ApiOperation({ summary: 'Manually assign a SePay transaction to an invoice or deposit' })
  manualAssignSePayTransaction(
    @Body() body: { logId: string; sourceType: 'INVOICE' | 'DEPOSIT'; sourceCode: string },
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.manualAssignSePayTransaction(tenantId, userId, body as any);
  }

  @Post('sepay/webhook')
  @Public()
  @ApiOperation({ summary: 'SePay webhook for payment confirmation' })
  handleSePayWebhook(@Body() body: any, @Headers('authorization') authorization?: string) {
    return this.paymentsService.handleSePayWebhook(body, authorization);
  }
}
