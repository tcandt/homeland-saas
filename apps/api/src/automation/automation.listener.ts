import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AutomationService } from './automation.service';
import { DomainEventPayload } from './automation.constants';

@Injectable()
export class AutomationListener {
  private readonly logger = new Logger(AutomationListener.name);

  constructor(private readonly automationService: AutomationService) {}

  @OnEvent('deposit.collected')
  async handleDepositCollected(payload: DomainEventPayload) {
    await this.processEvent('deposit.collected', payload);
  }

  @OnEvent('invoice.paid')
  async handleInvoicePaid(payload: DomainEventPayload) {
    await this.processEvent('invoice.paid', payload);
  }

  @OnEvent('deposit.refunded')
  async handleDepositRefunded(payload: DomainEventPayload) {
    await this.processEvent('deposit.refunded', payload);
  }

  @OnEvent('deposit.deducted')
  async handleDepositDeducted(payload: DomainEventPayload) {
    await this.processEvent('deposit.deducted', payload);
  }

  @OnEvent('contract.created')
  async handleContractCreated(payload: DomainEventPayload) {
    await this.processEvent('contract.created', payload);
  }

  @OnEvent('contract.settlement.refunded')
  async handleContractSettlementRefunded(payload: DomainEventPayload) {
    await this.processEvent('contract.settlement.refunded', payload);
  }

  @OnEvent('contract.settlement.completed')
  async handleContractSettlementCompleted(payload: DomainEventPayload) {
    await this.processEvent('contract.settlement.completed', payload);
  }

  private async processEvent(eventName: string, payload: DomainEventPayload) {
    this.logger.debug(`Intercepted Domain Event: ${eventName}`);
    
    // In a real system, we look up which workflows are triggered by this eventName
    // For this sprint, we statically map them in workflow engine, but we trigger the check here.
    
    // We only process specific events to avoid infinite loops for now
    const supportedEvents = ['deposit.collected', 'deposit.refunded', 'deposit.deducted', 'invoice.paid', 'contract.created', 'contract.settlement.refunded', 'contract.settlement.completed'];
    if (supportedEvents.includes(eventName)) {
      // Find workflows that trigger on this event
      const workflows = await this.automationService.getWorkflows();
      const triggeredWorkflows = workflows.filter(w => w.triggerEvent === eventName);
      
      for (const w of triggeredWorkflows) {
        this.automationService.triggerWorkflow(w.name, eventName, payload).catch(e => {
          this.logger.error(`Workflow ${w.name} failed`, e.stack);
        });
      }
    }
  }
}
