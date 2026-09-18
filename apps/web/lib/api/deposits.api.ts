import { apiClient } from './client';
import type { RentalCycleFinanceSummary, RoomFinanceSummary } from '../types/finance-summary';

export type { RentalCycleFinanceSummary, RoomFinanceSummary } from '../types/finance-summary';

export interface DepositResponse {
  id: string;
  code: string;
  type: string;
  status: string;
  amount: number;
  availableBalance?: number;
  pendingOperationId?: string | null;
  expiredAt: string | null;
  note: string | null;
  rentalCycleId?: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    fullName: string;
    phone: string;
  };
  room: {
    id: string;
    code: string;
    name: string;
    building: {
      id: string;
      name: string;
    };
  };
  refundSummary?: {
    operationId: string | null;
    receiptId: string | null;
    receiptCode: string | null;
    receiptStatus: string | null;
    receiptAmount: number;
    receiptDescription: string | null;
    taskId: string | null;
    taskTitle: string | null;
    taskStatus: string | null;
    pending: boolean;
    completed: boolean;
  } | null;
}

export interface DepositListResponse {
  items: DepositResponse[];
  total: number;
}

export interface ConvertDepositPayload {
  securityRequired: number;
  contractId?: string;
  securityDepositId?: string;
  excessAction?: 'CREDIT' | 'REFUND';
  refundStatus?: 'PENDING' | 'COMPLETED';
}

export interface CoreCancelDepositPayload {
  reason: string;
  refundAmount?: number;
  keepAmount?: number;
  deductAmount?: number;
  refundStatus?: 'PENDING' | 'COMPLETED';
}

function requireIdempotencyKey(idempotencyKey: string): string {
  const normalized = String(idempotencyKey || '').trim();
  if (normalized.length < 8 || normalized.length > 128) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }
  return normalized;
}

export const depositsApi = {
  getStats: (buildingId?: string) => {
    return apiClient.get<any>('/deposits/stats', { params: buildingId && buildingId !== 'ALL' ? { buildingId } : undefined });
  },

  list: (params?: any) => {
    return apiClient.get<any>('/deposits', { params });
  },

  getDetail: (id: string) => {
    return apiClient.get<any>(`/deposits/${id}`);
  },

  getRentalCycleFinanceSummary: (rentalCycleId: string) => {
    return apiClient.get<RentalCycleFinanceSummary>(`/deposits/rental-cycles/${rentalCycleId}/finance-summary`);
  },

  getRoomFinanceSummary: (roomId: string) => {
    return apiClient.get<RoomFinanceSummary>(`/deposits/rooms/${roomId}/finance-summary`);
  },

  getOperationStatus: (idempotencyKey: string) => {
    return apiClient.get<any>('/deposits/operations/status', { params: { idempotencyKey } });
  },

  create: (data: any, idempotencyKey?: string) => {
    return apiClient.post<any>('/deposits', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  },

  update: (id: string, data: any) => {
    return apiClient.patch<any>(`/deposits/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete<{ success: boolean }>(`/deposits/${id}`);
  },

  collect: (id: string, payload: { note?: string; holdExpiresAt?: string } | undefined, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<any>(`/deposits/${id}/collect`, { ...(payload || {}), idempotencyKey: key }, {
      headers: { 'Idempotency-Key': key },
    });
  },

  refund: (id: string, payload: { reason: string; receiptStatus?: "PENDING" | "COMPLETED"; attachmentUrls?: string[]; refundAmount?: number }, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<any>(`/deposits/${id}/refund`, { ...payload, idempotencyKey: key }, {
      headers: { 'Idempotency-Key': key },
    });
  },

  completePendingRefund: (operationId: string, note: string | undefined, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    const payload: Record<string, any> = {};
    if (note !== undefined) payload.note = note;
    payload.idempotencyKey = key;
    return apiClient.post<any>(`/deposits/operations/${operationId}/refund/complete`, payload, {
      headers: { 'Idempotency-Key': key },
    });
  },

  cancel: (id: string, payload: CoreCancelDepositPayload, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<any>(`/deposits/${id}/commands/cancel`, { ...payload, idempotencyKey: key }, {
      headers: { 'Idempotency-Key': key },
    });
  },

  cancelUnpaid: (id: string, payload: { reason: string }, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<any>(`/deposits/${id}/cancel`, { ...payload, idempotencyKey: key }, {
      headers: { 'Idempotency-Key': key },
    });
  },

  convertToContract: (bookingDepositId: string, payload: ConvertDepositPayload, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<any>(`/deposits/${bookingDepositId}/convert-contract`, { ...payload, idempotencyKey: key }, {
      headers: { 'Idempotency-Key': key },
    });
  },

  renewHold: (depositId: string, payload: { expiresAt: string }, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<any>(`/deposits/${depositId}/hold/renew`, { ...payload, idempotencyKey: key }, {
      headers: { 'Idempotency-Key': key },
    });
  },

  transferHold: (depositId: string, payload: { targetRoomId: string; expiresAt?: string }, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<any>(`/deposits/${depositId}/hold/transfer`, { ...payload, idempotencyKey: key }, {
      headers: { 'Idempotency-Key': key },
    });
  },

  releaseHold: (depositId: string, payload: { reason: string }, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<any>(`/deposits/${depositId}/hold/release`, { ...payload, idempotencyKey: key }, {
      headers: { 'Idempotency-Key': key },
    });
  },

  expireHolds: (payload?: { asOf?: string }) => {
    return apiClient.post<any>('/deposits/holds/expire', payload || {});
  },

  reverseLedgerEntry: (entryId: string, payload: { reason: string }, idempotencyKey: string) => {
    const key = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<any>(`/deposits/ledger/${entryId}/reverse`, { ...payload, idempotencyKey: key }, {
      headers: { 'Idempotency-Key': key },
    });
  },

  cleanupOrphans: () => {
    return apiClient.post<{ success: boolean; deletedCount: number; message: string }>('/deposits/cleanup-orphans');
  },
};
