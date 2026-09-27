import { RuleDefinition } from '../automation.types';
import { DEFAULT_REMINDER_DAYS } from './reminder-policy';

function threshold(context: any, key: keyof typeof DEFAULT_REMINDER_DAYS) {
  const value = Number(context?.thresholdDays ?? context?.reminderDays?.[key]);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : DEFAULT_REMINDER_DAYS[key];
}

function isSettled(context: any) {
  return ['PAID', 'CANCELLED', 'WRITTEN_OFF'].includes(String(context?.status || '').toUpperCase())
    || Number(context?.remainingAmount ?? 1) <= 0;
}

export const RULE_REGISTRY: RuleDefinition[] = [
  {
    name: 'invoice.due_soon.3_days',
    description: 'Trigger when an invoice will be due within the next 3 days',
    condition: async (context: any) => {
      if (!context.dueDate) return false;
      const now = new Date();
      const dueDate = new Date(context.dueDate);
      const msPerDay = 1000 * 3600 * 24;
      const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay);
      return daysLeft >= 0 && daysLeft <= threshold(context, 'invoiceDueSoonDays') && !isSettled(context);
    },
    action: async (_context: any) => {
      // Logic handled dynamically inside the engine
    }
  },
  {
    name: 'invoice.overdue.7_days',
    description: 'Trigger when an invoice is overdue by the configured threshold (default 3 days)',
    condition: async (context: any) => {
      if (!context.dueDate) return false;
      const overdueDays = Math.floor((new Date().getTime() - new Date(context.dueDate).getTime()) / (1000 * 3600 * 24));
      return overdueDays >= threshold(context, 'invoiceOverdueDays') && !isSettled(context);
    },
    action: async (context: any) => {
      // Logic handled dynamically inside the engine
    }
  },
  {
    name: 'contract.expiring.30_days',
    description: 'Trigger when a contract expires within 30 days',
    condition: async (context: any) => {
      if (!context.endDate) return false;
      const daysLeft = Math.ceil((new Date(context.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      return daysLeft >= 0 && daysLeft <= threshold(context, 'contractExpiringDays') && !['TERMINATED', 'CANCELLED', 'EXPIRED'].includes(String(context.status || '').toUpperCase()) && context.renewalStatus !== 'RENEWED';
    },
    action: async (_context: any) => {
      // Handled in engine
    }
  },
  {
    name: 'invoice.payment_promise_due',
    description: 'Trigger once when a recorded payment promise reaches its due date',
    condition: async (context: any) => {
      if (!context.promiseDueDate) return false;
      return !isSettled(context) && String(context.promiseStatus || '').toUpperCase() === 'OVERDUE';
    },
    action: async (_context: any) => {
      // Delivery is handled by RuleEngine with the canonical invoice balance.
    }
  }
];
