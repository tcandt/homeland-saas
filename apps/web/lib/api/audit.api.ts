import { apiClient } from "./client";

export type AuditLogItem = {
  id: string;
  createdAt: string;
  module: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  user: { id: string; email: string; fullName: string } | null;
  ip: string | null;
  userAgent: string | null;
  before: unknown;
  after: unknown;
};

export const auditApi = {
  logs: (params?: { limit?: number; module?: string; action?: string; userEmail?: string }) => {
    return apiClient.get<AuditLogItem[]>("/audit/logs", { params });
  },
};
