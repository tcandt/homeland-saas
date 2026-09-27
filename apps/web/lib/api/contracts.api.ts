import { apiClient } from "./client";

function requireIdempotencyKey(idempotencyKey: string) {
  const normalized = String(idempotencyKey || "").trim();
  if (normalized.length < 8 || normalized.length > 128) {
    throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  }
  return normalized;
}

export type ContractSettlementPayload = {
  actualMoveOutDate: string;
  roomTurnoverStatus?: "AVAILABLE" | "CLEANING" | "MAINTENANCE";
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

export type MoveOutOccupantPayload = Partial<ContractSettlementPayload> & {
  roomId: string;
  customerId: string;
  contractId?: string | null;
  reason?: string | null;
};

export type AddWholeRoomOccupantPayload = {
  customerId: string;
  moveInAt: string;
  relationship?: string | null;
};

export type RenewContractPayload = {
  startDate: string;
  endDate: string;
  rentAmount?: number;
  depositAmount?: number;
  memberCount?: number;
  firstPaymentDate?: string | null;
  purpose?: string | null;
  coRepresentativeIds?: string[];
};

export type MoveOutOccupantResult = {
  mode:
    | "CONTRACT_SETTLED"
    | "CONTRACT_CANCELLED"
    | "CO_REPRESENTATIVE_DETACHED"
    | "TERMINAL_CONTRACT_OCCUPANT_DETACHED"
    | "ROOMMATE_DETACHED";
  contractId: string | null;
  contractStatus: string | null;
  roomStatus: "AVAILABLE" | "CLEANING" | "MAINTENANCE" | "OCCUPIED";
  removedCustomerIds: string[];
};

export const contractsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    roomId?: string;
    customerId?: string;
  }) => {
    return apiClient.get("/contracts", { params });
  },

  getDetail: (id: string) => {
    return apiClient.get(`/contracts/${id}`);
  },

  create: (data: any) => {
    return apiClient.post("/contracts", data);
  },

  convertBookingHold: (id: string, data: any, idempotencyKey: string) => {
    const commandKey = requireIdempotencyKey(idempotencyKey);
    return apiClient.post(
      `/contracts/${id}/convert-booking-hold`,
      { ...data, idempotencyKey: commandKey },
      {
        headers: { "Idempotency-Key": commandKey },
      },
    );
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

  activate: (id: string, idempotencyKey: string) => {
    const commandKey = requireIdempotencyKey(idempotencyKey);
    return apiClient.post(
      `/contracts/${id}/activate`,
      {},
      {
        headers: { "Idempotency-Key": commandKey },
      },
    );
  },

  renew: (
    id: string,
    payload: RenewContractPayload,
    idempotencyKey: string,
  ) => {
    const commandKey = requireIdempotencyKey(idempotencyKey);
    return apiClient.post(
      `/contracts/${id}/renew`,
      { ...payload, idempotencyKey: commandKey },
      { headers: { "Idempotency-Key": commandKey } },
    );
  },

  previewSettlement: (id: string, payload: ContractSettlementPayload) => {
    return apiClient.post(`/contracts/${id}/settlement-preview`, payload);
  },

  terminate: (
    id: string,
    payload?: Partial<ContractSettlementPayload>,
    idempotencyKey?: string,
  ) => {
    const commandKey = idempotencyKey
      ? requireIdempotencyKey(idempotencyKey)
      : undefined;
    return apiClient.post(
      `/contracts/${id}/terminate`,
      commandKey ? { ...payload, idempotencyKey: commandKey } : payload,
      commandKey ? { headers: { "Idempotency-Key": commandKey } } : undefined,
    );
  },

  moveOutOccupant: (
    payload: MoveOutOccupantPayload,
    idempotencyKey: string,
  ) => {
    const commandKey = requireIdempotencyKey(idempotencyKey);
    return apiClient.post<MoveOutOccupantResult>(
      "/contracts/occupant-move-out",
      payload,
      { headers: { "Idempotency-Key": commandKey } },
    );
  },

  addWholeRoomOccupant: (
    contractId: string,
    payload: AddWholeRoomOccupantPayload,
    idempotencyKey: string,
  ) => {
    const commandKey = requireIdempotencyKey(idempotencyKey);
    return apiClient.post(
      `/contracts/${contractId}/whole-room-occupants`,
      payload,
      { headers: { "Idempotency-Key": commandKey } },
    );
  },

  completePendingSettlementRefund: (
    id: string,
    payload?: { note?: string; attachmentUrls?: string[] },
    idempotencyKey?: string,
  ) => {
    const commandKey = idempotencyKey
      ? requireIdempotencyKey(idempotencyKey)
      : undefined;
    return apiClient.post(
      `/contracts/${id}/settlement-refund/complete`,
      commandKey ? { ...payload, idempotencyKey: commandKey } : payload || {},
      commandKey ? { headers: { "Idempotency-Key": commandKey } } : undefined,
    );
  },

  expire: (id: string) => {
    return apiClient.post(`/contracts/${id}/expire`);
  },
};
