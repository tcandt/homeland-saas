export enum WorkflowStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  CANCELLED = 'CANCELLED',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  CONSOLE = 'CONSOLE',
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
  ZALO = 'ZALO',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

export interface DomainEventPayload {
  tenantId: string;
  id?: string;
  userId?: string;
  [key: string]: any;
}
