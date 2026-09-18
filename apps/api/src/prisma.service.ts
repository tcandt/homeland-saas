import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

export const TENANT_AWARE_MODELS = [
  'Building', 'Floor', 'Room', 'Customer', 'Contract', 
  'Deposit', 'Invoice', 'Payment', 'CreditNote', 'Task', 
  'SalesLead', 'NotificationJob', 'User', 'AuditLog',
  'AppSetting', 'PaymentRequest', 'PaymentWebhookLog',
  'Owner', 'BankAccount', 'CashAccount', 'ChartOfAccount',
  'CostCenter', 'Expense', 'Receipt', 'JournalEntry', 'JournalLine',
  'Reconciliation', 'ContractParty', 'Occupancy', 'ContractSettlement', 'RentalCycle',
  'RoomHold', 'DepositOperation', 'DepositLedgerEntry', 'OutboxEvent'
];

const TENANT_FILTER_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

export function applyTenantScope(model: string, operation: string, args: any, tenantId: string) {
  const scopedArgs = args || {};
  if (!TENANT_AWARE_MODELS.includes(model)) return scopedArgs;

  if (TENANT_FILTER_OPERATIONS.has(operation)) {
    scopedArgs.where = { ...scopedArgs.where, tenantId };
  } else if (['create', 'createMany'].includes(operation)) {
    if (scopedArgs.data) {
      if (Array.isArray(scopedArgs.data)) {
        scopedArgs.data = scopedArgs.data.map((data: any) => ({ ...data, tenantId }));
      } else {
        scopedArgs.data = { ...scopedArgs.data, tenantId };
      }
    }
  } else if (['update', 'delete'].includes(operation)) {
    scopedArgs.where = { ...scopedArgs.where, tenantId };
  } else if (operation === 'upsert') {
    scopedArgs.where = { ...scopedArgs.where, tenantId };
    scopedArgs.create = { ...scopedArgs.create, tenantId };
  }

  return scopedArgs;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly cls: ClsService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Use this getter in services instead of direct prisma access to enable Tenant Isolation
  get tx() {
    const tenantId = this.cls.get('tenantId');
    
    // If no tenant context (e.g., background job or public API), return normal client
    if (!tenantId) return this;

    // Return extended client with Tenant Isolation
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            return query(applyTenantScope(model as string, operation, args, tenantId));
          },
        },
      },
    });
  }
}
