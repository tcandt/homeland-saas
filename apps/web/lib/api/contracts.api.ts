import { apiClient } from './client';

export type ContractSettlementPayload = {
  actualMoveOutDate: string;
  roomTurnoverStatus?: "CLEANING" | "MAINTENANCE";
  rentDaysCharged?: number;
  baseRentAmount?: number;
  electricityAmount?: number;
  electricityClosingKwh?: number;
  waterAmount?: number;
  waterPreviousReading?: number;
  waterCurrentReading?: number;
  waterUsage?: number;
  waterUnitPrice?: number;
  serviceAmount?: number;
  damageFee?: number;
  penaltyFee?: number;
  otherChargeAmount?: number;
  roomRefundAmount?: number;
  waterSupportAmount?: number;
  otherCreditAmount?: number;
  depositToRefund?: number;
  depositToDeduct?: number;
  refundReceiptStatus?: "PENDING" | "COMPLETED";
  refundReason?: string | null;
  refundAttachmentUrls?: string[];
  note?: string | null;
};

export const contractsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; roomId?: string; customerId?: string }) => {
    return apiClient.get('/contracts', { params });
  },
  
  getDetail: (id: string) => {
    return apiClient.get(`/contracts/${id}`);
  },

  create: (data: any) => {
    return apiClient.post('/contracts', data);
  },

  update: (id: string, data: any) => {
    return apiClient.patch(`/contracts/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete(`/contracts/${id}`);
  },

  submit: (id: string) => {
    return apiClient.post(`/contracts/${id}/submit`);
  },

  approve: (id: string) => {
    return apiClient.post(`/contracts/${id}/approve`);
  },

  activate: (id: string) => {
    return apiClient.post(`/contracts/${id}/activate`);
  },

  previewSettlement: (id: string, payload: ContractSettlementPayload) => {
    return apiClient.post(`/contracts/${id}/settlement-preview`, payload);
  },

  terminate: (id: string, payload?: Partial<ContractSettlementPayload>) => {
    return apiClient.post(`/contracts/${id}/terminate`, payload);
  },

  completePendingSettlementRefund: (id: string, payload?: { note?: string }) => {
    return apiClient.post(`/contracts/${id}/settlement-refund/complete`, payload || {});
  },

  expire: (id: string) => {
    return apiClient.post(`/contracts/${id}/expire`);
  }
};
