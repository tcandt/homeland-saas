export interface DomainEventInterface {
  tenantId: string;
  userId: string;
  sourceId: string;
  sourceType: string;
  amount: number;
  occurredAt: Date;
  metadata?: Record<string, any>;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerZaloChatId?: string | null;
  customerZaloUserId?: string | null;
  paymentProvider?: string;
  paymentRef?: string;
}
