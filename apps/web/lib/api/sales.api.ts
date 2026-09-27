import { apiClient } from './client';

export const SALES_LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;
export type SalesLeadStatus = typeof SALES_LEAD_STATUSES[number];

export const SALES_STAGE_TRANSITIONS: Record<SalesLeadStatus, readonly SalesLeadStatus[]> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['WON', 'LOST'],
  WON: [],
  LOST: [],
};

export type SalesSummaryLead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: SalesLeadStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SalesSummary = {
  total: number;
  activeCount: number;
  staleCount: number;
  stageCounts: Record<string, number>;
  newestLeads: SalesSummaryLead[];
};

export const salesApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; sort?: string; order?: string }) => {
    return apiClient.get('/sales', { params });
  },

  getSummary: () => {
    return apiClient.get<SalesSummary>('/sales/summary');
  },

  getDetail: (id: string) => {
    return apiClient.get(`/sales/${id}`);
  },

  updateStage: (id: string, status: SalesLeadStatus, idempotencyKey: string) => {
    return apiClient.patch<SalesSummaryLead>(`/sales/${id}/stage`, { status }, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },
};
