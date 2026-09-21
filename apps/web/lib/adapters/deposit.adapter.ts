import { DepositResponse } from '../api/deposits.api';

export interface UI_Deposit {
  id: string;
  code: string;
  type: string;
  status: string;
  amount: number;
  availableBalance?: number;
  pendingOperationId?: string | null;
  expiredAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Flattened for UI
  customerId?: string;
  customerName: string;
  customerPhone: string;
  roomId?: string;
  roomCode: string;
  buildingId?: string;
  buildingName: string;
  contractId?: string | null;
  contractCode?: string | null;
  refundSummary?: DepositResponse["refundSummary"];
  paymentRequest?: {
    id: string;
    status: string;
    paymentCode?: string | null;
    provider?: string | null;
    paidAt?: string | null;
    createdAt?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
}

export const depositAdapter = {
  toUI(apiDeposit: any): UI_Deposit {
    const rawAvailableBalance = apiDeposit.availableBalance;
    const availableBalance = rawAvailableBalance === null || rawAvailableBalance === undefined
      ? undefined
      : Number(rawAvailableBalance);

    return {
      id: apiDeposit.id,
      code: apiDeposit.code || '-',
      type: apiDeposit.type || 'BOOKING',
      status: apiDeposit.status,
      amount: Number(apiDeposit.amount) || 0,
      availableBalance: Number.isFinite(availableBalance) ? availableBalance : undefined,
      pendingOperationId: apiDeposit.pendingOperationId ?? apiDeposit.refundSummary?.operationId ?? null,
      expiredAt: apiDeposit.expiredAt,
      note: apiDeposit.note,
      createdAt: apiDeposit.createdAt,
      updatedAt: apiDeposit.updatedAt,
      
      customerId: apiDeposit.customerId || apiDeposit.customer?.id,
      customerName: apiDeposit.customerName || apiDeposit.customer?.fullName || 'Khách vãng lai',
      customerPhone: apiDeposit.customerPhone || apiDeposit.customer?.phone || '-',
      roomId: apiDeposit.roomId || apiDeposit.room?.id,
      roomCode: apiDeposit.roomCode || apiDeposit.room?.code || apiDeposit.room?.name || 'Chưa gắn phòng',
      buildingId: apiDeposit.buildingId || apiDeposit.room?.buildingId || apiDeposit.room?.building?.id,
      buildingName: apiDeposit.buildingName || apiDeposit.room?.building?.name || '-',
      contractId: apiDeposit.contractId || apiDeposit.contract?.id || null,
      contractCode: apiDeposit.contract?.code || null,
      refundSummary: apiDeposit.refundSummary || null,
      paymentRequest: apiDeposit.paymentRequest || null,
    };
  }
};
