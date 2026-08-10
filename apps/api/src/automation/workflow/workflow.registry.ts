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
        name: 'Notify Customer via Zalo',
        type: 'SEND_PAYMENT_CONFIRMATION_ZALO',
        order: 2,
        params: {
          templateCode: 'DEPOSIT_ZALO_PAYMENT_CONFIRMATION',
        },
      },
      {
        name: 'Notify Customer',
        type: 'CREATE_IN_APP_NOTIFICATION',
        order: 3,
        params: {
          templateCode: 'DEPOSIT_COLLECTED'
        }
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 4,
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 5,
      },
      {
        name: 'Write Automation Audit',
        type: 'WRITE_AUTOMATION_AUDIT',
        order: 6,
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
        name: 'Notify Customer via Zalo',
        type: 'SEND_PAYMENT_CONFIRMATION_ZALO',
        order: 2,
        params: {
          templateCode: 'INVOICE_ZALO_PAYMENT_CONFIRMATION',
        },
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 3,
      }
    ]
  },
  {
    name: 'deposit.refunded.workflow',
    description: 'Process a refunded deposit',
    triggerEvent: 'deposit.refunded',
    steps: [
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 1,
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 2,
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 3,
      },
    ],
  },
  {
    name: 'deposit.deducted.workflow',
    description: 'Process a deducted deposit',
    triggerEvent: 'deposit.deducted',
    steps: [
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 1,
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 2,
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 3,
      },
    ],
  },
  {
    name: 'contract.settlement.refunded.workflow',
    description: 'Process a refunded contract settlement',
    triggerEvent: 'contract.settlement.refunded',
    steps: [
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 1,
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 2,
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 3,
      },
    ],
  }
];
