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
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 2,
        params: {
          templateCode: 'ADMIN_DEPOSIT_CREATED',
          alertKind: 'DEPOSIT_CREATED',
        },
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 3,
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
        params: { continueOnError: true },
      },
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 3,
        params: {
          templateCode: 'PAYMENT_RECEIVED',
        },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 4,
        params: {
          templateCode: 'ADMIN_DEPOSIT_COLLECTED',
          continueOnError: true,
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
        order: 3,
      },
    ],
  },
  {
    name: 'invoice.overdue.workflow',
    description: 'Notify admins when an invoice becomes overdue',
    triggerEvent: 'invoice.overdue',
    steps: [
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 1,
        params: {
          templateCode: 'ADMIN_INVOICE_OVERDUE',
          alertKind: 'INVOICE_OVERDUE',
        },
      },
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 2,
        params: {
          templateCode: 'SYSTEM_ALERT',
        },
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 3,
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
        params: { continueOnError: true },
      },
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 3,
        params: {
          templateCode: 'PAYMENT_RECEIVED',
        },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 4,
        params: {
          templateCode: 'ADMIN_INVOICE_PAID',
          continueOnError: true,
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
          templateCode: 'INVOICE_ZALO_PARTIAL_PAYMENT_CONFIRMATION',
        },
      },
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 3,
        params: {
          templateCode: 'PAYMENT_RECEIVED',
        },
      },
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 2,
        params: { continueOnError: true },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 4,
        params: {
          templateCode: 'ADMIN_INVOICE_PARTIAL',
          continueOnError: true,
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
        name: 'Notify Customer via Zalo',
        type: 'SEND_CUSTOMER_ZALO',
        order: 2,
        params: { templateCode: 'CLIENT_DEPOSIT_REFUND_PENDING' },
      },
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 3,
        params: {
          templateCode: 'PAYMENT_RECEIVED',
        },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 4,
        params: {
          templateCode: 'ADMIN_DEPOSIT_REFUND_PENDING',
          alertKind: 'DEPOSIT_REFUND_REQUESTED',
          continueOnError: true,
        },
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 5,
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 6,
      },
    ],
  },
  {
    name: 'deposit.refunded.workflow',
    description: 'Process a refunded deposit',
    triggerEvent: 'deposit.refunded',
    steps: [
      {
        name: 'Notify Customer',
        type: 'CREATE_IN_APP_NOTIFICATION',
        order: 1,
        params: { templateCode: 'SYSTEM_ALERT' },
      },
      {
        name: 'Notify Customer via Zalo',
        type: 'SEND_CUSTOMER_ZALO',
        order: 2,
        params: { templateCode: 'CLIENT_DEPOSIT_REFUNDED' },
      },
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 3,
        params: { templateCode: 'PAYMENT_RECEIVED' },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 4,
        params: {
          templateCode: 'ADMIN_DEPOSIT_REFUNDED',
          alertKind: 'DEPOSIT_REFUNDED',
          continueOnError: true,
        },
      },
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 5,
        params: { continueOnError: true },
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
    ],
  },
  {
    name: 'deposit.deducted.workflow',
    description: 'Process a deducted deposit',
    triggerEvent: 'deposit.deducted',
    steps: [
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 1,
        params: { templateCode: 'PAYMENT_RECEIVED' },
      },
      {
        name: 'Notify Customer via Zalo',
        type: 'SEND_CUSTOMER_ZALO',
        order: 2,
        params: { templateCode: 'CLIENT_DEPOSIT_DEDUCTED' },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 3,
        params: {
          templateCode: 'ADMIN_DEPOSIT_DEDUCTED',
          alertKind: 'DEPOSIT_DEDUCTED',
          continueOnError: true,
        },
      },
      {
        name: 'Create Journal Entry',
        type: 'CREATE_JOURNAL_ENTRY',
        order: 4,
        params: { continueOnError: true },
      },
      {
        name: 'Invalidate Dashboard Cache',
        type: 'INVALIDATE_DASHBOARD_CACHE',
        order: 5,
      },
      {
        name: 'Invalidate Finance Cache',
        type: 'INVALIDATE_FINANCE_CACHE',
        order: 6,
      },
    ],
  },
  {
    name: 'deposit.cancelled.workflow',
    description: 'Process a cancelled deposit without refund',
    triggerEvent: 'deposit.cancelled',
    steps: [
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 1,
        params: { templateCode: 'PAYMENT_RECEIVED' },
      },
      {
        name: 'Notify Customer via Zalo',
        type: 'SEND_CUSTOMER_ZALO',
        order: 2,
        params: { templateCode: 'CLIENT_DEPOSIT_CANCELLED' },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 3,
        params: {
          templateCode: 'ADMIN_DEPOSIT_CANCELLED',
          alertKind: 'DEPOSIT_CANCELLED',
          continueOnError: true,
        },
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
    ],
  },
  {
    name: 'deposit.hold.expired.workflow',
    description: 'Notify customer and admin when a room hold expires',
    triggerEvent: 'deposit.hold.expired',
    steps: [
      {
        name: 'Notify Customer via Zalo',
        type: 'SEND_CUSTOMER_ZALO',
        order: 1,
        params: {
          templateCode: 'SYSTEM_ALERT',
          title: 'HomeLand - Giữ phòng hết hạn',
          message: 'Giữ phòng của quý khách đã hết hạn. Vui lòng liên hệ ban quản lý nếu cần hỗ trợ.',
        },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 2,
        params: { templateCode: 'ADMIN_DEPOSIT_CANCELLED', alertKind: 'ROOM_HOLD_EXPIRED', continueOnError: true },
      },
    ],
  },
  {
    name: 'deposit.converted_to_security.workflow',
    description: 'Process booking deposit conversion to contract security deposit',
    triggerEvent: 'deposit.converted_to_security',
    steps: [
      {
        name: 'Notify Admin In-App',
        type: 'CREATE_ADMIN_IN_APP_NOTIFICATION',
        order: 1,
        params: { templateCode: 'PAYMENT_RECEIVED' },
      },
      {
        name: 'Notify Customer via Zalo',
        type: 'SEND_CUSTOMER_ZALO',
        order: 2,
        params: { templateCode: 'CLIENT_DEPOSIT_CONVERTED' },
      },
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 3,
        params: {
          templateCode: 'ADMIN_DEPOSIT_CONVERTED',
          alertKind: 'DEPOSIT_CONVERTED',
          continueOnError: true,
        },
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
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 2,
        params: {
          templateCode: 'ADMIN_CONTRACT_SETTLEMENT_COMPLETED',
          alertKind: 'CONTRACT_SETTLEMENT_COMPLETED',
        },
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
    ],
  },
  {
    name: 'contract.created.workflow',
    description: 'Notify admins when a contract is created',
    triggerEvent: 'contract.created',
    steps: [
      {
        name: 'Notify Admin Group via Zalo',
        type: 'SEND_ADMIN_GROUP_ZALO',
        order: 1,
        params: {
          templateCode: 'ADMIN_CONTRACT_CREATED',
          alertKind: 'CONTRACT_CREATED',
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
