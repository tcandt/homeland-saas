import { WorkflowDefinition } from '../automation.types';

export const WORKFLOW_REGISTRY: WorkflowDefinition[] = [
  {
    name: 'deposit.created.workflow',
    description: 'Process a newly created deposit',
    triggerEvent: 'deposit.created',
    steps: [
      {
        name: 'Notify Customer',
        type: 'CREATE_IN_APP_NOTIFICATION',
        order: 1,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 2,
      },
    ],
  },
  {
    name: 'deposit.collected.workflow',
    description: 'Process a collected deposit',
    triggerEvent: 'deposit.collected',
    steps: [
      {
        name: 'Notify Customer via Zalo',
        type: 'SEND_PAYMENT_CONFIRMATION_ZALO',
        order: 1,
        params: {
          templateCode: 'DEPOSIT_ZALO_PAYMENT_CONFIRMATION',
        },
      },
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 2,
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 3,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
      },
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 4,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
      },
      {
        name: 'Notify Customer',
        type: 'CREATE_IN_APP_NOTIFICATION',
        order: 5,
        params: {
          templateCode: 'DEPOSIT_COLLECTED'
        }
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 6,
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 7,
      },
      {
        name: 'Write Automation Audit',
        type: 'WRITE_AUTOMATION_AUDIT',
        order: 8,
      }
    ]
  },
  {
    name: 'invoice.issued.workflow',
    description: 'Process a newly issued invoice',
    triggerEvent: 'invoice.issued',
    steps: [
      {
        name: 'Notify Customer',
        type: 'CREATE_IN_APP_NOTIFICATION',
        order: 1,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 2,
      },
    ],
  },
  {
    name: 'invoice.paid.workflow',
    description: 'Process a paid invoice',
    triggerEvent: 'invoice.paid',
    steps: [
      {
        name: 'Notify Customer via Zalo',
        type: 'SEND_PAYMENT_CONFIRMATION_ZALO',
        order: 1,
        params: {
          templateCode: 'INVOICE_ZALO_PAYMENT_CONFIRMATION',
        },
      },
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 2,
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 3,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
      },
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 4,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 5,
      }
    ]
  },
  {
    name: 'invoice.payment.recorded.workflow',
    description: 'Process a partial invoice payment',
    triggerEvent: 'invoice.payment.recorded',
    steps: [
      {
        name: 'Notify Customer via Zalo',
        type: 'SEND_PAYMENT_CONFIRMATION_ZALO',
        order: 1,
        params: {
          templateCode: 'INVOICE_ZALO_PAYMENT_CONFIRMATION',
        },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 3,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
      },
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 2,
      },
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 4,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 5,
      },
    ],
  },
  {
    name: 'deposit.refund_requested.workflow',
    description: 'Process a pending deposit refund request',
    triggerEvent: 'deposit.refund_requested',
    steps: [
      {
        name: 'Notify Customer',
        type: 'CREATE_IN_APP_NOTIFICATION',
        order: 1,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
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
    name: 'contract.settlement.completed.workflow',
    description: 'Process a completed contract settlement',
    triggerEvent: 'contract.settlement.completed',
    steps: [
      {
        name: 'Notify Customer',
        type: 'CREATE_IN_APP_NOTIFICATION',
        order: 1,
        params: {
          templateCode: 'SYSTEM_ALERT'
        }
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
