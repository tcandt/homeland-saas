import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PaymentProvider, PaymentRequestStatus, PaymentSourceType, Prisma, SettingScope } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { DepositsService } from '../deposits/deposits.service';
import { CommunicationService } from '../communication/communication.service';
import { NotificationChannel } from '../automation/automation.constants';

type SePayWebhookPayload = {
  id?: number | string;
  transaction_id?: string;
  gateway?: string;
  transactionDate?: string;
  transaction_date?: string;
  accountNumber?: string;
  account_number?: string;
  bank_account_xid?: string;
  subAccount?: string;
  va?: string | null;
  payment_code?: string | null;
  code?: string | null;
  content?: string;
  transferType?: string;
  transfer_type?: string;
  transferAmount?: number;
  amount?: number;
  description?: string;
  referenceCode?: string;
  reference_code?: string;
};

type PaymentRequestResponse = {
  id: string;
  sourceType: PaymentSourceType;
  sourceId: string;
  paymentCode: string;
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string | null;
  qrUrl: string;
  status: PaymentRequestStatus;
  provider: PaymentProvider;
  createdAt: Date;
  updatedAt: Date;
};

function randomCode(prefix: string, scope: string) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${scope.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly depositsService: DepositsService,
    private readonly communicationService: CommunicationService,
  ) {}

  private async resolveSePayConfig(tenantId: string) {
    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'sepay',
        },
      },
    });

    return (record?.value as any) || {};
  }

  private async resolveBankAccount(tenantId: string) {
    const sepayConfig = await this.resolveSePayConfig(tenantId);
    if (sepayConfig.enabled === false) {
      throw new BadRequestException('SePay đang tắt trong Settings');
    }

    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!bankAccount) {
      throw new BadRequestException('Không tìm thấy tài khoản ngân hàng để tạo QR SePay');
    }

    return bankAccount;
  }

  private buildQrUrl(params: {
    bankName: string;
    accountNumber: string;
    amount: number;
    memo: string;
    accountName?: string | null;
    store?: string;
  }) {
    const query = new URLSearchParams({
      acc: params.accountNumber,
      bank: params.bankName,
      amount: String(Math.round(params.amount)),
      des: params.memo,
      template: 'compact',
      showinfo: 'true',
    });

    if (params.accountName) query.set('holder', params.accountName);
    if (params.store) query.set('store', params.store);

    return `https://vietqr.app/img?${query.toString()}`;
  }

  private async createPaymentRequest(
    tenantId: string,
    sourceType: PaymentSourceType,
    sourceId: string,
    amount: number,
    memoPrefix: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<PaymentRequestResponse> {
    const sepayConfig = await this.resolveSePayConfig(tenantId);
    const bankAccount = await this.resolveBankAccount(tenantId);
    const paymentCodePrefix = String(sepayConfig.paymentCodePrefix || memoPrefix || 'PAY');
    const paymentCode = randomCode(paymentCodePrefix, tenantId);
    const memo = `${paymentCode} ${sourceType.toLowerCase()} ${sourceId}`;
    const qrUrl = this.buildQrUrl({
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
      amount,
      memo,
      accountName: bankAccount.accountName,
      store: 'HomeLand',
    });

    const request = await this.prisma.paymentRequest.create({
      data: {
        tenantId,
        sourceType,
        sourceId,
        provider: PaymentProvider.SEPAY,
        paymentCode,
        amount,
        bankName: bankAccount.bankName,
        bankAccountNumber: bankAccount.accountNumber,
        bankAccountName: bankAccount.accountName,
        qrUrl,
        metadata: metadata ?? {},
      },
    });

    return {
      id: request.id,
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      paymentCode: request.paymentCode,
      amount: Number(request.amount),
      bankName: request.bankName,
      bankAccountNumber: request.bankAccountNumber,
      bankAccountName: request.bankAccountName,
      qrUrl: request.qrUrl,
      status: request.status,
      provider: request.provider,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  async createInvoiceRequest(invoiceId: string, userId: string) {
    const invoice = await this.invoicesService.getDetail(invoiceId);
    const remaining = Number(invoice.total) - Number(invoice.paidAmount || 0);

    if (remaining <= 0) {
      throw new BadRequestException('Hóa đơn này không còn số tiền cần thanh toán.');
    }

    return this.createPaymentRequest(
      invoice.tenantId,
      PaymentSourceType.INVOICE,
      invoice.id,
      remaining,
      'INV',
      { invoiceCode: invoice.code, customerId: invoice.customerId, createdBy: userId },
    );
  }

  async sendInvoiceRequestToZalo(invoiceId: string, userId: string) {
    const request = await this.createInvoiceRequest(invoiceId, userId);
    const invoice = await this.invoicesService.getDetail(invoiceId);
    const customerPhone = invoice.customer?.phone || '';

    await this.communicationService.dispatchDirect({
      tenantId: invoice.tenantId,
      channel: NotificationChannel.ZALO,
      templateCode: 'INVOICE_ZALO_PAYMENT_REQUEST',
      recipient: customerPhone,
      userId: invoice.customerId,
      context: {
        invoiceCode: invoice.code,
        customerName: invoice.customer?.fullName || 'Khách hàng',
        customerPhone,
        amount: Number(request.amount),
        paymentCode: request.paymentCode,
        qrUrl: request.qrUrl,
        bankName: request.bankName,
        bankAccountNumber: request.bankAccountNumber,
        dueDate: invoice.dueDate,
        sentAt: new Date(),
      },
    });

    return request;
  }

  async createDepositRequest(depositId: string, userId: string) {
    const deposit = await this.depositsService.getDetail(depositId);

    if (deposit.status === 'CANCELLED') {
      throw new BadRequestException('Phiếu cọc đã bị hủy.');
    }

    return this.createPaymentRequest(
      deposit.tenantId,
      PaymentSourceType.DEPOSIT,
      deposit.id,
      Number(deposit.amount),
      'DEP',
      { depositCode: deposit.code, customerId: deposit.customerId, createdBy: userId },
    );
  }

  async sendDepositRequestToZalo(depositId: string, userId: string) {
    const request = await this.createDepositRequest(depositId, userId);
    const deposit = await this.depositsService.getDetail(depositId);
    const customerPhone = deposit.customer?.phone || '';

    await this.communicationService.dispatchDirect({
      tenantId: deposit.tenantId,
      channel: NotificationChannel.ZALO,
      templateCode: 'DEPOSIT_ZALO_PAYMENT_REQUEST',
      recipient: customerPhone,
      userId: deposit.customerId,
      context: {
        depositCode: deposit.code,
        customerName: deposit.customer?.fullName || 'Khách hàng',
        customerPhone,
        amount: Number(request.amount),
        paymentCode: request.paymentCode,
        qrUrl: request.qrUrl,
        bankName: request.bankName,
        bankAccountNumber: request.bankAccountNumber,
        sentAt: new Date(),
      },
    });

    return request;
  }

  async getRequest(id: string, tenantId: string) {
    const request = await this.prisma.paymentRequest.findFirst({
      where: { id, tenantId },
    });

    if (!request) throw new BadRequestException('Không tìm thấy payment request');

    return request;
  }

  private resolveWebhookTransactionId(payload: SePayWebhookPayload) {
    return String(payload.transaction_id || payload.id || '');
  }

  private resolveWebhookPaymentCode(payload: SePayWebhookPayload) {
    const explicitCode = String(payload.code || payload.payment_code || '').trim();
    if (explicitCode) return explicitCode;

    const text = String(payload.content || payload.description || '').toUpperCase();
    const match = text.match(/[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+/);
    return match?.[0] || '';
  }

  async handleSePayWebhook(payload: SePayWebhookPayload, authorization?: string) {
    const webhookSettings = await this.prisma.appSetting.findMany({
      where: {
        key: 'sepay',
        scope: SettingScope.TENANT,
      },
      select: {
        value: true,
      },
    });

    const expectedKeys = Array.from(new Set(
      webhookSettings
        .map((setting) => (setting.value as any)?.webhookApiKey)
        .filter((value): value is string => Boolean(value && String(value).trim())),
    ));

    if (!expectedKeys.length) {
      throw new UnauthorizedException('SePay webhook is not configured');
    }

    const expectedAuthMatched = expectedKeys.some((key) => authorization === `Apikey ${key}`);
    if (!expectedAuthMatched) {
      throw new UnauthorizedException('Unauthorized SePay webhook');
    }

    const transactionId = this.resolveWebhookTransactionId(payload);
    if (!transactionId) {
      return { success: true };
    }

    const providerAmount = Number(payload.transferAmount ?? payload.amount ?? 0);
    const transferType = String(payload.transferType || payload.transfer_type || '').toLowerCase();
    const paymentCode = this.resolveWebhookPaymentCode(payload);
    const accountNumber = String(payload.accountNumber || payload.account_number || payload.bank_account_xid || '').trim();

    const log = await this.prisma.paymentWebhookLog.upsert({
      where: {
        provider_providerTransactionId: {
          provider: PaymentProvider.SEPAY,
          providerTransactionId: transactionId,
        },
      },
      create: {
        provider: PaymentProvider.SEPAY,
        providerTransactionId: transactionId,
        payload,
      },
      update: {
        payload,
      },
    });

    if (log.processedAt) {
      return { success: true };
    }

    if (!paymentCode || transferType === 'debit' || transferType === 'out') {
      await this.prisma.paymentWebhookLog.update({
        where: { id: log.id },
        data: { processedAt: new Date() },
      });
      return { success: true };
    }

    const request = await this.prisma.paymentRequest.findFirst({
      where: {
        provider: PaymentProvider.SEPAY,
        paymentCode,
        ...(accountNumber ? { bankAccountNumber: accountNumber } : {}),
      },
    });

    if (!request || request.status !== PaymentRequestStatus.PENDING) {
      await this.prisma.paymentWebhookLog.update({
        where: { id: log.id },
        data: { processedAt: new Date() },
      });
      return { success: true };
    }

    if (providerAmount < Number(request.amount)) {
      await this.prisma.paymentWebhookLog.update({
        where: { id: log.id },
        data: { processedAt: new Date() },
      });
      return { success: true };
    }

    if (request.sourceType === PaymentSourceType.INVOICE) {
      await this.invoicesService.pay(request.sourceId, Number(request.amount), 'SEPAY', transactionId, 'SEPAY_WEBHOOK');
    } else if (request.sourceType === PaymentSourceType.DEPOSIT) {
      await this.depositsService.collect(request.sourceId, `SePay transaction ${transactionId}`, 'SEPAY_WEBHOOK');
    }

    await this.prisma.paymentRequest.update({
      where: { id: request.id },
      data: {
        status: PaymentRequestStatus.CONFIRMED,
        providerTransactionId: transactionId,
        paidAt: new Date(),
      },
    });

    await this.prisma.paymentWebhookLog.update({
      where: { id: log.id },
      data: {
        tenantId: request.tenantId,
        processedAt: new Date(),
      },
    });

    return { success: true };
  }
}


