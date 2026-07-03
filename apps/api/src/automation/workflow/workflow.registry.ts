import { WorkflowDefinition } from '../automation.types';

export const WORKFLOW_REGISTRY: WorkflowDefinition[] = [
  {
    name: 'deposit.collected.workflow',
    description: 'Process a collected deposit',
    triggerEvent: 'deposit.collected',
    steps: [
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 1,
      },
      {
        name: 'Notify Customer',
        type: 'CREATE_IN_APP_NOTIFICATION',
        order: 2,
        params: {
          templateCode: 'DEPOSIT_COLLECTED'
        }
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 3,
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 4,
      },
      {
        name: 'Write Automation Audit',
        type: 'WRITE_AUTOMATION_AUDIT',
        order: 5,
      }
    ]
  },
  {
    name: 'invoice.paid.workflow',
    description: 'Process a paid invoice',
    triggerEvent: 'invoice.paid',
    steps: [
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 1,
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 2,
      }
    ]
  }
];
