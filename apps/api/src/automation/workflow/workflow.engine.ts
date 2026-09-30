import { Injectable, Logger } from '@nestjs/common';
import { AccountType, Prisma, SettingScope } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { WORKFLOW_REGISTRY } from './workflow.registry';
import { WorkflowStatus } from '../automation.constants';
import { CommunicationService } from '../../communication/communication.service';
import { AnalyticsCacheService } from '../../analytics/analytics-cache.service';
import { JournalEntryService } from '../../finance/journal-entry.service';
import { DocumentsService } from '../../documents/documents.service';
import { buildRoomContext } from '../../shared/context/room-context';
import { buildAdminZaloEventMessage, formatZaloDate, formatZaloMoney, formatZaloRoom } from '../../communication/services/zalo-message-formatter';

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
    const shouldPropagateWorkflowFailure = Boolean(payload?.outboxDelivery);
    const correlationId = payload.outboxEventId ? String(payload.outboxEventId) : '';
    const claim = correlationId
      ? await this.prisma.$transaction(async (tx) => {
          const lockKey = `${tenantId}:workflow:${workflowName}:${correlationId}`;
          await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"`);
          const previous = await tx.workflowExecution.findFirst({
            where: {
              tenantId,
              workflowName,
              correlationId,
              status: { in: [WorkflowStatus.RUNNING, WorkflowStatus.SUCCESS] as any },
            },
            orderBy: { createdAt: 'asc' },
          });
          if (previous) {
            return { execution: previous, duplicate: true };
          }
          const execution = await tx.workflowExecution.create({
            data: {
              tenantId,
              workflowName,
              eventName,
              correlationId,
              status: WorkflowStatus.RUNNING,
              startedAt: new Date(),
              input: payload,
            },
          });
          return { execution, duplicate: false };
        })
      : {
          execution: await this.prisma.workflowExecution.create({
            data: {
              tenantId,
              workflowName,
              eventName,
              status: WorkflowStatus.RUNNING,
              startedAt: new Date(),
              input: payload,
            },
          }),
          duplicate: false,
        };
    if (claim.duplicate) {
      this.logger.debug(`Skip duplicate workflow ${workflowName} for outbox ${payload.outboxEventId}`);
      if (shouldPropagateWorkflowFailure && claim.execution.status === WorkflowStatus.RUNNING) {
        throw new Error(`WORKFLOW_ALREADY_RUNNING:${workflowName}:${correlationId}`);
      }
      return claim.execution;
    }
    const execution = claim.execution;

    const stepErrors: string[] = [];
    let executionAlreadyMarkedFailed = false;
    try {
      const steps = [...workflow.steps].sort((left, right) => left.order - right.order);

      for (const step of steps) {
        if (correlationId) {
          const completedStep = await this.prisma.workflowStepExecution.findFirst({
            where: {
              workflowExecution: {
                tenantId,
                workflowName,
                correlationId,
              },
              stepName: step.name,
              stepType: step.type,
              order: step.order,
              status: WorkflowStatus.SUCCESS,
            } as any,
            orderBy: { completedAt: 'asc' },
          });
          if (completedStep) {
            await this.prisma.workflowStepExecution.create({
              data: {
                workflowExecutionId: execution.id,
                stepName: step.name,
                stepType: step.type,
                order: step.order,
                status: WorkflowStatus.SUCCESS,
                startedAt: new Date(),
                completedAt: new Date(),
                input: payload,
                output: { skippedDuplicate: true, sourceStepExecutionId: completedStep.id } as any,
              },
            });
            continue;
          }
        }

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
          const message = String(stepErr?.message || stepErr || 'Unknown workflow step error');
          await this.prisma.workflowStepExecution.update({
            where: { id: stepExec.id },
            data: {
              status: WorkflowStatus.FAILED,
              completedAt: new Date(),
              error: message,
            },
          });
          stepErrors.push(`${step.name}: ${message}`);
          if (!step.params?.continueOnError) {
            throw stepErr;
          }
          this.logger.warn(
            `Workflow ${workflowName} continued after non-blocking step ${step.name} failed: ${message}`,
          );
        }
      }

      const status = stepErrors.length > 0 ? WorkflowStatus.FAILED : WorkflowStatus.SUCCESS;
      const error = stepErrors.length > 0 ? stepErrors.join('; ') : undefined;
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status,
          completedAt: new Date(),
          ...(error ? { error } : {}),
        },
      });
      if (stepErrors.length > 0) {
        executionAlreadyMarkedFailed = true;
        this.logger.warn(`Workflow ${workflowName} completed with ${stepErrors.length} non-blocking error(s).`);
        if (shouldPropagateWorkflowFailure) {
          throw new Error(`WORKFLOW_COMPLETED_WITH_ERRORS:${stepErrors.join('; ')}`);
        }
      } else {
        this.logger.log(`Workflow ${workflowName} completed successfully.`);
      }
      return { id: execution.id, status, ...(error ? { error } : {}) };
    } catch (err: any) {
      const error = err?.message || String(err || 'Unknown workflow error');
      if (!executionAlreadyMarkedFailed) {
        await this.prisma.workflowExecution.update({
          where: { id: execution.id },
          data: { status: WorkflowStatus.FAILED, completedAt: new Date(), error },
        });
      }
      this.logger.error(`Workflow ${workflowName} failed`, err.stack);
      if (shouldPropagateWorkflowFailure) {
        throw err;
      }
      return { id: execution.id, status: WorkflowStatus.FAILED, error };
    }
  }

  private async executeStep(type: string, payload: any, params?: any, eventName?: string) {
    this.logger.debug(`Executing step: ${type}`);
    switch (type) {
      case 'CREATE_JOURNAL_ENTRY':
        await this.createJournalEntryFromPaymentEvent(payload);
        break;
      case 'CREATE_IN_APP_NOTIFICATION': {
        if (this.shouldSuppressLinkedInvoicePaymentNotification(payload)) {
          break;
        }
        const templateCode = params?.templateCode || 'SYSTEM_ALERT';
        await this.communicationService.dispatch({
          tenantId: payload.tenantId,
          userId: payload.customerId || payload.userId,
          templateCode,
          context: templateCode === 'SYSTEM_ALERT'
            ? this.buildSystemAlertContext(payload, params, eventName)
            : payload,
        });
        break;
      }
      case 'CREATE_ADMIN_IN_APP_NOTIFICATION': {
        if (this.shouldSuppressAdminNotification(payload)) {
          break;
        }
        const adminUserIds = await this.resolveAdminUserIds(payload.tenantId);
        const title = this.buildAdminPaymentTitle(payload);
        const message = this.buildAdminPaymentMessage(payload);
        for (const userId of adminUserIds) {
          await this.communicationService.dispatch({
            tenantId: payload.tenantId,
            userId,
            channel: 'IN_APP' as any,
            templateCode: params?.templateCode || 'PAYMENT_RECEIVED',
            context: { ...payload, title, message },
          });
        }
        break;
      }
      case 'SEND_CUSTOMER_ZALO': {
        let customerZalo: { chatId: string; userId: string } = { chatId: '', userId: '' };
        try {
          customerZalo = await this.resolveCustomerZaloRecipient(payload);
        } catch (error: any) {
          this.logger.error(`Unable to resolve customer Zalo recipient: ${error?.message || error}`);
        }
        const recipient = String(customerZalo.chatId || customerZalo.userId || '').trim();
        if (!recipient) {
          this.logger.warn('Skipping customer Zalo notification because customer Zalo chat/user id is missing');
          break;
        }
        await this.communicationService.dispatchDirect({
          tenantId: payload.tenantId,
          channel: 'ZALO' as any,
          templateCode: params?.templateCode || 'SYSTEM_ALERT',
          recipient,
          userId: payload.customerId || null,
          context: this.buildZaloEventTemplateContext(payload, params, eventName),
        });
        break;
      }
      case 'SEND_PAYMENT_CONFIRMATION_ZALO':
        if (this.shouldSuppressCustomerPaymentConfirmation(payload)) {
          this.logger.debug(
            `Skip customer payment Zalo confirmation for ${payload.metadata?.code || payload.sourceId || '-'} because it was already confirmed by the linked invoice payment.`,
          );
          break;
        }
        if (!(await this.safeShouldSendSePayResultToZalo(payload))) {
          break;
        }
        let customerZalo: { chatId: string; userId: string } = { chatId: '', userId: '' };
        try {
          customerZalo = await this.resolveCustomerZaloRecipient(payload);
        } catch (error: any) {
          this.logger.error(`Unable to resolve customer Zalo recipient: ${error?.message || error}`);
        }
        const zaloRecipient = String(customerZalo.chatId || customerZalo.userId || '').trim();
        if (zaloRecipient) {
          try {
            const roomContext = buildRoomContext(payload.room || payload.contract?.room, payload.contract);
            const collectedAmount = Number(payload.paidAmount ?? payload.amount ?? 0);
            const remainingAmount = this.resolveRemainingAmount(payload);
            const paymentAmount = Number(payload.paymentAmount ?? payload.amount ?? 0);
            const result = await this.communicationService.dispatchDirect({
              tenantId: payload.tenantId,
              channel: 'ZALO' as any,
              templateCode: params?.templateCode || 'PAYMENT_ZALO_CONFIRMATION',
              recipient: zaloRecipient,
              userId: payload.customerId || payload.userId || null,
              context: {
                ...roomContext,
                ...payload,
                depositCode: payload.depositCode || payload.metadata?.code || payload.paymentCode || null,
                paymentCode: payload.paymentCode || payload.metadata?.code || null,
                paymentStatusLabel: this.buildPaymentStatusLabel(payload),
                paymentAmount,
                paymentReceiptMessage: this.buildPaymentReceiptMessage(payload, paymentAmount),
                amount: collectedAmount,
                remainingAmount,
              },
            });
            if (!result) {
              this.logger.warn(`Payment Zalo notification was not queued for ${payload.metadata?.code || payload.sourceId || '-'}`);
            }
          } catch (error: any) {
            this.logger.error(
              `Payment Zalo notification failed for ${payload.metadata?.code || payload.sourceId || '-'}: ${error?.message || error}`,
            );
          }
        } else {
          this.logger.warn('Skipping Zalo payment confirmation because customer Zalo chat/user id is missing');
        }
        break;
      case 'SEND_ADMIN_GROUP_ZALO':
        if (this.shouldSuppressAdminNotification(payload)) {
          break;
        }
        const isPaymentAdminZaloEvent = this.isPaymentAdminZaloEvent(eventName, payload);
        const adminGroupChatId = await this.resolveAdminGroupChatId(payload.tenantId);
        if (!adminGroupChatId) {
          const message = 'ZALO_ADMIN_GROUP_CHAT_ID_REQUIRED';
          if (isPaymentAdminZaloEvent) {
            throw new Error(message);
          }
          this.logger.warn('Skipping admin group Zalo notification because adminGroupChatId is missing');
          break;
        }
        try {
          const templateCode = this.resolveAdminZaloTemplateCode(payload, params, eventName);
          const templateParams = { ...params, templateCode };
          await this.communicationService.dispatchDirect({
            tenantId: payload.tenantId,
            channel: 'ZALO' as any,
            templateCode,
            recipient: adminGroupChatId,
            userId: null,
            context: {
              ...this.buildZaloEventTemplateContext(payload, templateParams, eventName),
              chatId: adminGroupChatId,
              zaloChatId: adminGroupChatId,
              adminGroupChatId,
            },
          });
        } catch (error: any) {
          this.logger.error(
            `Admin payment Zalo notification failed for ${payload.metadata?.code || payload.sourceId || '-'}: ${error?.message || error}`,
          );
          if (isPaymentAdminZaloEvent) {
            throw error;
          }
        }
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
    const accountingAmount = Number(payload.paymentAmount ?? payload.amount);
    if (payload.paymentId) {
      const existing = await this.prisma.journalEntry?.findFirst({
        where: {
          tenantId: payload.tenantId,
          sourceType: payload.sourceType,
          sourceId: payload.paymentId,
        },
        select: { id: true },
      });
      if (existing) {
        this.logger.debug(`Skip duplicate journal for payment ${payload.paymentId}`);
        return;
      }
    }

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
      const depositLiability = await this.resolveChartOfAccount(
        payload.tenantId,
        '1300',
        'Deposits Held',
        AccountType.LIABILITY,
      );
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
            amount: accountingAmount,
            description: 'Giam nghia vu phai tra coc',
          },
          {
            accountId: offsetAccount.id,
            type: 'CREDIT',
            amount: accountingAmount,
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
      const bankAccount = await this.resolveChartOfAccount(payload.tenantId, '1100', 'Bank', AccountType.ASSET);
      const depositLiability = depositRefundAmount > 0
        ? await this.resolveChartOfAccount(payload.tenantId, '1300', 'Deposits Held', AccountType.LIABILITY)
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

    if (payload.sourceType === 'INVOICE' && this.isBookingHoldInvoicePayment(payload)) {
      this.logger.debug(
        `Skip revenue journal for booking-hold deposit invoice ${payload.metadata?.code || payload.sourceId || ''}`,
      );
      return;
    }

    const bankAccount = await this.resolveChartOfAccount(payload.tenantId, '1100', 'Bank', AccountType.ASSET);
    const offsetAccountCode = payload.sourceType === 'INVOICE' ? '4000' : '1300';
    const offsetAccount = await this.resolveChartOfAccount(
      payload.tenantId,
      offsetAccountCode,
      offsetAccountCode === '4000' ? 'Rental Revenue' : 'Deposits Held',
      offsetAccountCode === '4000' ? AccountType.REVENUE : AccountType.LIABILITY,
    );
    if (!bankAccount || !offsetAccount) {
      throw new Error('Required Chart of Accounts not found');
    }

    const isRefund = isDepositRefund;
    const lines = isRefund
      ? [
          {
            accountId: offsetAccount.id,
            type: 'DEBIT',
            amount: accountingAmount,
            description: 'Giam nghia vu phai tra coc',
          },
          {
            accountId: bankAccount.id,
            type: 'CREDIT',
            amount: accountingAmount,
            description: 'Chi tien hoan coc',
          },
        ]
      : [
          {
            accountId: bankAccount.id,
            type: 'DEBIT',
            amount: accountingAmount,
            description: 'Tien vao ngan hang',
          },
          {
            accountId: offsetAccount.id,
            type: 'CREDIT',
            amount: accountingAmount,
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

  private isBookingHoldInvoicePayment(payload: any) {
    const metadata = payload?.metadata || {};
    const period = String(metadata.period || payload?.period || '').trim().toLowerCase();
    const billingKind = String(metadata.billingKind || payload?.billingKind || '').trim().toUpperCase();
    return (
      metadata.bookingHoldDepositInvoice === true ||
      period === 'cọc giữ phòng' ||
      billingKind === 'BOOKING_HOLD' ||
      billingKind === 'BOOKING_DEPOSIT'
    );
  }

  private async shouldSendSePayResultToZalo(payload: any) {
    const requiredProvider = String(payload?.paymentProvider || '').trim().toUpperCase();
    // The setting controls bank/SePay confirmations only. Manual cash
    // collection must always notify the linked Zalo Client recipient.
    if (requiredProvider && requiredProvider !== 'SEPAY') return true;

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

  private async safeShouldSendSePayResultToZalo(payload: any) {
    try {
      return await this.shouldSendSePayResultToZalo(payload);
    } catch (error: any) {
      this.logger.error(`Unable to read SePay notification settings: ${error?.message || error}`);
      return false;
    }
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
    const zaloCandidate = this.pickAdminGroupChatId(settings);
    if (zaloCandidate) return zaloCandidate;
    const sepayRecord = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'sepay',
        },
      },
    });
    return this.pickAdminGroupChatId((sepayRecord?.value as any) || {});
  }

  private pickAdminGroupChatId(settings: any) {
    const direct = String(
      settings?.adminGroupChatId ||
      settings?.adminChatId ||
      settings?.groupChatId ||
      settings?.defaultGroupChatId ||
      '',
    ).trim();
    if (direct) return direct;
    const recentGroup = Array.isArray(settings?.recentWebhookChats)
      ? settings.recentWebhookChats.find((item: any) => String(item?.chatType || '').toLowerCase() === 'group' && String(item?.chatId || '').trim())
      : null;
    return String(recentGroup?.chatId || '').trim();
  }

  private async resolveCustomerZaloRecipient(payload: any) {
    const chatId = String(payload?.customerZaloChatId || '').trim();
    const userId = String(payload?.customerZaloUserId || '').trim();
    if (chatId || userId || !payload?.customerId) {
      return { chatId, userId };
    }

    const customer = await this.prisma.customer?.findUnique({
      where: { id: payload.customerId, tenantId: payload.tenantId },
      select: { zaloChatId: true, zaloUserId: true },
    });
    return {
      chatId: String(customer?.zaloChatId || '').trim(),
      userId: String(customer?.zaloUserId || '').trim(),
    };
  }

  private async resolveAdminUserIds(tenantId: string) {
    const users = await this.prisma.user?.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        roles: { select: { role: { select: { code: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const adminUserIds = (users || [])
      .filter((user: any) =>
        (user.roles || []).some((item: any) => ['ADMIN', 'MANAGER', 'FINANCE'].includes(String(item.role?.code || '').toUpperCase())),
      )
      .map((user: any) => String(user.id || '').trim())
      .filter(Boolean);
    if (adminUserIds.length > 0) return adminUserIds;
    return (users || [])
      .map((user: any) => String(user.id || '').trim())
      .filter(Boolean);
  }

  private shouldSuppressCustomerPaymentConfirmation(payload: any) {
    return this.shouldSuppressLinkedInvoicePaymentNotification(payload);
  }

  private shouldSuppressAdminNotification(payload: any) {
    return Boolean(payload?.metadata?.suppressAdminNotification)
      || this.shouldSuppressLinkedInvoicePaymentNotification(payload);
  }

  private shouldSuppressLinkedInvoicePaymentNotification(payload: any) {
    const metadata = payload?.metadata || {};
    return String(payload?.sourceType || '').toUpperCase() === 'DEPOSIT' && (
      metadata.suppressCustomerZaloConfirmation === true ||
      metadata.linkedInvoicePayment === true ||
      String(metadata.collectionNote || '').toLowerCase().startsWith('sepay invoice confirmation') ||
      String(metadata.idempotencyKey || '').startsWith('sepay:invoice:') ||
      String(metadata.idempotencyKey || '').startsWith('sepay:security-deposit-invoice:')
    );
  }

  private buildPaymentStatusLabel(payload: any) {
    const status = String(payload?.metadata?.paymentStatus || '').toUpperCase();
    const provider = String(payload?.paymentProvider || '').trim().toUpperCase();
    const method = provider === 'MANUAL' ? 'tiền mặt' : 'VietQR';
    if (status === 'PAID') return `Đã thu đủ bằng ${method}`;
    if (status === 'PARTIALLY_PAID') return `Đã nhận một phần bằng ${method}`;
    return `Đã nhận thanh toán bằng ${method}`;
  }

  private buildPaymentReceiptMessage(payload: any, paymentAmount: number) {
    const provider = String(payload?.paymentProvider || '').trim().toUpperCase();
    const amount = Number(paymentAmount || 0).toLocaleString('vi-VN');
    if (provider === 'MANUAL') return `Đã nhận được thanh toán bằng tiền mặt với số tiền: ${amount} VND`;
    return `Đã nhận được thanh toán với số tiền: ${amount} VND`;
  }

  private buildSystemAlertContext(payload: any, params?: any, eventName?: string) {
    const alertKind = params?.alertKind
      || String(eventName || 'system.alert').replace(/\./g, '_').toUpperCase();
    const notificationParams = { ...params, alertKind };
    return {
      ...payload,
      title: params?.title || payload?.title || this.buildAdminZaloTitle(payload, notificationParams, eventName),
      message: params?.message || payload?.message || this.buildAdminZaloMessage(payload, notificationParams, eventName),
    };
  }

  private resolveAdminZaloTemplateCode(payload: any, params?: any, eventName?: string) {
    const configured = String(params?.templateCode || 'SYSTEM_ALERT');
    if (configured === 'ADMIN_INVOICE_PAID' && (
      payload?.metadata?.bookingHoldDepositInvoice === true ||
      String(payload?.metadata?.billingKind || '').toUpperCase() === 'BOOKING_HOLD'
    )) {
      return 'ADMIN_DEPOSIT_COLLECTED';
    }
    return configured;
  }

  /** All direct Zalo event templates share this complete, non-optional context. */
  private buildZaloEventTemplateContext(payload: any, params?: any, eventName?: string) {
    const metadata = payload?.metadata || {};
    const roomContext = buildRoomContext(payload?.room || payload?.contract?.room, payload?.contract);
    const roomCode = formatZaloRoom(payload?.roomCode || roomContext.roomCode || metadata.roomCode || '');
    const buildingName = payload?.buildingName || roomContext.buildingName || metadata.buildingName || '';
    const roomAndBuilding = roomCode || 'Chưa xác định phòng';
    const templateCode = String(params?.templateCode || 'SYSTEM_ALERT');
    const amount = Number(payload?.paymentAmount ?? payload?.amount ?? payload?.remainingAmount ?? 0);
    const paidAmount = Number(payload?.paidAmount ?? payload?.amount ?? 0);
    const remainingAmount = this.resolveRemainingAmount(payload);
    const dueDate = payload?.dueDate;
    const endDate = payload?.endDate;
    const formatMoney = (value: unknown) => formatZaloMoney(Math.max(0, Number(value || 0)));
    const formatDate = formatZaloDate;
    const eventKind = String(params?.alertKind || eventName || metadata.eventKind || '').toUpperCase();
    let headline = this.buildAdminZaloTitle(payload, params, eventName);
    let primaryValue = amount > 0 ? formatMoney(amount) : '';
    let secondaryValue = '';
    let action = '';

    if (templateCode === 'ADMIN_DEPOSIT_CREATED') {
      headline = roomCode ? '✅ CỌC GIỮ PHÒNG' : '🟡 YÊU CẦU CỌC MỚI';
      secondaryValue = roomCode ? 'Đang chờ thanh toán.' : 'Chưa xác định phòng.';
      action = roomCode ? '' : 'Cần chọn phòng.';
    } else if (templateCode === 'ADMIN_DEPOSIT_COLLECTED') {
      headline = remainingAmount > 0 ? '🟡 CỌC CHƯA ĐỦ' : '✅ ĐÃ NHẬN CỌC';
      primaryValue = remainingAmount > 0 ? `Đã nhận: ${formatMoney(paidAmount)}` : formatMoney(paidAmount);
      secondaryValue = remainingAmount > 0 ? `Còn thiếu: ${formatMoney(remainingAmount)}` : `Đã thu đủ • ${String(payload?.paymentProvider || '').toUpperCase() === 'MANUAL' ? 'Tiền mặt' : 'VietQR'}`;
      action = '';
    } else if (templateCode === 'ADMIN_INVOICE_PAID') {
      headline = '✅ THANH TOÁN';
      primaryValue = formatMoney(Number(payload?.paymentAmount ?? payload?.amount ?? 0));
      secondaryValue = `Đã thanh toán đủ • ${String(payload?.paymentProvider || '').toUpperCase() === 'MANUAL' ? 'Tiền mặt' : 'VietQR'}`;
    } else if (templateCode === 'ADMIN_INVOICE_PARTIAL') {
      headline = '🟡 THANH TOÁN MỘT PHẦN';
      primaryValue = `Đã nhận: ${formatMoney(Number(payload?.paymentAmount ?? payload?.amount ?? 0))}`;
      secondaryValue = `Còn thiếu: ${formatMoney(remainingAmount)}`;
      action = '';
    } else if (templateCode === 'ADMIN_INVOICE_DUE_SOON') {
      headline = '⏰ SẮP ĐẾN HẠN';
      primaryValue = `còn ${formatMoney(remainingAmount)}`;
      secondaryValue = dueDate ? `Hạn: ${formatDate(dueDate)}` : '';
    } else if (templateCode === 'ADMIN_INVOICE_OVERDUE') {
      headline = '🔴 QUÁ HẠN';
      primaryValue = `còn ${formatMoney(remainingAmount)}`;
      const overdueDays = dueDate ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000)) : 0;
      secondaryValue = overdueDays > 0 ? `Quá hạn: ${overdueDays} ngày` : 'Đã đến hạn thanh toán.';
      action = 'Cần liên hệ khách.';
    } else if (templateCode === 'ADMIN_CONTRACT_CREATED') {
      headline = '📄 HỢP ĐỒNG MỚI';
      primaryValue = [formatDate(payload?.startDate), formatDate(endDate)].filter(Boolean).join(' → ');
    } else if (templateCode === 'ADMIN_CONTRACT_SETTLEMENT_COMPLETED') {
      const refundToCustomer = Math.max(0, Number(
        metadata.refundToCustomer ?? metadata.settlement?.totals?.refundToCustomer ?? 0,
      ));
      const netReceivable = Math.max(0, Number(
        metadata.netReceivable ?? metadata.settlement?.totals?.netReceivable ?? amount,
      ));
      headline = '✅ QUYẾT TOÁN';
      primaryValue = refundToCustomer > 0
        ? `Cọc hoàn lại: ${formatMoney(refundToCustomer)}`
        : netReceivable > 0 ? `Còn thu: ${formatMoney(netReceivable)}` : 'Đã xử lý quyết toán.';
      secondaryValue = refundToCustomer > 0
        ? netReceivable > 0 ? `Còn thu: ${formatMoney(netReceivable)}` : 'Không còn công nợ.'
        : 'Không còn công nợ.';
      action = '';
    } else if (templateCode === 'ADMIN_DEPOSIT_CONVERTED' || templateCode === 'CLIENT_DEPOSIT_CONVERTED') {
      const transferred = Number(metadata.transferAmount ?? payload?.amount ?? 0);
      const additional = Number(metadata.additionalCashRequired ?? metadata.remainingAmount ?? 0);
      headline = templateCode.startsWith('ADMIN') ? '✅ CHUYỂN CỌC' : '✅ ĐÃ CHUYỂN TIỀN CỌC';
      primaryValue = additional > 0 ? `Đã chuyển: ${formatMoney(transferred)}` : formatMoney(transferred);
      secondaryValue = additional > 0 ? `Cần bổ sung: ${formatMoney(additional)}` : 'Đã chuyển vào cọc hợp đồng.';
    } else if (templateCode === 'ADMIN_DEPOSIT_REFUND_PENDING' || templateCode === 'CLIENT_DEPOSIT_REFUND_PENDING') {
      const refundAmount = Number(metadata.refundAmount ?? payload?.refundAmount ?? payload?.amount ?? 0);
      headline = templateCode.startsWith('ADMIN') ? '⏳ YÊU CẦU HOÀN CỌC' : '⏳ ĐANG XỬ LÝ HOÀN CỌC';
      primaryValue = templateCode.startsWith('ADMIN') ? `Chờ xử lý: ${formatMoney(refundAmount)}` : 'Yêu cầu hoàn cọc đã được tiếp nhận.';
      secondaryValue = 'Khoản hoàn chưa hoàn tất.';
      action = templateCode.startsWith('ADMIN') ? 'Kiểm tra và xử lý yêu cầu hoàn.' : 'HomeLand sẽ thông báo khi xử lý xong.';
    } else if (templateCode === 'ADMIN_DEPOSIT_REFUNDED' || templateCode === 'CLIENT_DEPOSIT_REFUNDED') {
      const refundAmount = Number(metadata.refundAmount ?? payload?.refundAmount ?? payload?.amount ?? 0);
      headline = templateCode.startsWith('ADMIN') ? '↩️ HOÀN CỌC' : '✅ ĐÃ HOÀN CỌC';
      primaryValue = templateCode.startsWith('ADMIN') ? `Đã hoàn: ${formatMoney(refundAmount)}` : `Số tiền: ${formatMoney(refundAmount)}`;
      secondaryValue = templateCode.startsWith('CLIENT') ? 'Khoản hoàn cọc đã được xử lý.' : '';
    } else if (templateCode === 'ADMIN_DEPOSIT_DEDUCTED' || templateCode === 'CLIENT_DEPOSIT_DEDUCTED') {
      const deducted = Number(metadata.deductAmount ?? metadata.keepAmount ?? payload?.amount ?? 0);
      headline = templateCode.startsWith('ADMIN') ? '➖ KHẤU TRỪ CỌC' : '➖ ĐÃ XỬ LÝ CỌC';
      primaryValue = templateCode.startsWith('ADMIN') ? `Khấu trừ: ${formatMoney(deducted)}` : 'Khoản cọc được giữ hoặc khấu trừ theo biên bản.';
      secondaryValue = metadata.reason || metadata.note || payload?.reason || '';
      action = templateCode.startsWith('ADMIN') ? '' : 'Liên hệ HomeLand nếu cần hỗ trợ.';
    } else if (templateCode === 'ADMIN_DEPOSIT_CANCELLED' || templateCode === 'CLIENT_DEPOSIT_CANCELLED') {
      headline = eventKind.includes('HOLD_EXPIRED') ? '⌛ GIỮ PHÒNG HẾT HẠN' : '❌ HỦY CỌC';
      primaryValue = eventKind.includes('HOLD_EXPIRED') ? 'Giữ phòng đã hết hạn.' : 'Yêu cầu giữ phòng đã được hủy.';
      secondaryValue = 'Theo trạng thái xử lý hiện tại.';
      action = templateCode.startsWith('CLIENT') ? 'Liên hệ HomeLand nếu cần hỗ trợ.' : '';
    }

    return {
      ...payload,
      ...roomContext,
      roomCode,
      buildingName,
      roomAndBuilding,
      customerName: payload?.customerName || metadata.customerName || 'Khách hàng',
      headline,
      primaryValue,
      secondaryValue,
      action,
      title: params?.title || payload?.title || headline,
      message: params?.message || payload?.message || buildAdminZaloEventMessage(payload, eventKind),
    };
  }

  private resolveRemainingAmount(payload: any) {
    const metadata = payload?.metadata || {};
    const paidAmount = Number(payload?.paidAmount ?? payload?.amount ?? 0);
    const grossTotal = Number(metadata.grossTotal ?? payload?.total ?? 0);
    const creditAmount = Number(metadata.creditAmount ?? payload?.creditAmount ?? 0);
    return Math.max(0, Number(payload?.remainingAmount ?? (grossTotal - paidAmount - creditAmount)));
  }

  private buildAdminPaymentTitle(payload: any) {
    const sourceType = String(payload?.sourceType || '').toUpperCase();
    const eventKind = String(payload?.metadata?.eventKind || '').toUpperCase();
    if (sourceType === 'REFUND' || eventKind.includes('REFUND')) {
      return `Admin - Hoàn cọc ${payload.metadata?.code || payload.sourceId || ''}`.trim();
    }
    if (sourceType === 'ADJUSTMENT') {
      return `Admin - ${eventKind.includes('RETAIN') ? 'Giữ lại' : 'Khấu trừ'} cọc ${payload.metadata?.code || payload.sourceId || ''}`.trim();
    }
    if (eventKind === 'DEPOSIT_CANCELLED') {
      return `Admin - Đã hủy cọc ${payload.metadata?.code || payload.sourceId || ''}`.trim();
    }
    if (eventKind === 'DEPOSIT_CONVERTED') {
      return `Admin - Đã chuyển cọc sang HĐ dài hạn ${payload.metadata?.code || payload.sourceId || ''}`.trim();
    }
    if (payload.sourceType === 'DEPOSIT' || payload.metadata?.bookingHoldDepositInvoice) {
      return `Admin - Đã nhận cọc giữ phòng ${payload.metadata?.code || ''}`.trim();
    }
    return `Admin - Đã nhận thanh toán ${payload.metadata?.code || ''}`.trim();
  }

  private buildAdminPaymentMessage(payload: any) {
    const sourceType = String(payload?.sourceType || '').toUpperCase();
    const eventKind = String(payload?.metadata?.eventKind || '').toUpperCase();
    const code = payload.metadata?.code || payload.sourceId || '-';
    const paymentRoomLabel = payload.roomCode ? `\nPhòng: ${payload.roomCode}` : '';
    const paymentBuildingLabel = payload.buildingName ? `\nTòa nhà: ${payload.buildingName}` : '';
    const reason = payload.metadata?.reason || payload.metadata?.note || payload.reason || '';
    const amount = Number(payload.paymentAmount ?? payload.amount ?? 0);
    if (sourceType === 'REFUND' || eventKind.includes('REFUND')) {
      return [
        'HomeLand Admin - Hoàn tiền cọc',
        `Mã phiếu: ${code}`,
        `Khách: ${payload.customerName || '-'}`,
        `Số tiền hoàn: ${amount.toLocaleString('vi-VN')} VND`,
        payload.metadata?.originalAmount != null
          ? `Tiền cọc ban đầu: ${Number(payload.metadata.originalAmount).toLocaleString('vi-VN')} VND`
          : null,
        payload.metadata?.retainedAmount > 0
          ? `Giữ lại: ${Number(payload.metadata.retainedAmount).toLocaleString('vi-VN')} VND`
          : null,
        payload.metadata?.refundStatus ? `Trạng thái hoàn: ${payload.metadata.refundStatus}` : null,
        reason ? `Lý do: ${reason}` : null,
        paymentRoomLabel ? paymentRoomLabel.trimStart() : null,
        paymentBuildingLabel ? paymentBuildingLabel.trimStart() : null,
        `Thời gian: ${this.formatDateTime(payload.occurredAt || new Date().toISOString())}`,
      ].filter(Boolean).join('\n');
    }
    if (sourceType === 'ADJUSTMENT' || eventKind === 'DEPOSIT_CANCELLED' || eventKind === 'DEPOSIT_CONVERTED') {
      const metadata = payload.metadata || {};
      return [
        eventKind === 'DEPOSIT_CONVERTED'
          ? 'HomeLand Admin - Đã chuyển cọc giữ phòng sang cọc hợp đồng'
          : eventKind === 'DEPOSIT_CANCELLED'
            ? 'HomeLand Admin - Đã hủy cọc'
            : 'HomeLand Admin - Điều chỉnh tiền cọc',
        `Mã phiếu: ${code}`,
        `Khách: ${payload.customerName || '-'}`,
        amount > 0 ? `Số tiền xử lý: ${amount.toLocaleString('vi-VN')} VND` : null,
        metadata.transferAmount != null ? `Đã chuyển sang cọc HĐ: ${Number(metadata.transferAmount).toLocaleString('vi-VN')} VND` : null,
        metadata.additionalCashRequired != null ? `Còn phải thu thêm: ${Number(metadata.additionalCashRequired).toLocaleString('vi-VN')} VND` : null,
        metadata.excessAmount != null ? `Tiền dư: ${Number(metadata.excessAmount).toLocaleString('vi-VN')} VND` : null,
        metadata.refundAmount != null && Number(metadata.refundAmount) > 0
          ? `Số tiền hoàn: ${Number(metadata.refundAmount).toLocaleString('vi-VN')} VND`
          : null,
        metadata.keepAmount != null && Number(metadata.keepAmount) > 0
          ? `Giữ lại: ${Number(metadata.keepAmount).toLocaleString('vi-VN')} VND`
          : null,
        metadata.deductAmount != null && Number(metadata.deductAmount) > 0
          ? `Khấu trừ: ${Number(metadata.deductAmount).toLocaleString('vi-VN')} VND`
          : null,
        reason ? `Lý do: ${reason}` : null,
        paymentRoomLabel ? paymentRoomLabel.trimStart() : null,
        paymentBuildingLabel ? paymentBuildingLabel.trimStart() : null,
        `Thời gian: ${this.formatDateTime(payload.occurredAt || new Date().toISOString())}`,
      ].filter(Boolean).join('\n');
    }
    const isBookingHold = payload.sourceType === 'DEPOSIT' || Boolean(payload.metadata?.bookingHoldDepositInvoice);
    const sourceLabel = isBookingHold ? 'Cọc giữ phòng' : 'Hóa đơn';
    const roomLabel = payload.roomCode ? `\nPhòng: ${payload.roomCode}${payload.roomRentalTypeLabel ? ` (${payload.roomRentalTypeLabel})` : ''}` : '';
    const buildingLabel = payload.buildingName ? `\nTòa nhà: ${payload.buildingName}` : '';
    const memberLabel = payload.roomMemberCount ? `\nSố người: ${payload.roomMemberCount}` : '';
    const receivedAt = payload.paidAt || payload.occurredAt || new Date().toISOString();
    const moveInAt = payload.moveInDate || payload.expectedMoveInDate || payload.startDate || payload.contract?.startDate || payload.metadata?.moveInDate || payload.metadata?.startDate;
    const receivedAtLabel = this.formatDateTime(receivedAt);
    const moveInLabel = moveInAt ? this.formatDateTime(moveInAt) : '';
    return [
      isBookingHold ? 'HomeLand Admin - Đã nhận thanh toán cọc giữ phòng' : 'HomeLand Admin - Đã nhận thanh toán',
      `${sourceLabel}: ${payload.metadata?.code || payload.sourceId || '-'}`,
      `Khách: ${payload.customerName || '-'}`,
      `Số tiền nhận lần này: ${Number(payload.paymentAmount ?? payload.amount ?? 0).toLocaleString('vi-VN')} VND`,
      payload.paidAmount != null
        ? `Đã thanh toán cộng dồn: ${Number(payload.paidAmount || 0).toLocaleString('vi-VN')} VND`
        : null,
      receivedAtLabel ? `Thời gian nhận: ${receivedAtLabel}` : null,
      payload.paymentRef ? `Mã giao dịch: ${payload.paymentRef}` : null,
      moveInLabel ? `Ngày vào ở/dự kiến vào ở: ${moveInLabel}` : null,
      roomLabel ? roomLabel.trimStart() : null,
      buildingLabel ? buildingLabel.trimStart() : null,
      memberLabel ? memberLabel.trimStart() : null,
      isBookingHold ? 'Việc cần làm: xác nhận đã thu cọc, giữ phòng, chuẩn bị phòng và nhắc khách lịch vào ở.' : null,
    ].filter(Boolean).join('\n');
  }

  private formatDateTime(value: any) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private isPaymentAdminZaloEvent(eventName?: string, payload?: any) {
    return ['invoice.paid', 'invoice.payment.recorded', 'deposit.collected'].includes(String(eventName || ''))
      || Boolean(payload?.paymentProvider || payload?.paymentRef || payload?.paymentId);
  }

  private buildAdminZaloTitle(payload: any, params?: any, eventName?: string) {
    if (this.isPaymentAdminZaloEvent(eventName, payload)) return this.buildAdminPaymentTitle(payload);
    const code = payload.metadata?.code || payload.invoiceCode || payload.contractCode || payload.depositCode || payload.code || payload.sourceId || '';
    const kind = String(params?.alertKind || eventName || '').toUpperCase();
    if (kind.includes('DEPOSIT_REFUNDED')) return `Đã hoàn cọc ${code}`.trim();
    if (kind.includes('DEPOSIT_DEDUCTED')) return `Đã khấu trừ cọc ${code}`.trim();
    if (kind.includes('DEPOSIT_CANCELLED')) return `Đã hủy cọc ${code}`.trim();
    if (kind.includes('DEPOSIT_CONVERTED')) return `Đã chuyển cọc sang HĐ dài hạn ${code}`.trim();
    if (kind.includes('DEPOSIT_CREATED')) return `Cọc giữ phòng mới ${code}`.trim();
    if (kind.includes('INVOICE_OVERDUE')) return `Khách trễ thanh toán ${code}`.trim();
    if (kind.includes('INVOICE_ISSUED')) return `Đã phát hành hóa đơn ${code}`.trim();
    if (kind.includes('CONTRACT_CREATED')) return `Hợp đồng mới ${code}`.trim();
    if (kind.includes('SETTLEMENT')) return `Cập nhật quyết toán hợp đồng ${code}`.trim();
    if (kind.includes('REFUND')) return `Yêu cầu xử lý cọc ${code}`.trim();
    return `HomeLand - Thông báo vận hành ${code}`.trim();
  }

  private buildAdminZaloMessage(payload: any, params?: any, eventName?: string) {
    if (this.isPaymentAdminZaloEvent(eventName, payload)) return this.buildAdminPaymentMessage(payload);
    const code = payload.metadata?.code || payload.invoiceCode || payload.contractCode || payload.depositCode || payload.code || payload.sourceId || '-';
    const amount = Number(payload.paymentAmount ?? payload.remainingAmount ?? payload.amount ?? payload.total ?? 0);
    const dateValue = payload.dueDate || payload.endDate || payload.startDate || payload.moveInDate || payload.expectedMoveInDate || payload.occurredAt;
    const dateLabel = dateValue ? new Date(dateValue).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' }) : '';
    const roomCode = payload.roomCode || payload.metadata?.roomCode || '';
    const buildingName = payload.buildingName || payload.metadata?.buildingName || '';
    const customerName = payload.customerName || payload.metadata?.customerName || '-';
    const kind = String(params?.alertKind || eventName || '').toUpperCase();
    if (kind.includes('DEPOSIT_REFUNDED') || kind.includes('DEPOSIT_DEDUCTED') || kind.includes('DEPOSIT_CANCELLED') || kind.includes('DEPOSIT_CONVERTED')) {
      return this.buildAdminPaymentMessage({
        ...payload,
        metadata: { ...(payload.metadata || {}), eventKind: kind },
      });
    }
    const header = kind.includes('DEPOSIT_CREATED')
      ? 'HomeLand - Cần chuẩn bị phòng/đặt lịch khách vào ở'
      : kind.includes('INVOICE_OVERDUE')
        ? 'HomeLand - Cảnh báo khách trễ thanh toán'
        : kind.includes('INVOICE_ISSUED')
          ? 'HomeLand - Hóa đơn mới cần theo dõi'
          : kind.includes('CONTRACT_CREATED')
            ? 'HomeLand - Hợp đồng mới cần theo dõi'
            : kind.includes('SETTLEMENT')
              ? 'HomeLand - Quyết toán hợp đồng'
              : 'HomeLand - Thông báo vận hành';

    return [
      header,
      `Mã: ${code}`,
      `Khách: ${customerName}`,
      roomCode ? `Phòng: ${roomCode}${payload.roomRentalTypeLabel ? ` (${payload.roomRentalTypeLabel})` : ''}` : null,
      buildingName ? `Tòa nhà: ${buildingName}` : null,
      amount > 0 ? `Số tiền: ${amount.toLocaleString('vi-VN')} VND` : null,
      dateLabel ? `Mốc thời gian: ${dateLabel}` : null,
      payload.status ? `Trạng thái: ${payload.status}` : null,
      kind.includes('DEPOSIT_CREATED') ? 'Việc cần làm: xác nhận cọc, giữ phòng, chuẩn bị phòng và nhắc lịch khách vào ở.' : null,
      kind.includes('INVOICE_OVERDUE') ? 'Việc cần làm: liên hệ khách, nhắc thanh toán và kiểm tra công nợ còn phải thu.' : null,
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

    try {
      return await this.prisma.chartOfAccount.create({
        data: {
          tenantId,
          code,
          name: fallbackName,
          type: fallbackType,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.chartOfAccount.findFirst({
          where: { tenantId, code },
        });
      }
      throw error;
    }
  }
}
