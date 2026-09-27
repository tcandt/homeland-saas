import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async runWorkflow(workflowName: string, tenantId: string, payload: any) {
    this.logger.log(`Manually running workflow ${workflowName}`);
    const execution = await this.workflowEngine.executeWorkflow(workflowName, 'manual_run', {
      ...(payload || {}),
      tenantId,
    });
    return this.manualExecutionResponse(execution);
  }

  async runRule(ruleName: string, tenantId: string, context?: any) {
    this.logger.log(`Running rule ${ruleName}`);
    const execution = await this.ruleEngine.executeRule(ruleName, {
      ...(context || {}),
      tenantId,
    });
    return this.manualExecutionResponse(execution);
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
    const workflowExecution = await this.prisma.workflowExecution.findFirst({
      where: { id, tenantId },
      include: { steps: true }
    });
    if (workflowExecution) {
      return workflowExecution;
    }

    const ruleExecution = await this.prisma.ruleExecution.findFirst({
      where: { id, tenantId },
    });
    if (ruleExecution) {
      return ruleExecution;
    }

    throw new NotFoundException('Execution not found');
  }

  private manualExecutionResponse(execution: any) {
    const executionId = execution?.executionId || execution?.id;
    const status = execution?.status;
    if (!executionId || !status) {
      throw new NotFoundException('Automation definition not found');
    }

    return {
      executionId,
      status,
      ...(execution.error ? { error: execution.error } : {}),
    };
  }
}
