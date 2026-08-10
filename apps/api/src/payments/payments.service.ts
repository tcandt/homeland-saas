import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditAction, JournalSourceType, PaymentProvider, PaymentRequestStatus, PaymentSourceType, Prisma, SettingScope } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { DepositsService } from '../deposits/deposits.service';
import { CommunicationService } from '../communication/communication.service';
import { NotificationChannel } from '../automation/automation.constants';
import { JournalEntryService } from '../finance/journal-entry.service';
import { AuditService } from '../shared/audit/audit.service';

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
    private readonly journalEntryService: JournalEntryService,
    private readonly auditService: AuditService,
  ) {}

  private async createOverpaymentJournalEntry(
    tenantId: string,
    creditNoteId: string,
    paymentCode: string,
    amount: number,
    resolution: 'CREDIT_BALANCE' | 'CARRY_FORWARD',
  ) {
    const existing = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId,
        sourceType: JournalSourceType.ADJUSTMENT,
        sourceId: creditNoteId,
      },
      select: { id: true },
    });
    if (existing) return existing;

    const bankAccount = await this.prisma.chartOfAccount.findFirst({
      where: { tenantId, code: '1100' },
    });
    const customerCreditLiability = await this.prisma.chartOfAccount.findFirst({
      where: { tenantId, code: '1300' },
    });

    if (!bankAccount || !customerCreditLiability) {
      throw new BadRequestException('Khong tim thay tai khoan ke toan de ghi nhan tien thua.');
    }

    return this.journalEntryService.createJournalEntry(tenantId, {
      code: `JE-OVERPAY-${Date.now()}`,
      sourceType: JournalSourceType.ADJUSTMENT,
      sourceId: creditNoteId,
      description:
        resolution === 'CARRY_FORWARD'
          ? `Ghi nhan tien thua SePay ${paymentCode} de can tru ky sau`
          : `Ghi nhan tien thua SePay ${paymentCode} vao du co khach hang`,
      entryDate: new Date(),
      status: 'POSTED',
      lines: [
        {
          accountId: bankAccount.id,
          type: 'DEBIT',
          amount,
          description: 'Tien thua da vao ngan hang',
        },
        {
          accountId: customerCreditLiability.id,
          type: 'CREDIT',
          amount,
          description:
            resolution === 'CARRY_FORWARD'
              ? 'No phai tra khach de can tru ky sau'
              : 'No phai tra khach dang nam giu',
        },
      ],
    });
  }

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

  private async resolveOwnerDefaultBankAccountId(tenantId: string, ownerId?: string | null) {
    if (!ownerId) return null;

    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'owner-bank-defaults',
        },
      },
    });

    const defaults = (record?.value as any)?.defaults || {};
    const bankAccountId = typeof defaults[ownerId] === 'string' ? defaults[ownerId] : null;
    return bankAccountId || null;
  }

  private async resolveBankAccount(tenantId: string, ownerId?: string | null) {
    const sepayConfig = await this.resolveSePayConfig(tenantId);
    if (sepayConfig.enabled === false) {
      throw new BadRequestException('SePay đang tắt trong Settings');
    }

    const defaultBankAccountId = await this.resolveOwnerDefaultBankAccountId(tenantId, ownerId);
    const defaultBankAccount = defaultBankAccountId ? await this.prisma.bankAccount.findFirst({
      where: {
        tenantId,
        id: defaultBankAccountId,
        isActive: true,
        ...(ownerId ? { ownerId } : {}),
      },
    }) : null;

    const bankAccount = defaultBankAccount || await this.prisma.bankAccount.findFirst({
      where: { tenantId, isActive: true, ...(ownerId ? { ownerId } : {}) },
      orderBy: { createdAt: 'asc' },
    }) || await this.prisma.bankAccount.findFirst({
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
    allocation?: { ownerId?: string | null; buildingId?: string | null; roomId?: string | null },
  ): Promise<PaymentRequestResponse> {
    const sepayConfig = await this.resolveSePayConfig(tenantId);
    const bankAccount = await this.resolveBankAccount(tenantId, allocation?.ownerId);
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
        ownerId: allocation?.ownerId || bankAccount.ownerId || null,
        buildingId: allocation?.buildingId || null,
        roomId: allocation?.roomId || null,
        bankAccountId: bankAccount.id,
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
      {
        ownerId: invoice.contract?.room?.building?.ownerId,
        buildingId: invoice.contract?.room?.buildingId,
        roomId: invoice.contract?.roomId,
      },
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
      {
        ownerId: deposit.room?.building?.ownerId,
        buildingId: deposit.room?.buildingId,
        roomId: deposit.roomId,
      },
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

  async manualAssignSePayTransaction(
    tenantId: string,
    userId: string,
    payload: { logId: string; sourceType: PaymentSourceType; sourceCode: string },
  ) {
    const log = await this.prisma.paymentWebhookLog.findFirst({
      where: {
        id: payload.logId,
      },
    });
    if (!log) {
      throw new BadRequestException('Không tìm thấy giao dịch SePay cần gán.');
    }

    const rawPayload = log.payload as SePayWebhookPayload;
    const paymentCode = this.resolveWebhookPaymentCode(rawPayload);
    if (!paymentCode) {
      throw new BadRequestException('Giao dịch không có payment code để gán thủ công.');
    }

    const transferType = String(rawPayload.transferType || rawPayload.transfer_type || '').toLowerCase();
    if (transferType === 'debit' || transferType === 'out') {
      throw new BadRequestException('Không thể gán giao dịch ra.');
    }

    const transactionId = this.resolveWebhookTransactionId(rawPayload);
    const providerAmount = Number(rawPayload.transferAmount ?? rawPayload.amount ?? 0);
    const accountNumber = String(rawPayload.accountNumber || rawPayload.account_number || rawPayload.bank_account_xid || '').trim();

    if (!providerAmount || providerAmount <= 0) {
      throw new BadRequestException('Số tiền giao dịch không hợp lệ.');
    }

    const existingRequest = await this.prisma.paymentRequest.findFirst({
      where: {
        tenantId,
        paymentCode,
      },
    });

    if (existingRequest?.status === PaymentRequestStatus.CONFIRMED && existingRequest.providerTransactionId !== transactionId) {
      throw new BadRequestException('Payment code này đã được xác nhận bởi giao dịch khác.');
    }

    if (payload.sourceType === PaymentSourceType.INVOICE) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          code: payload.sourceCode,
          deletedAt: null,
        },
        include: {
          contract: {
            include: {
              room: {
                include: {
                  building: true,
                },
              },
            },
          },
        },
      });
      if (!invoice) {
        throw new BadRequestException('Không tìm thấy hóa đơn để gán.');
      }

      const remaining = Number(invoice.total || 0) - Number(invoice.paidAmount || 0) - Number(invoice.creditAmount || 0);
      if (providerAmount > remaining) {
        throw new BadRequestException(`Số tiền giao dịch vượt số dư hóa đơn ${remaining}. Hãy xử lý thừa tiền ở bước riêng.`);
      }

      const bankAccount = accountNumber
        ? await this.prisma.bankAccount.findFirst({ where: { tenantId, accountNumber } })
        : await this.resolveBankAccount(tenantId, invoice.contract?.room?.building?.ownerId);

      const request =
        existingRequest ||
        (await this.prisma.paymentRequest.create({
          data: {
            tenantId,
            ownerId: invoice.contract?.room?.building?.ownerId || null,
            buildingId: invoice.contract?.room?.buildingId || null,
            roomId: invoice.contract?.roomId || null,
            bankAccountId: bankAccount?.id || null,
            sourceType: PaymentSourceType.INVOICE,
            sourceId: invoice.id,
            provider: PaymentProvider.SEPAY,
            paymentCode,
            amount: providerAmount,
            bankName: bankAccount?.bankName || String(rawPayload.gateway || 'SEPAY'),
            bankAccountNumber: accountNumber || bankAccount?.accountNumber || '',
            bankAccountName: bankAccount?.accountName || null,
            qrUrl: '',
            metadata: {
              manualAssigned: true,
              sourceCode: payload.sourceCode,
              logId: payload.logId,
              assignedBy: userId,
            },
          },
        }));

      if (existingRequest) {
        await this.prisma.paymentRequest.update({
          where: { id: existingRequest.id },
          data: {
            sourceType: PaymentSourceType.INVOICE,
            sourceId: invoice.id,
            amount: providerAmount,
            ownerId: invoice.contract?.room?.building?.ownerId || null,
            buildingId: invoice.contract?.room?.buildingId || null,
            roomId: invoice.contract?.roomId || null,
            bankAccountId: bankAccount?.id || existingRequest.bankAccountId || null,
            bankName: bankAccount?.bankName || existingRequest.bankName,
            bankAccountNumber: accountNumber || existingRequest.bankAccountNumber,
            bankAccountName: bankAccount?.accountName || existingRequest.bankAccountName,
            metadata: {
              manualAssigned: true,
              sourceCode: payload.sourceCode,
              logId: payload.logId,
              assignedBy: userId,
            },
          },
        });
      }

      await this.invoicesService.pay(invoice.id, providerAmount, 'SEPAY', transactionId, userId);

      await this.prisma.paymentRequest.update({
        where: { id: request.id },
        data: {
          status: PaymentRequestStatus.CONFIRMED,
          providerTransactionId: transactionId,
          paidAt: new Date(),
        },
      });
    } else if (payload.sourceType === PaymentSourceType.DEPOSIT) {
      const deposit = await this.prisma.deposit.findFirst({
        where: {
          tenantId,
          code: payload.sourceCode,
          deletedAt: null,
        },
        include: {
          room: {
            include: {
              building: true,
            },
          },
        },
      });
      if (!deposit) {
        throw new BadRequestException('Không tìm thấy phiếu cọc để gán.');
      }

      if (providerAmount !== Number(deposit.amount || 0)) {
        throw new BadRequestException(`Số tiền giao dịch phải đúng bằng tiền cọc ${Number(deposit.amount || 0)}.`);
      }

      const bankAccount = accountNumber
        ? await this.prisma.bankAccount.findFirst({ where: { tenantId, accountNumber } })
        : await this.resolveBankAccount(tenantId, deposit.room?.building?.ownerId);

      const request =
        existingRequest ||
        (await this.prisma.paymentRequest.create({
          data: {
            tenantId,
            ownerId: deposit.room?.building?.ownerId || null,
            buildingId: deposit.room?.buildingId || null,
            roomId: deposit.roomId,
            bankAccountId: bankAccount?.id || null,
            sourceType: PaymentSourceType.DEPOSIT,
            sourceId: deposit.id,
            provider: PaymentProvider.SEPAY,
            paymentCode,
            amount: providerAmount,
            bankName: bankAccount?.bankName || String(rawPayload.gateway || 'SEPAY'),
            bankAccountNumber: accountNumber || bankAccount?.accountNumber || '',
            bankAccountName: bankAccount?.accountName || null,
            qrUrl: '',
            metadata: {
              manualAssigned: true,
              sourceCode: payload.sourceCode,
              logId: payload.logId,
              assignedBy: userId,
            },
          },
        }));

      if (existingRequest) {
        await this.prisma.paymentRequest.update({
          where: { id: existingRequest.id },
          data: {
            sourceType: PaymentSourceType.DEPOSIT,
            sourceId: deposit.id,
            amount: providerAmount,
            ownerId: deposit.room?.building?.ownerId || null,
            buildingId: deposit.room?.buildingId || null,
            roomId: deposit.roomId,
            bankAccountId: bankAccount?.id || existingRequest.bankAccountId || null,
            bankName: bankAccount?.bankName || existingRequest.bankName,
            bankAccountNumber: accountNumber || existingRequest.bankAccountNumber,
            bankAccountName: bankAccount?.accountName || existingRequest.bankAccountName,
            metadata: {
              manualAssigned: true,
              sourceCode: payload.sourceCode,
              logId: payload.logId,
              assignedBy: userId,
            },
          },
        });
      }

      await this.depositsService.collect(deposit.id, `Manual SePay assignment ${transactionId}`, userId);

      await this.prisma.paymentRequest.update({
        where: { id: request.id },
        data: {
          status: PaymentRequestStatus.CONFIRMED,
          providerTransactionId: transactionId,
          paidAt: new Date(),
        },
      });
    } else {
      throw new BadRequestException('Loại nguồn thanh toán không hỗ trợ.');
    }

    await this.prisma.paymentWebhookLog.update({
      where: { id: log.id },
      data: {
        tenantId,
        processedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      module: 'Payments',
      entity: 'SePayManualAssignment',
      entityId: log.id,
      tenantId,
      userId,
      before: {
        logId: log.id,
        paymentCode,
        sourceType: existingRequest?.sourceType || null,
        sourceId: existingRequest?.sourceId || null,
      },
      after: {
        logId: log.id,
        paymentCode,
        sourceType: payload.sourceType,
        sourceCode: payload.sourceCode,
        amount: providerAmount,
        transactionId,
      },
    });

    return {
      success: true,
      paymentCode,
      sourceType: payload.sourceType,
      sourceCode: payload.sourceCode,
      amount: providerAmount,
    };
  }

  async resolveSePayOverpayment(
    tenantId: string,
    userId: string,
    payload: { logId: string; resolution: 'CREDIT_BALANCE' | 'CARRY_FORWARD' | 'REFUND_PENDING' },
  ) {
    const log = await this.prisma.paymentWebhookLog.findFirst({
      where: { id: payload.logId, tenantId },
    });
    if (!log) {
      throw new BadRequestException('Không tìm thấy log SePay cần xử lý.');
    }

    const rawPayload = log.payload as any;
    const paymentCode = this.resolveWebhookPaymentCode(rawPayload);
    if (!paymentCode) {
      throw new BadRequestException('Log SePay không có payment code hợp lệ.');
    }

    const request = await this.prisma.paymentRequest.findFirst({
      where: {
        tenantId,
        provider: PaymentProvider.SEPAY,
        paymentCode,
      },
      include: {
        owner: true,
      },
    });
    if (!request) {
      throw new BadRequestException('Không tìm thấy payment request tương ứng.');
    }
    if (request.sourceType !== PaymentSourceType.INVOICE && request.sourceType !== PaymentSourceType.DEPOSIT) {
      throw new BadRequestException('Nguồn thanh toán này chưa hỗ trợ xử lý tiền thừa.');
    }

    const providerAmount = Number(rawPayload.transferAmount ?? rawPayload.amount ?? 0);
    const requestedAmount = Number(request.amount || 0);
    const overpaidAmount = providerAmount - requestedAmount;
    if (overpaidAmount <= 0) {
      throw new BadRequestException('Giao dịch này không có tiền thừa để xử lý.');
    }

    const existingResolution = (request.metadata as any)?.overpaymentResolution || rawPayload?.overpaymentResolution;
    if (existingResolution) {
      throw new BadRequestException('Tiền thừa của giao dịch này đã được xử lý.');
    }

    const metadata = {
      ...((request.metadata as any) || {}),
      overpaymentResolution: payload.resolution,
      overpaymentAmount: overpaidAmount,
      overpaymentResolvedBy: userId,
      overpaymentResolvedAt: new Date().toISOString(),
      overpaymentLogId: payload.logId,
    };

    if (payload.resolution === 'REFUND_PENDING') {
      const title =
        request.sourceType === PaymentSourceType.INVOICE
          ? `Hoàn lại tiền thừa SePay cho hóa đơn ${request.sourceId}`
          : `Hoàn lại tiền thừa SePay cho phiếu cọc ${request.sourceId}`;

      await this.prisma.task.create({
        data: {
          tenantId,
          title,
          description: `Payment code ${paymentCode} thừa ${overpaidAmount} đ. Cần xử lý hoàn lại tiền cho khách.`,
          status: 'TODO' as any,
          priority: 'HIGH' as any,
        },
      });
    } else {
      let customerId = '';
      let sourceInvoiceId: string | null = null;
      if (request.sourceType === PaymentSourceType.INVOICE) {
        const invoice = await this.prisma.invoice.findFirst({
          where: { tenantId, id: request.sourceId, deletedAt: null },
          select: {
            id: true,
            customerId: true,
            code: true,
          },
        });
        if (!invoice) {
          throw new BadRequestException('Không tìm thấy hóa đơn gốc để tạo dư có.');
        }
        customerId = invoice.customerId;
        sourceInvoiceId = invoice.id;
      } else {
        const deposit = await this.prisma.deposit.findFirst({
          where: { tenantId, id: request.sourceId, deletedAt: null },
          select: {
            id: true,
            customerId: true,
            code: true,
          },
        });
        if (!deposit) {
          throw new BadRequestException('Không tìm thấy phiếu cọc gốc để tạo dư có.');
        }
        customerId = deposit.customerId;
      }

      const creditNote = await this.prisma.creditNote.create({
        data: {
          tenantId,
          customerId,
          sourceInvoiceId,
          amount: overpaidAmount,
          remainingAmount: overpaidAmount,
          reason:
            payload.resolution === 'CARRY_FORWARD'
              ? `SePay overpayment ${paymentCode} - carry forward`
              : `SePay overpayment ${paymentCode} - credit balance`,
        },
      });

      await this.createOverpaymentJournalEntry(
        tenantId,
        creditNote.id,
        paymentCode,
        overpaidAmount,
        payload.resolution,
      );
    }

    await this.prisma.paymentRequest.update({
      where: { id: request.id },
      data: {
        metadata: metadata as any,
      },
    });

    await this.prisma.paymentWebhookLog.update({
      where: { id: log.id },
      data: {
        payload: {
          ...rawPayload,
          overpaymentResolution: payload.resolution,
          overpaymentAmount: overpaidAmount,
          overpaymentResolvedBy: userId,
          overpaymentResolvedAt: new Date().toISOString(),
        } as any,
      },
    });

    await this.auditService.log({
      action: AuditAction.UPDATE,
      module: 'Payments',
      entity: 'SePayOverpaymentResolution',
      entityId: request.id,
      tenantId,
      userId,
      before: {
        requestId: request.id,
        paymentCode,
        resolution: existingResolution || null,
        amount: requestedAmount,
      },
      after: {
        requestId: request.id,
        paymentCode,
        resolution: payload.resolution,
        overpaidAmount,
        ownerId: request.ownerId || null,
      },
    });

    return {
      success: true,
      paymentCode,
      resolution: payload.resolution,
      overpaidAmount,
    };
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
