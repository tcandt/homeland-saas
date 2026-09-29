import { Injectable, Logger } from '@nestjs/common';
import { SettingScope } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { RULE_REGISTRY } from './rule.registry';
import { WorkflowStatus } from '../automation.constants';
import { CommunicationService } from '../../communication/communication.service';

@Injectable()
export class RuleEngine {
  private readonly logger = new Logger(RuleEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationService: CommunicationService
  ) {}

  getRules() {
    return RULE_REGISTRY.map(r => ({ name: r.name, description: r.description }));
  }

  async executeRule(ruleName: string, context: any) {
    const rule = RULE_REGISTRY.find(r => r.name === ruleName);
    if (!rule) {
      this.logger.warn(`Rule ${ruleName} not found`);
      return;
    }

    const tenantId = context.tenantId || 'SYSTEM';
    const correlationId = context?.correlationId ? String(context.correlationId) : null;

    if (correlationId) {
      const existingExecution = await this.prisma.ruleExecution.findFirst({
        where: {
          tenantId,
          ruleName,
          correlationId,
          status: { in: [WorkflowStatus.RUNNING, WorkflowStatus.SUCCESS] as any },
        },
        select: { id: true, status: true, completedAt: true },
      });

      if (existingExecution) {
        this.logger.debug(`Skipping duplicate rule execution ${ruleName} (${correlationId})`);
        return {
          skipped: true,
          reason: 'DUPLICATE_CORRELATION',
          executionId: existingExecution.id,
          status: existingExecution.status,
        };
      }
    }

    const execution = await this.prisma.ruleExecution.create({
      data: {
        tenantId,
        ruleName,
        correlationId,
        status: WorkflowStatus.RUNNING,
        startedAt: new Date(),
        input: context
      }
    });

    try {
      const isMatch = await rule.condition(context);
      if (isMatch) {
        this.logger.log(`Rule ${ruleName} CONDITION MET. Executing action.`);
        
        // Execute dynamic action
        if (ruleName === 'invoice.due_soon.3_days') {
          await this.communicationService.dispatch({
             tenantId,
             userId: context.customerId,
             templateCode: 'CLIENT_INVOICE_DUE_SOON',
             context: this.buildClientRuleTemplateContext('CLIENT_INVOICE_DUE_SOON', context),
          });
          await this.sendAdminGroupZaloAlert(tenantId, {
            templateCode: 'ADMIN_INVOICE_DUE_SOON',
            title: `Sắp đến hạn thanh toán ${context.invoiceCode || ''}`.trim(),
            context,
          });
        } else if (ruleName === 'invoice.overdue.7_days') {
          await this.communicationService.dispatch({
             tenantId,
             userId: context.customerId,
             templateCode: 'INVOICE_OVERDUE',
             context: this.buildClientRuleTemplateContext('INVOICE_OVERDUE', context),
          });
          await this.sendAdminGroupZaloAlert(tenantId, {
            templateCode: 'ADMIN_INVOICE_OVERDUE',
            title: `Khách trễ thanh toán ${context.invoiceCode || ''}`.trim(),
            context,
          });
        } else if (ruleName === 'contract.expiring.30_days') {
          await this.communicationService.dispatch({
             tenantId,
             userId: context.customerId,
             templateCode: 'CLIENT_CONTRACT_EXPIRING',
             context: this.buildClientRuleTemplateContext('CLIENT_CONTRACT_EXPIRING', context),
          });
          await this.sendAdminGroupZaloAlert(tenantId, {
            templateCode: 'ADMIN_CONTRACT_EXPIRING',
            title: `Hợp đồng sắp đến hạn ${context.contractCode || ''}`.trim(),
            context,
          });
        } else if (ruleName === 'invoice.payment_promise_due') {
          await this.communicationService.dispatch({
            tenantId,
            userId: context.customerId,
            templateCode: 'CLIENT_PAYMENT_PROMISE_DUE',
            context: this.buildClientRuleTemplateContext('CLIENT_PAYMENT_PROMISE_DUE', context),
          });
          await this.sendAdminGroupZaloAlert(tenantId, {
            templateCode: 'ADMIN_PAYMENT_PROMISE_DUE',
            title: `Khách đến hẹn thanh toán ${context.invoiceCode || ''}`.trim(),
            context,
          });
          await this.prisma.task.create({
            data: {
              tenantId,
              title: `Theo dõi hẹn thanh toán ${context.invoiceCode || context.paymentPromiseId || ''}`.trim(),
              description: `PaymentPromise ${context.paymentPromiseId || '-'} đã đến hạn. Dư nợ còn lại: ${Number(context.remainingAmount || 0).toLocaleString('vi-VN')} VND.`,
              status: 'TODO' as any,
              priority: 'HIGH' as any,
              dueDate: new Date(),
            },
          });
        }

        await rule.action(context);
      } else {
        this.logger.log(`Rule ${ruleName} condition NOT met.`);
      }

      await this.prisma.ruleExecution.update({
        where: { id: execution.id },
        data: { status: WorkflowStatus.SUCCESS, completedAt: new Date(), output: { isMatch } }
      });
      return { id: execution.id, status: WorkflowStatus.SUCCESS };
    } catch (err) {
      this.logger.error(`Rule ${ruleName} failed`, err.stack);
      const error = err?.message || String(err || 'Unknown rule error');
      await this.prisma.ruleExecution.update({
        where: { id: execution.id },
        data: { status: WorkflowStatus.FAILED, completedAt: new Date(), error }
      });
      return { id: execution.id, status: WorkflowStatus.FAILED, error };
    }
  }

  private async sendAdminGroupZaloAlert(tenantId: string, input: { title: string; templateCode: string; context: any }) {
    const recipient = await this.resolveAdminGroupChatId(tenantId);
    if (!recipient) return;
    try {
      await this.communicationService.dispatchDirect({
        tenantId,
        channel: 'ZALO' as any,
        templateCode: input.templateCode,
        recipient,
        userId: null,
        context: this.buildRuleTemplateContext(input),
      });
    } catch (error: any) {
      this.logger.error(`Admin group Zalo rule alert failed: ${error?.message || error}`);
    }
  }

  private buildRuleTemplateContext(input: { title: string; templateCode: string; context: any }) {
    const context = input.context || {};
    const amount = Math.max(0, Number(context.remainingAmount ?? context.total ?? 0));
    const dateValue = context.dueDate || context.endDate || context.startDate;
    const date = dateValue ? new Date(dateValue) : null;
    const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Bangkok' }) : '';
    const roomAndBuilding = context.roomAndBuilding || [context.roomCode, context.buildingName].filter(Boolean).join(' - ') || 'Phòng chưa xác định';
    const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
    const overdueDays = context.dueDate
      ? Math.max(0, Math.floor((Date.now() - new Date(context.dueDate).getTime()) / 86_400_000))
      : 0;
    const isContract = input.templateCode === 'ADMIN_CONTRACT_EXPIRING';
    const isDueSoon = input.templateCode === 'ADMIN_INVOICE_DUE_SOON';
    const isPaymentPromise = input.templateCode === 'ADMIN_PAYMENT_PROMISE_DUE';
    return {
      ...context,
      roomAndBuilding,
      customerName: context.customerName || 'Khách hàng',
      headline: isContract ? '⏳ SẮP HẾT HỢP ĐỒNG' : isPaymentPromise ? '🔴 ĐẾN HẸN THANH TOÁN' : isDueSoon ? '⏰ SẮP ĐẾN HẠN' : '🔴 QUÁ HẠN',
      primaryValue: isContract ? `Hết hạn: ${dateLabel}` : `Còn ${formatMoney(amount)}`,
      secondaryValue: isContract ? '' : isPaymentPromise ? 'Khách đã đến hẹn thanh toán.' : isDueSoon ? `Hạn: ${dateLabel}` : overdueDays > 0 ? `Quá hạn: ${overdueDays} ngày` : 'Đã đến hạn thanh toán.',
      action: isContract ? 'Xác nhận gia hạn hoặc trả phòng.' : isDueSoon ? '' : 'Cần liên hệ khách.',
      title: input.title,
      message: this.buildAdminReminderMessage(input.title, context),
    };
  }

  private buildClientRuleTemplateContext(templateCode: string, context: any) {
    const amount = Math.max(0, Number(context?.remainingAmount ?? context?.total ?? 0));
    const dateValue = templateCode === 'CLIENT_CONTRACT_EXPIRING'
      ? context?.endDate
      : (context?.promiseDueDate || context?.dueDate);
    const date = dateValue ? new Date(dateValue) : null;
    const dateLabel = date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Bangkok' })
      : '';
    const roomAndBuilding = context?.roomAndBuilding
      || [context?.roomCode, context?.buildingName].filter(Boolean).join(' - ')
      || 'Phòng chưa xác định';
    const amountLabel = `${amount.toLocaleString('vi-VN')} đ`;
    const isContract = templateCode === 'CLIENT_CONTRACT_EXPIRING';
    const isPromise = templateCode === 'CLIENT_PAYMENT_PROMISE_DUE';
    const isOverdue = templateCode === 'INVOICE_OVERDUE';
    const overdueDays = context?.dueDate
      ? Math.max(0, Math.floor((Date.now() - new Date(context.dueDate).getTime()) / 86_400_000))
      : 0;

    return {
      ...context,
      roomAndBuilding,
      customerName: context?.customerName || 'Khách hàng',
      headline: isContract
        ? '⏳ HỢP ĐỒNG SẮP HẾT HẠN'
        : isOverdue ? '🔴 THANH TOÁN QUÁ HẠN'
          : isPromise ? '⏰ ĐẾN HẸN THANH TOÁN' : '⏰ NHẮC THANH TOÁN',
      primaryValue: isContract ? `Hết hạn: ${dateLabel}` : `Còn phải thanh toán: ${amountLabel}`,
      secondaryValue: isPromise
        ? 'Khoản thanh toán đã hẹn hôm nay đến hạn.'
        : isOverdue ? (overdueDays > 0 ? `Đã quá hạn ${overdueDays} ngày.` : 'Đã đến hạn thanh toán.')
          : isContract ? '' : `Hạn thanh toán: ${dateLabel}`,
      action: isContract
        ? 'Anh/Chị vui lòng xác nhận gia hạn hoặc trả phòng.'
        : isOverdue
          ? 'Anh/Chị vui lòng thanh toán sớm hoặc liên hệ HomeLand nếu cần hỗ trợ.'
        : isPromise
          ? 'Anh/Chị vui lòng thanh toán hoặc liên hệ HomeLand nếu cần hỗ trợ.'
          : 'Anh/Chị vui lòng thanh toán đúng hạn.',
      remainingAmountDisplay: amountLabel,
      overdueLabel: overdueDays > 0 ? `Đã quá hạn ${overdueDays} ngày.` : 'Đã đến hạn thanh toán.',
    };
  }

  private async resolveAdminGroupChatId(tenantId: string) {
    const setting = await this.prisma.appSetting?.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'zalo-provider',
        },
      },
    }).catch(() => null);
    const settings = (setting?.value as any) || {};
    if (String(settings.adminGroupChatId || '').trim()) {
      return String(settings.adminGroupChatId).trim();
    }
    const sepaySetting = await this.prisma.appSetting?.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'sepay',
        },
      },
    }).catch(() => null);
    return String((sepaySetting?.value as any)?.adminGroupChatId || '').trim();
  }

  private buildAdminReminderMessage(title: string, context: any) {
    const amount = Number(context.remainingAmount ?? context.total ?? 0);
    const dateValue = context.dueDate || context.endDate || context.startDate;
    return [
      title,
      context.invoiceCode ? `Hóa đơn: ${context.invoiceCode}` : null,
      context.contractCode ? `Hợp đồng: ${context.contractCode}` : null,
      `Khách: ${context.customerName || '-'}`,
      context.roomCode ? `Phòng: ${context.roomCode}${context.roomRentalTypeLabel ? ` (${context.roomRentalTypeLabel})` : ''}` : null,
      context.buildingName ? `Tòa nhà: ${context.buildingName}` : null,
      amount > 0 ? `Còn phải thu: ${amount.toLocaleString('vi-VN')} VND` : null,
      dateValue ? `Ngày hạn: ${new Date(dateValue).toLocaleDateString('vi-VN')}` : null,
      title.includes('trễ') ? 'Việc cần làm: liên hệ khách và kiểm tra lại công nợ/thanh toán.' : 'Việc cần làm: nhắc khách và chuẩn bị xử lý trước hạn.',
    ].filter(Boolean).join('\n');
  }
}
