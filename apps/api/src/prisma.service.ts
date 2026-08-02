import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

const TENANT_AWARE_MODELS = [
  'Building', 'Floor', 'Room', 'Customer', 'Contract', 
  'Deposit', 'Invoice', 'Payment', 'CreditNote', 'Task', 
  'SalesLead', 'NotificationJob', 'User', 'AuditLog',
  'AppSetting', 'PaymentRequest', 'PaymentWebhookLog'
];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly cls: ClsService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
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
            const a = args as any;
            if (TENANT_AWARE_MODELS.includes(model as string)) {
              if (['findMany', 'findFirst', 'findUnique', 'count', 'updateMany', 'deleteMany'].includes(operation)) {
                a.where = { ...a.where, tenantId };
              } else if (['create', 'createMany'].includes(operation)) {
                if (a.data) {
                  if (Array.isArray(a.data)) {
                    a.data = a.data.map((d: any) => ({ ...d, tenantId }));
                  } else {
                    a.data = { ...a.data, tenantId };
                  }
                }
              } else if (['update', 'delete'].includes(operation)) {
                // Ensure the updated/deleted record belongs to the tenant
                a.where = { ...a.where, tenantId };
              }
            }
            return query(args);
          },
        },
      },
    });
  }
}
