import { Injectable, Logger } from '@nestjs/common';
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
             templateCode: 'SYSTEM_ALERT',
             context: {
               title: `Hoa don ${context.invoiceCode || ''} sap den han`.trim(),
               message: `Hoa don ${context.invoiceCode || ''} se den han vao ${context.dueDate ? new Date(context.dueDate).toLocaleDateString('vi-VN') : 'thoi gian sap toi'}. So tien con lai: ${Number(context.remainingAmount || 0).toLocaleString('vi-VN')} VND.`,
             }
          });
        } else if (ruleName === 'invoice.overdue.7_days') {
          await this.communicationService.dispatch({
             tenantId,
             userId: context.customerId,
             templateCode: 'INVOICE_OVERDUE',
             context
          });
        } else if (ruleName === 'contract.expiring.30_days') {
          await this.communicationService.dispatch({
             tenantId,
             userId: context.customerId,
             templateCode: 'SYSTEM_ALERT',
             context: {
               title: `Hop dong ${context.contractCode || ''} sap het han`.trim(),
               message: `Hop dong ${context.contractCode || ''} cua phong ${context.roomCode || ''} se het han vao ${context.endDate ? new Date(context.endDate).toLocaleDateString('vi-VN') : 'thoi gian sap toi'}.`,
             }
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
}
