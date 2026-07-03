export interface DomainEventInterface {
  tenantId: string;
  userId: string;
  sourceId: string;
  sourceType: string;
  amount: number;
  occurredAt: Date;
  metadata?: Record<string, any>;
}
