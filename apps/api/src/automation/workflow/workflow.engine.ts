import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { WORKFLOW_REGISTRY } from './workflow.registry';
import { WorkflowStatus } from '../automation.constants';
import { CommunicationService } from '../../communication/communication.service';
import { AnalyticsCacheService } from '../../analytics/analytics-cache.service';
import { JournalEntryService } from '../../finance/journal-entry.service';

import { DocumentsService } from '../../documents/documents.service';

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationService: CommunicationService,
    private readonly analyticsCache: AnalyticsCacheService,
    private readonly journalEntryService: JournalEntryService,
    private readonly documentsService: DocumentsService
  ) {}

  getWorkflows() {
    return WORKFLOW_REGISTRY;
  }

  async executeWorkflow(workflowName: string, eventName: string, payload: any) {
    const workflow = WORKFLOW_REGISTRY.find(w => w.name === workflowName);
    if (!workflow) {
      this.logger.warn(`Workflow ${workflowName} not found`);
      return;
    }

    const tenantId = payload.tenantId;

    // Create execution record
    const execution = await this.prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowName,
        eventName,
        status: WorkflowStatus.RUNNING,
        startedAt: new Date(),
        input: payload,
      }
    });

    try {
      // Sort steps
      const steps = [...workflow.steps].sort((a, b) => a.order - b.order);

      for (const step of steps) {
        // Create step record
        const stepExec = await this.prisma.workflowStepExecution.create({
          data: {
            workflowExecutionId: execution.id,
            stepName: step.name,
            stepType: step.type,
            order: step.order,
            status: WorkflowStatus.RUNNING,
            startedAt: new Date(),
            input: payload,
          }
        });

        try {
          // Execute step logic
          await this.executeStep(step.type, payload, step.params, eventName);
          
          await this.prisma.workflowStepExecution.update({
            where: { id: stepExec.id },
            data: { status: WorkflowStatus.SUCCESS, completedAt: new Date() }
          });
        } catch (stepErr) {
          await this.prisma.workflowStepExecution.update({
            where: { id: stepExec.id },
            data: { status: WorkflowStatus.FAILED, completedAt: new Date(), error: stepErr.message }
          });
          throw stepErr; // Halt workflow
        }
      }

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: WorkflowStatus.SUCCESS, completedAt: new Date() }
      });
      this.logger.log(`Workflow ${workflowName} completed successfully.`);
    } catch (err) {
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: WorkflowStatus.FAILED, completedAt: new Date(), error: err.message }
      });
      this.logger.error(`Workflow ${workflowName} failed`, err.stack);
    }
  }

  private async executeStep(type: string, payload: any, params?: any, eventName?: string) {
    this.logger.debug(`Executing step: ${type}`);
    switch (type) {
      case 'CREATE_JOURNAL_ENTRY':
        if (payload.amount) {
           const bankAccount = await this.prisma.chartOfAccount.findFirst({
             where: { tenantId: payload.tenantId, code: '1100' } 
           });
           const depositLiabilityAccount = await this.prisma.chartOfAccount.findFirst({
             where: { tenantId: payload.tenantId, code: '1300' }
           });
           
           if (!bankAccount || !depositLiabilityAccount) {
             throw new Error('Required Chart of Accounts not found');
           }

             await this.journalEntryService.createJournalEntry(payload.tenantId, {
               code: `JE-${payload.sourceType || 'SYS'}-${Date.now()}`,
               sourceType: payload.sourceType || 'UNKNOWN',
               sourceId: payload.id || payload.sourceId,
               description: payload.metadata?.code ? `Ghi nhan ${payload.sourceType} ${payload.metadata.code}` : `Ghi nhan ${payload.sourceType}`,
               entryDate: new Date(),
             status: 'POSTED',
             lines: [
               { accountId: bankAccount.id, type: 'DEBIT', amount: payload.amount, description: 'Tiền cọc vào NH' },
               { accountId: depositLiabilityAccount.id, type: 'CREDIT', amount: payload.amount, description: 'Phải trả cọc' }
             ]
           });
        }
        break;
      case 'CREATE_IN_APP_NOTIFICATION':
        await this.communicationService.dispatch({
           tenantId: payload.tenantId,
           userId: payload.customerId || payload.userId,
           templateCode: params?.templateCode || 'SYSTEM_ALERT',
           context: payload
        });
        break;
      case 'INVALIDATE_DASHBOARD_CACHE':
        // Not actual clear all, but selective prefix logic. 
        // We will call the cache service methods.
        await this.analyticsCache.invalidateDashboard(payload.tenantId);
        break;
      case 'INVALIDATE_FINANCE_CACHE':
        await this.analyticsCache.invalidateFinance(payload.tenantId);
        break;
      case 'GENERATE_DOCUMENT':
        await this.documentsService.generateDocument(payload.tenantId, params?.templateCode || 'CONTRACT_TEMPLATE', payload, {
           title: payload.title || `Document for ${payload.code || 'Entity'}`,
           sourceType: payload.sourceType || (eventName ? eventName.split('.')[0].toUpperCase() : 'UNKNOWN'),
           sourceId: payload.id || payload.sourceId,
           createdBy: 'automation_engine'
        });
        break;
      case 'REQUEST_SIGNATURE':
        // Assuming payload has the documentId generated from a previous step or passed directly.
        // We might need to look up the latest document for this source
        if (payload.documentId) {
          await this.documentsService.requestSignature(payload.tenantId, payload.documentId, {
            title: `Signature required for ${payload.code || 'Document'}`,
            parties: params?.parties || [{
              name: payload.customerName || 'Customer',
              email: payload.customerEmail || 'customer@example.com',
              role: 'CUSTOMER'
            }]
          });
        }
        break;
      case 'WRITE_AUTOMATION_AUDIT':
        // Already recorded by workflow execution tables.
        this.logger.debug('Audit written');
        break;
      default:
        this.logger.warn(`Unknown step type: ${type}`);
    }
  }
}
