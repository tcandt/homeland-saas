import { apiClient } from './client';

export interface RoomMember {
  id: string;
  fullName: string;
  phone: string;
  identityNo?: string;
  gender?: string;
  zaloPhone?: string;
  zaloChatId?: string | null;
  zaloUserId?: string | null;
  hasZalo?: boolean;
  role: string;
  isRepresentative: boolean;
  relationship: string;
  createdAt?: string;
}

export interface MeterReadingInfo {
  oldReading: number;
  newReading: number;
  powerW: number;
  isOnline: boolean;
  lastSyncedAt?: string | null;
  rateMode: 'residential' | 'custom' | string;
  customRateVnd?: number | null;
  rateModeLabel?: string;
}

export interface RoomSettlementItem {
  billingGroupKey?: string;
  billingScope?: 'ROOM' | 'CONTRACT';
  utilityShareRatio?: number;
  sharedTotalMembers?: number;
  roomElectricityKwh?: number;
  roomElectricityAmount?: number;
  roomServiceAmount?: number;
  roomId: string;
  roomCode: string;
  roomName: string;
  buildingId: string;
  buildingCode: string;
  buildingName: string;
  floorName: string;
  floorLevel: number;
  roomRentalType: string;
  roomCapacity: number;
  contractId: string | null;
  contractCode: string | null;
  contractStatus: string | null;
  contractStartDate?: string | null;
  contractSignedAt?: string | null;
  hasContract: boolean;
  isFirstMonthNewTenant?: boolean;
  electricityEligible?: boolean;
  waterEligible?: boolean;
  serviceEligible?: boolean;
  representative: {
    id: string;
    fullName: string;
    phone: string;
    email?: string;
    identityNo?: string;
    zaloPhone?: string;
    zaloChatId?: string;
    zaloUserId?: string;
    hasZalo?: boolean;
  } | null;
  membersCount: number;
  members: RoomMember[];
  period: string;
  usagePeriod?: string;
  invoiceId: string | null;
  invoiceCode: string;
  roomPrice: number;
  electricityKwh: number;
  electricityAmount: number;
  meterReading: MeterReadingInfo | null;
  waterAmount: number;
  serviceAmount: number;
  totalAmount: number;
  notificationStatus: 'SENT_ZALO' | 'PENDING' | 'FAILED' | 'SENDING';
  notificationSentAt: string | null;
  notificationError: string | null;
  paymentStatus: string;
  paidAmount: number;
}

export interface SettlementOverviewResponse {
  period: string;
  usagePeriod?: string;
  buildings: Array<{ id: string; name: string; code: string }>;
  settings: {
    autoCloseEnabled: boolean;
    closingDay: 'LAST_DAY' | number;
    autoSendNotification: boolean;
    notificationHour: number;
    notificationMinute: number;
    notificationDay: number;
    notificationChannel: string;
  };
  stats: {
    totalRooms: number;
    occupiedRooms: number;
    totalAmount: number;
    sentZaloCount: number;
    pendingCount: number;
    failedCount: number;
    paidCount: number;
    totalPaidAmount: number;
    collectionRate: number;
  };
  items: RoomSettlementItem[];
}

export const monthlySettlementApi = {
  getOverview: (params?: {
    period?: string;
    buildingId?: string;
    search?: string;
    notificationStatus?: string;
    paymentStatus?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.buildingId) query.append('buildingId', params.buildingId);
    if (params?.search) query.append('search', params.search);
    if (params?.notificationStatus) query.append('notificationStatus', params.notificationStatus);
    if (params?.paymentStatus) query.append('paymentStatus', params.paymentStatus);
    return apiClient.get<SettlementOverviewResponse>(`/monthly-settlement/overview?${query.toString()}`);
  },

  closeMonth: (payload: { period?: string; roomIds?: string[]; autoSend?: boolean }) => {
    return apiClient.post<{
      success: boolean;
      period: string;
      settledCount: number;
      sentCount: number;
      invoices: any[];
    }>('/monthly-settlement/close-month', payload);
  },

  sendNotifications: (payload: { period?: string; roomIds?: string[]; invoiceIds?: string[] }) => {
    return apiClient.post<{
      period: string;
      totalRequested: number;
      sentCount: number;
      failedCount: number;
      results: Array<{ roomId: string; roomCode: string; status: string; message: string }>;
    }>('/monthly-settlement/send-notifications', payload);
  },

  resendSingle: (roomId: string, period?: string) => {
    return apiClient.post<{ success: boolean; message: string }>(`/monthly-settlement/resend/${roomId}`, { period });
  },

  getSettings: () => {
    return apiClient.get<any>('/monthly-settlement/settings');
  },

  saveSettings: (settings: any) => {
    return apiClient.post<any>('/monthly-settlement/settings', settings);
  },
};
