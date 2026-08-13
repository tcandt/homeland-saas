import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AutomationListener } from './automation.listener';
import { WorkflowEngine } from './workflow/workflow.engine';
import { RuleEngine } from './rules/rule.engine';
import { RuleScheduler } from './rules/rule.scheduler';
import { JobDispatcher } from './jobs/job.dispatcher';
import { AnalyticsCacheService } from '../analytics/analytics-cache.service';
import { EventsModule } from '../shared/events/events.module';
import { FinanceModule } from '../finance/finance.module';
import { CommunicationModule } from '../communication/communication.module';

import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [EventsModule, FinanceModule, CommunicationModule, DocumentsModule],
  controllers: [AutomationController],
  providers: [
    AutomationService,
    AutomationListener,
    WorkflowEngine,
    RuleEngine,
    RuleScheduler,
    JobDispatcher,
    AnalyticsCacheService
  ],
  exports: [AutomationService],
})
export class AutomationModule {}
