import { DepositResponse } from '../api/deposits.api';

export interface UI_Deposit {
  id: string;
  code: string;
  type: string;
  status: string;
  amount: number;
  expiredAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Flattened for UI
  customerName: string;
  customerPhone: string;
  roomCode: string;
  buildingName: string;
  refundSummary?: DepositResponse["refundSummary"];
}

export const depositAdapter = {
  toUI(apiDeposit: DepositResponse): UI_Deposit {
    return {
      id: apiDeposit.id,
      code: apiDeposit.code || '-',
      type: apiDeposit.type || 'BOOKING',
      status: apiDeposit.status,
      amount: apiDeposit.amount,
      expiredAt: apiDeposit.expiredAt,
      note: apiDeposit.note,
      createdAt: apiDeposit.createdAt,
      updatedAt: apiDeposit.updatedAt,
      
      customerName: apiDeposit.customer?.fullName || 'N/A',
      customerPhone: apiDeposit.customer?.phone || 'N/A',
      roomCode: apiDeposit.room?.code || 'N/A',
      buildingName: apiDeposit.room?.building?.name || 'N/A',
      refundSummary: apiDeposit.refundSummary || null,
    };
  }
};
