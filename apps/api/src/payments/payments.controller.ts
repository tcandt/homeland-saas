import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
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

  @Post('sepay/resolve-overpayment')
  @ApiBearerAuth()
  @RequirePermissions('finance.update')
  @ApiOperation({ summary: 'Resolve an overpaid SePay transaction' })
  resolveSePayOverpayment(
    @Body() body: { logId: string; resolution: 'CREDIT_BALANCE' | 'CARRY_FORWARD' | 'REFUND_PENDING' },
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.resolveSePayOverpayment(tenantId, userId, body as any);
  }

  @Post('sepay/complete-overpayment-refund')
  @ApiBearerAuth()
  @RequirePermissions('finance.update')
  @ApiOperation({ summary: 'Complete a pending SePay overpayment refund' })
  completeSePayOverpaymentRefund(
    @Body() body: { logId: string; note?: string },
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentsService.completeSePayOverpaymentRefund(tenantId, userId, body as any);
  }

  @Post('sepay/webhook')
  @Public()
  @ApiOperation({ summary: 'SePay webhook for payment confirmation' })
  handleSePayWebhook(
    @Req() req: any,
    @Body() body: any,
    @Headers('authorization') authorization?: string,
    @Headers('x-sepay-signature') signature?: string,
    @Headers('x-sepay-timestamp') timestamp?: string,
  ) {
    return this.paymentsService.handleSePayWebhook(body, {
      authorization,
      signature,
      timestamp,
      rawBody: req.rawBody,
    });
  }

  @Get('sepay/webhook/health')
  @Public()
  @ApiOperation({ summary: 'Public health endpoint for SePay webhook routing' })
  getSePayWebhookHealth() {
    return {
      success: true,
      service: 'sepay-webhook',
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sepay/status')
  @ApiBearerAuth()
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Get current SePay integration status for the tenant' })
  getSePayStatus(@CurrentUser('tenantId') tenantId: string) {
    return this.paymentsService.getSePayStatus(tenantId).then((status) => ({ success: true, status }));
  }

  @Get('sepay/admin-config')
  @ApiBearerAuth()
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Get SePay routing config, rooms and receiving accounts for admin settings' })
  getSePayAdminConfig(@CurrentUser('tenantId') tenantId: string) {
    return this.paymentsService.getSePayAdminConfig(tenantId).then((config) => ({ success: true, config }));
  }

  @Post('sepay/routing')
  @ApiBearerAuth()
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Replace SePay room-to-bank routing table for the tenant' })
  saveSePayRouting(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { assignments?: Array<{ roomId: string; bankAccountId: string; validFrom?: string | null; validTo?: string | null; note?: string | null }> },
  ) {
    return this.paymentsService.saveRoomPaymentAccountRoutes(tenantId, body?.assignments || [], userId).then((config) => ({ success: true, config }));
  }

  @Post('sepay/test-qr')
  @ApiBearerAuth()
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Preview a SePay QR payload using the current tenant settings' })
  testSePayQr(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { amount?: number; memo?: string; roomId?: string; bankAccountId?: string },
  ) {
    return this.paymentsService.previewSePayQr(tenantId, body || {})
      .then((preview) => ({ success: true, preview }));
  }

  @Post('sepay/test-qr/send-admin')
  @ApiBearerAuth()
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Generate and send a SePay test QR preview to the configured Zalo admin group' })
  sendSePayQrToAdmin(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { amount?: number; memo?: string; roomId?: string; bankAccountId?: string },
  ) {
    return this.paymentsService.sendPreviewSePayQrToAdminGroup(tenantId, body || {})
      .then((result) => ({ success: true, ...result }));
  }

  @Post('sepay/test-reconciliation')
  @ApiBearerAuth()
  @RequirePermissions('finance.read')
  @ApiOperation({ summary: 'Evaluate how a sample SePay transaction would reconcile against an existing payment code' })
  testSePayReconciliation(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { paymentCode?: string; amount?: number; accountNumber?: string },
  ) {
    return this.paymentsService.testSePayReconciliation(tenantId, body).then((result) => ({ success: true, result }));
  }
}
