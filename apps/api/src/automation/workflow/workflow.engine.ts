import { Injectable, Logger } from '@nestjs/common';
import { AccountType, SettingScope } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { WORKFLOW_REGISTRY } from './workflow.registry';
import { WorkflowStatus } from '../automation.constants';
import { CommunicationService } from '../../communication/communication.service';
import { AnalyticsCacheService } from '../../analytics/analytics-cache.service';
import { JournalEntryService } from '../../finance/journal-entry.service';
import { DocumentsService } from '../../documents/documents.service';
import { buildRoomContext } from '../../shared/context/room-context';

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationService: CommunicationService,
    private readonly analyticsCache: AnalyticsCacheService,
    private readonly journalEntryService: JournalEntryService,
    private readonly documentsService: DocumentsService,
  ) {}

  getWorkflows() {
    return WORKFLOW_REGISTRY;
  }

  async executeWorkflow(workflowName: string, eventName: string, payload: any) {
    const workflow = WORKFLOW_REGISTRY.find((item) => item.name === workflowName);
    if (!workflow) {
      this.logger.warn(`Workflow ${workflowName} not found`);
      return;
    }

    const tenantId = payload.tenantId;
    const execution = await this.prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowName,
        eventName,
        status: WorkflowStatus.RUNNING,
        startedAt: new Date(),
        input: payload,
      },
    });

    try {
      const steps = [...workflow.steps].sort((left, right) => left.order - right.order);

      for (const step of steps) {
        const stepExec = await this.prisma.workflowStepExecution.create({
          data: {
            workflowExecutionId: execution.id,
            stepName: step.name,
            stepType: step.type,
            order: step.order,
            status: WorkflowStatus.RUNNING,
            startedAt: new Date(),
            input: payload,
          },
        });

        try {
          await this.executeStep(step.type, payload, step.params, eventName);

          await this.prisma.workflowStepExecution.update({
            where: { id: stepExec.id },
            data: { status: WorkflowStatus.SUCCESS, completedAt: new Date() },
          });
        } catch (stepErr: any) {
          await this.prisma.workflowStepExecution.update({
            where: { id: stepExec.id },
            data: {
              status: WorkflowStatus.FAILED,
              completedAt: new Date(),
              error: stepErr.message,
            },
          });
          throw stepErr;
        }
      }

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: WorkflowStatus.SUCCESS, completedAt: new Date() },
      });
      this.logger.log(`Workflow ${workflowName} completed successfully.`);
    } catch (err: any) {
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: WorkflowStatus.FAILED, completedAt: new Date(), error: err.message },
      });
      this.logger.error(`Workflow ${workflowName} failed`, err.stack);
    }
  }

  private async executeStep(type: string, payload: any, params?: any, eventName?: string) {
    this.logger.debug(`Executing step: ${type}`);
    switch (type) {
      case 'CREATE_JOURNAL_ENTRY':
        await this.createJournalEntryFromPaymentEvent(payload);
        break;
      case 'CREATE_IN_APP_NOTIFICATION':
        await this.communicationService.dispatch({
          tenantId: payload.tenantId,
          userId: payload.customerId || payload.userId,
          templateCode: params?.templateCode || 'SYSTEM_ALERT',
          context: payload,
        });
        break;
      case 'SEND_PAYMENT_CONFIRMATION_ZALO':
        if (!(await this.shouldSendSePayResultToZalo(payload))) {
          break;
        }
        const zaloRecipient = String(payload.customerZaloChatId || payload.customerZaloUserId || '').trim();
        if (zaloRecipient) {
          await this.communicationService.dispatchDirect({
            tenantId: payload.tenantId,
            channel: 'ZALO' as any,
            templateCode: params?.templateCode || 'PAYMENT_ZALO_CONFIRMATION',
            recipient: zaloRecipient,
            userId: payload.customerId || payload.userId || null,
            context: {
              ...payload,
              ...buildRoomContext(payload.room || payload.contract?.room, payload.contract),
              paymentCode: payload.metadata?.code,
            },
          });
        } else {
          this.logger.warn('Skipping Zalo payment confirmation because customer Zalo chat/user id is missing');
        }
        break;
      case 'SEND_ADMIN_GROUP_ZALO':
        if (!(await this.shouldSendSePayResultToZalo(payload))) {
          break;
        }
        const adminGroupChatId = await this.resolveAdminGroupChatId(payload.tenantId);
        if (!adminGroupChatId) {
          this.logger.warn('Skipping admin group Zalo notification because adminGroupChatId is missing');
          break;
        }
        await this.communicationService.dispatchDirect({
          tenantId: payload.tenantId,
          channel: 'ZALO' as any,
          templateCode: params?.templateCode || 'SYSTEM_ALERT',
          recipient: adminGroupChatId,
          userId: null,
          context: {
            ...payload,
            title: this.buildAdminPaymentTitle(payload),
            message: this.buildAdminPaymentMessage(payload),
          },
        });
        break;
      case 'INVALIDATE_DASHBOARD_CACHE':
        await this.analyticsCache.invalidateDashboard(payload.tenantId);
        break;
      case 'INVALIDATE_FINANCE_CACHE':
        await this.analyticsCache.invalidateFinance(payload.tenantId);
        break;
      case 'GENERATE_DOCUMENT':
        await this.documentsService.generateDocument(
          payload.tenantId,
          params?.templateCode || 'CONTRACT_TEMPLATE',
          payload,
          {
            title: payload.title || `Document for ${payload.code || 'Entity'}`,
            sourceType: payload.sourceType || (eventName ? eventName.split('.')[0].toUpperCase() : 'UNKNOWN'),
            sourceId: payload.id || payload.sourceId,
            createdBy: 'automation_engine',
          },
        );
        break;
      case 'REQUEST_SIGNATURE':
        if (payload.documentId) {
          await this.documentsService.requestSignature(payload.tenantId, payload.documentId, {
            title: `Signature required for ${payload.code || 'Document'}`,
            parties: params?.parties || [
              {
                name: payload.customerName || 'Customer',
                email: payload.customerEmail || 'customer@example.com',
                role: 'CUSTOMER',
              },
            ],
          });
        }
        break;
      case 'WRITE_AUTOMATION_AUDIT':
        this.logger.debug('Audit written');
        break;
      default:
        this.logger.warn(`Unknown step type: ${type}`);
    }
  }

  private async createJournalEntryFromPaymentEvent(payload: any) {
    if (!payload.amount) return;

    const refundSourceType = payload.metadata?.refundSourceType;
    const isDepositRefund = payload.sourceType === 'REFUND' && refundSourceType === 'DEPOSIT';
    const isContractSettlementRefund = payload.sourceType === 'REFUND' && refundSourceType === 'CONTRACT_SETTLEMENT';
    const isDepositDeduction =
      payload.sourceType === 'ADJUSTMENT' &&
      ['DEPOSIT_DEDUCTION', 'DEPOSIT_RETAINED'].includes(String(payload.metadata?.adjustmentType || ''));
    const isDepositSettlementApplication =
      payload.sourceType === 'ADJUSTMENT' &&
      payload.metadata?.adjustmentType === 'DEPOSIT_SETTLEMENT_APPLICATION';

    if (isDepositDeduction || isDepositSettlementApplication) {
      const depositLiability = await this.resolveChartOfAccount(payload.tenantId, '1300');
      const offsetAccount = await this.resolveChartOfAccount(
        payload.tenantId,
        isDepositSettlementApplication ? '4000' : '4300',
        isDepositSettlementApplication ? 'Rental Revenue' : 'Deposit Forfeiture Revenue',
        AccountType.REVENUE,
      );

      if (!depositLiability || !offsetAccount) {
        throw new Error('Required Chart of Accounts not found');
      }

      await this.journalEntryService.createJournalEntry(payload.tenantId, {
        code: `JE-${payload.sourceType || 'SYS'}-${Date.now()}`,
        sourceType: payload.sourceType || 'UNKNOWN',
        sourceId: payload.id || payload.sourceId,
        description: payload.metadata?.code
          ? `${isDepositSettlementApplication ? 'Can coc quyet toan' : payload.metadata?.adjustmentType === 'DEPOSIT_RETAINED' ? 'Giu coc' : 'Khau tru coc'} ${payload.metadata.code}`
          : isDepositSettlementApplication
            ? 'Can coc quyet toan'
            : payload.metadata?.adjustmentType === 'DEPOSIT_RETAINED'
              ? 'Giu coc'
              : 'Khau tru coc',
        entryDate: new Date(),
        status: 'POSTED',
        lines: [
          {
            accountId: depositLiability.id,
            type: 'DEBIT',
            amount: payload.amount,
            description: 'Giam nghia vu phai tra coc',
          },
          {
            accountId: offsetAccount.id,
            type: 'CREDIT',
            amount: payload.amount,
            description: isDepositSettlementApplication
              ? 'Ghi nhan doanh thu duoc thanh toan bang tien coc'
              : 'Ghi nhan doanh thu giu coc',
          },
        ],
      });
      return;
    }

    if (isContractSettlementRefund) {
      const refundAmount = Number(payload.amount || 0);
      const rawDepositRefundAmount = Number(payload.metadata?.accountingBreakdown?.depositRefundAmount);
      const rawRevenueRefundAmount = Number(payload.metadata?.accountingBreakdown?.revenueRefundAmount);
      const hasValidBreakdown =
        Number.isFinite(rawDepositRefundAmount) &&
        rawDepositRefundAmount >= 0 &&
        Number.isFinite(rawRevenueRefundAmount) &&
        rawRevenueRefundAmount >= 0 &&
        Math.abs(rawDepositRefundAmount + rawRevenueRefundAmount - refundAmount) < 0.01;
      const depositRefundAmount = hasValidBreakdown ? rawDepositRefundAmount : 0;
      const revenueRefundAmount = hasValidBreakdown ? rawRevenueRefundAmount : refundAmount;
      const bankAccount = await this.resolveChartOfAccount(payload.tenantId, '1100');
      const depositLiability = depositRefundAmount > 0
        ? await this.resolveChartOfAccount(payload.tenantId, '1300')
        : null;
      const contraRevenue = revenueRefundAmount > 0
        ? await this.resolveChartOfAccount(
            payload.tenantId,
            '4015',
            'Rental Refund Contra Revenue',
            AccountType.REVENUE,
          )
        : null;

      if (!bankAccount || (depositRefundAmount > 0 && !depositLiability) || (revenueRefundAmount > 0 && !contraRevenue)) {
        throw new Error('Required Chart of Accounts not found');
      }

      const debitLines = [
        ...(depositRefundAmount > 0
          ? [{
              accountId: depositLiability!.id,
              type: 'DEBIT',
              amount: depositRefundAmount,
              description: 'Release deposit liability for settlement refund',
            }]
          : []),
        ...(revenueRefundAmount > 0
          ? [{
              accountId: contraRevenue!.id,
              type: 'DEBIT',
              amount: revenueRefundAmount,
              description: 'Contract settlement refund to tenant',
            }]
          : []),
      ];

      await this.journalEntryService.createJournalEntry(payload.tenantId, {
        code: `JE-${payload.sourceType || 'SYS'}-${Date.now()}`,
        sourceType: payload.sourceType || 'UNKNOWN',
        sourceId: payload.id || payload.sourceId,
        description: payload.metadata?.code
          ? `Contract settlement refund ${payload.metadata.code}`
          : 'Contract settlement refund',
        entryDate: new Date(),
        status: 'POSTED',
        lines: [
          ...debitLines,
          {
            accountId: bankAccount.id,
            type: 'CREDIT',
            amount: refundAmount,
            description: 'Cash out for contract settlement refund',
          },
        ],
      });
      return;
    }

    const bankAccount = await this.resolveChartOfAccount(payload.tenantId, '1100');
    const offsetAccountCode = payload.sourceType === 'INVOICE' ? '4000' : '1300';
    const offsetAccount = await this.resolveChartOfAccount(payload.tenantId, offsetAccountCode);
    if (!bankAccount || !offsetAccount) {
      throw new Error('Required Chart of Accounts not found');
    }

    const isRefund = isDepositRefund;
    const lines = isRefund
      ? [
          {
            accountId: offsetAccount.id,
            type: 'DEBIT',
            amount: payload.amount,
            description: 'Giam nghia vu phai tra coc',
          },
          {
            accountId: bankAccount.id,
            type: 'CREDIT',
            amount: payload.amount,
            description: 'Chi tien hoan coc',
          },
        ]
      : [
          {
            accountId: bankAccount.id,
            type: 'DEBIT',
            amount: payload.amount,
            description: 'Tien vao ngan hang',
          },
          {
            accountId: offsetAccount.id,
            type: 'CREDIT',
            amount: payload.amount,
            description: payload.sourceType === 'INVOICE' ? 'Doanh thu hoa don' : 'Phai tra coc',
          },
        ];

    await this.journalEntryService.createJournalEntry(payload.tenantId, {
      code: `JE-${payload.sourceType || 'SYS'}-${Date.now()}`,
      sourceType: payload.sourceType || 'UNKNOWN',
      sourceId: payload.id || payload.sourceId,
      description: payload.metadata?.code
        ? `${isRefund ? 'Hoan' : 'Ghi nhan'} ${payload.sourceType} ${payload.metadata.code}`
        : `${isRefund ? 'Hoan' : 'Ghi nhan'} ${payload.sourceType}`,
      entryDate: new Date(),
      status: 'POSTED',
      lines,
    });
  }

  private async shouldSendSePayResultToZalo(payload: any) {
    const requiredProvider = String(payload?.paymentProvider || '').trim().toUpperCase();
    if (requiredProvider && requiredProvider !== 'SEPAY') {
      return false;
    }

    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId: payload.tenantId,
          scope: SettingScope.TENANT,
          ownerId: payload.tenantId,
          key: 'sepay',
        },
      },
    });
    const settings = (record?.value as any) || {};
    return settings.sendPaymentResultToZalo !== false;
  }

  private async resolveAdminGroupChatId(tenantId: string) {
    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    });
    const settings = (record?.value as any) || {};
    return String(settings.adminGroupChatId || '').trim();
  }

  private buildAdminPaymentTitle(payload: any) {
    if (payload.sourceType === 'DEPOSIT') {
      return `SePay xác nhận phiếu cọc ${payload.metadata?.code || ''}`.trim();
    }
    return `SePay xác nhận hóa đơn ${payload.metadata?.code || ''}`.trim();
  }

  private buildAdminPaymentMessage(payload: any) {
    const sourceLabel = payload.sourceType === 'DEPOSIT' ? 'Phiếu cọc' : 'Hóa đơn';
    const roomLabel = payload.roomCode ? `\nPhòng: ${payload.roomCode}${payload.roomRentalTypeLabel ? ` (${payload.roomRentalTypeLabel})` : ''}` : '';
    const buildingLabel = payload.buildingName ? `\nTòa nhà: ${payload.buildingName}` : '';
    const memberLabel = payload.roomMemberCount ? `\nSố người: ${payload.roomMemberCount}` : '';
    return [
      'HomeLand - Đã nhận thanh toán',
      `${sourceLabel}: ${payload.metadata?.code || payload.sourceId || '-'}`,
      `Khách: ${payload.customerName || '-'}`,
      `Số tiền: ${Number(payload.amount || 0).toLocaleString('vi-VN')} VND`,
      payload.paymentRef ? `Mã giao dịch: ${payload.paymentRef}` : null,
      roomLabel ? roomLabel.trimStart() : null,
      buildingLabel ? buildingLabel.trimStart() : null,
      memberLabel ? memberLabel.trimStart() : null,
    ].filter(Boolean).join('\n');
  }

  private async resolveChartOfAccount(
    tenantId: string,
    code: string,
    fallbackName?: string,
    fallbackType?: AccountType,
  ) {
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: { tenantId, code },
    });
    if (existing) return existing;
    if (!fallbackName || !fallbackType) return null;

    return this.prisma.chartOfAccount.create({
      data: {
        tenantId,
        code,
        name: fallbackName,
        type: fallbackType,
      },
    });
  }
}
