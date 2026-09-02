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
}

export const depositAdapter = {
  toUI(apiDeposit: any): UI_Deposit {
    return {
      id: apiDeposit.id,
      code: apiDeposit.code || '-',
      type: apiDeposit.type || 'BOOKING',
      status: apiDeposit.status,
      amount: Number(apiDeposit.amount) || 0,
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
    };
  }
};
