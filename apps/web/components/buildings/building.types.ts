export type RoomStatus = "vacant" | "occupied" | "expiring_soon" | "deposited" | "maintenance";
export type RoomType = "1PN" | "2PN" | "Studio" | "Office" | "Dorm";

export interface Tenant {
  id: string;
  name: string;
  fullName?: string;
  phone: string;
  email: string;
  cccd: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  address?: string;
  emergencyPhone?: string;
  idImages: string[];
  tempResidence: boolean;
}

export interface Invoice {
  id: string;
  code: string;
  amount: number;
  dueDate: string;
  status: "paid" | "unpaid" | "partial";
  type: "rent" | "service" | "deposit";
}

export interface PaymentHistoryItem {
  id: string;
  month: string;
  amount: number;
  date: string;
  method: string;
  status: "paid" | "partial";
}

export interface Contract {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  deposit: number;
  rentPrice: number;
  contractPdfUrl?: string;
  firstPaymentDate?: string;
  signedAt?: string;
  purpose?: string;
  status?: string;
}

export interface SharedTenant extends Tenant {
  bedPosition: string;
  deposit: number;
  rentPrice: number;
  startDate: string;
  endDate: string;
  remainingDays: number;
  contractPdfUrl?: string;
  invoices: Invoice[];
  paymentHistory: PaymentHistoryItem[];
  debt: number;
  paymentStatus: "paid" | "unpaid" | "partial";
  contractId?: string;
  contractCode?: string;
  firstPaymentDate?: string;
  signedAt?: string;
  purpose?: string;
  isRep?: boolean;
  relationship?: string;
}

export interface RoomAttachment {
  id: string;
  name: string;
  url: string;
  size: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  number: string;
  type: RoomType;
  rentalType: "whole" | "shared";
  price: number;
  status: RoomStatus;
  monthlyPrice: number;
  area?: number;
  capacity?: number;
  bedCount?: number;
  images: string[];
  tenant?: Tenant | null;
  roommates?: Tenant[];
  contract?: Contract;
  invoices?: Invoice[];
  paymentHistory?: PaymentHistoryItem[];
  debt?: number;
  sharedTenants?: SharedTenant[];
  notes?: string;
  attachments?: RoomAttachment[];
  building?: any;
  buildingName?: string;
  layout?: { x: number; y: number; width: number; height: number };
}

export interface Floor {
  id: string;
  number: number;
  notes?: string;
  rooms: Room[];
}

export interface Building {
  id: string;
  name: string;
  code?: string;
  address: string;
  images: string[];
  notes?: string;
  status: "active" | "inactive";
  displayOrder?: number;
  floors: Floor[];
}
