import { RuleDefinition } from '../automation.types';

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
      return daysLeft >= 0 && daysLeft <= 3 && context.status !== 'PAID' && context.status !== 'CANCELLED' && context.status !== 'WRITTEN_OFF';
    },
    action: async (_context: any) => {
      // Logic handled dynamically inside the engine
    }
  },
  {
    name: 'invoice.overdue.7_days',
    description: 'Trigger when an invoice is overdue by > 7 days',
    condition: async (context: any) => {
      if (!context.dueDate) return false;
      const overdueDays = Math.floor((new Date().getTime() - new Date(context.dueDate).getTime()) / (1000 * 3600 * 24));
      return overdueDays > 7 && context.status !== 'PAID';
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
      return daysLeft >= 0 && daysLeft <= 30;
    },
    action: async (_context: any) => {
      // Handled in engine
    }
  }
];
