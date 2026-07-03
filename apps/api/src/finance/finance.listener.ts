import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEventInterface } from '../shared/events/domain-event.interface';
import { JournalEntryService } from './journal-entry.service';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FinanceListener {
  private readonly logger = new Logger(FinanceListener.name);

  constructor(
    private readonly journalEntryService: JournalEntryService,
    private readonly prisma: PrismaService,
  ) {}

  // Removed: @OnEvent('deposit.collected')
  // Automation module's Workflow Engine is now responsible for handling deposit.collected
  // and triggering CREATE_JOURNAL_ENTRY step.

  // Similar listeners can be added for invoice.paid, expense.created, payment.received...
}
