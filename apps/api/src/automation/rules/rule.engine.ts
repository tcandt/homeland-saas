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

    const execution = await this.prisma.ruleExecution.create({
      data: {
        tenantId,
        ruleName,
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
        if (ruleName === 'invoice.overdue.7_days') {
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
             context: { title: 'Contract Expiring Soon', message: 'Your contract will expire in 30 days.' }
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
