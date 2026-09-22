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
          const roomLabel = context.roomCode
            ? `phòng ${context.roomCode}${context.roomRentalTypeLabel ? ` (${context.roomRentalTypeLabel})` : ''}`
            : 'phòng thuê';
          await this.communicationService.dispatch({
             tenantId,
             userId: context.customerId,
             templateCode: 'SYSTEM_ALERT',
             context: {
               title: `Hoa don ${context.invoiceCode || ''} sap den han`.trim(),
               message: `Hoa don ${context.invoiceCode || ''} cua ${roomLabel} se den han vao ${context.dueDate ? new Date(context.dueDate).toLocaleDateString('vi-VN') : 'thoi gian sap toi'}. So tien con lai: ${Number(context.remainingAmount || 0).toLocaleString('vi-VN')} VND.`,
             }
          });
          await this.sendAdminGroupZaloAlert(tenantId, {
            title: `Sắp đến hạn thanh toán ${context.invoiceCode || ''}`.trim(),
            message: this.buildAdminReminderMessage('HomeLand - Hóa đơn sắp đến hạn', context),
          });
        } else if (ruleName === 'invoice.overdue.7_days') {
          await this.communicationService.dispatch({
             tenantId,
             userId: context.customerId,
             templateCode: 'INVOICE_OVERDUE',
             context
          });
          await this.sendAdminGroupZaloAlert(tenantId, {
            title: `Khách trễ thanh toán ${context.invoiceCode || ''}`.trim(),
            message: this.buildAdminReminderMessage('HomeLand - Cảnh báo khách trễ thanh toán', context),
          });
        } else if (ruleName === 'contract.expiring.30_days') {
          const roomLabel = context.roomCode
            ? `phòng ${context.roomCode}${context.roomRentalTypeLabel ? ` (${context.roomRentalTypeLabel})` : ''}`
            : 'phong thue';
          await this.communicationService.dispatch({
             tenantId,
             userId: context.customerId,
             templateCode: 'SYSTEM_ALERT',
             context: {
               title: `Hop dong ${context.contractCode || ''} sap het han`.trim(),
               message: `Hop dong ${context.contractCode || ''} cua ${roomLabel} se het han vao ${context.endDate ? new Date(context.endDate).toLocaleDateString('vi-VN') : 'thoi gian sap toi'}.`,
             }
          });
          await this.sendAdminGroupZaloAlert(tenantId, {
            title: `Hợp đồng sắp đến hạn ${context.contractCode || ''}`.trim(),
            message: this.buildAdminReminderMessage('HomeLand - Hợp đồng sắp đến hạn', context),
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
    } catch (err) {
      this.logger.error(`Rule ${ruleName} failed`, err.stack);
      await this.prisma.ruleExecution.update({
        where: { id: execution.id },
        data: { status: WorkflowStatus.FAILED, completedAt: new Date(), error: err.message }
      });
    }
  }

  private async sendAdminGroupZaloAlert(tenantId: string, input: { title: string; message: string }) {
    const recipient = await this.resolveAdminGroupChatId(tenantId);
    if (!recipient) return;
    try {
      await this.communicationService.dispatchDirect({
        tenantId,
        channel: 'ZALO' as any,
        templateCode: 'SYSTEM_ALERT',
        recipient,
        userId: null,
        context: input,
      });
    } catch (error: any) {
      this.logger.error(`Admin group Zalo rule alert failed: ${error?.message || error}`);
    }
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
