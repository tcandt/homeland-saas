import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkflowStatus } from './automation.constants';
import { WorkflowEngine } from './workflow/workflow.engine';
import { RuleEngine } from './rules/rule.engine';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly ruleEngine: RuleEngine,
  ) {}

  async triggerWorkflow(workflowName: string, eventName: string, payload: any) {
    this.logger.log(`Triggering workflow ${workflowName} for event ${eventName}`);
    return await this.workflowEngine.executeWorkflow(workflowName, eventName, payload);
  }

  async runRule(ruleName: string, context?: any) {
    this.logger.log(`Running rule ${ruleName}`);
    return await this.ruleEngine.executeRule(ruleName, context);
  }

  async getWorkflows() {
    return this.workflowEngine.getWorkflows();
  }

  async getRules() {
    return this.ruleEngine.getRules();
  }

  async getExecutions(tenantId: string) {
    return this.prisma.workflowExecution.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { steps: true }
    });
  }

  async getExecutionById(tenantId: string, id: string) {
    return this.prisma.workflowExecution.findUnique({
      where: { id },
      include: { steps: true }
    });
  }
}
