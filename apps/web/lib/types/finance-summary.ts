export interface RentalCycleCustomer {
  id: string;
  fullName: string;
  phone: string;
}

export interface RentalCycleRoom {
  id: string;
  code: string;
  name: string;
  rentalType: string;
}

export interface RentalCycleContract {
  id: string;
  code: string;
  status: string;
  monthlyRent: number;
  depositMoney: number;
  source: FinanceSource;
}

export interface RentalCycleDeposit {
  id: string;
  code: string;
  type: string;
  status: string;
  amount: number;
  balance: number;
  contractId: string | null;
  source?: FinanceSource;
}

export interface FinanceSource {
  entity: string;
  id: string | null;
  code: string | null;
}

export interface RentalCycleDepositLedger {
  totalsByType: Record<string, number>;
  balance: number;
  sourceEntities?: FinanceSource[];
  entries?: Array<{
    id: string;
    depositId: string;
    contractId: string | null;
    operationId: string | null;
    type: string;
    amount: number;
    balanceEffect: number;
    sourceType: string | null;
    sourceId: string | null;
    createdAt: string;
    source: FinanceSource;
    operationSource?: FinanceSource;
  }>;
}

export interface RentalCycleInvoicesSummary {
  count: number;
  total: number;
  paid: number;
  credit: number;
  outstanding: number;
  writtenOff?: number;
  families?: Array<{
    rootInvoiceId: string;
    customerId: string;
    contractId: string | null;
    rentalCycleId: string | null;
    total: number;
    cashReceived: number;
    creditApplied: number;
    writtenOff: number;
    outstanding: number;
    sourceEntities: FinanceSource[];
    allocations?: Array<{
      source: FinanceSource;
      paymentSource: FinanceSource;
      invoiceSource: FinanceSource;
      amount: number;
    }>;
  }>;
  excludedDocuments?: Array<{ id: string; reason: string }>;
}

export interface RentalCyclePaymentItem {
  id: string;
  status: string;
  amount: number;
  provider: string;
  paidAt: string | null;
  invoiceId?: string | null;
  source?: FinanceSource;
  invoiceSource?: FinanceSource;
}

export interface RentalCyclePaymentsSummary {
  confirmed: number;
  items: RentalCyclePaymentItem[];
}

export interface RentalCyclePendingOperation {
  id: string;
  type: string;
  receiptId: string | null;
  result: any;
  createdAt: string;
  source?: FinanceSource;
}

export interface RentalCycleFinanceSummary {
  rentalCycleId: string;
  status: string;
  customer: RentalCycleCustomer | null;
  room: RentalCycleRoom | null;
  contracts: RentalCycleContract[];
  deposits: RentalCycleDeposit[];
  depositLedger: RentalCycleDepositLedger;
  invoices: RentalCycleInvoicesSummary;
  payments: RentalCyclePaymentsSummary;
  pendingOperations: RentalCyclePendingOperation[];
}

/** Authoritative server projection for a whole room. Never recalculate these values in the UI. */
export interface RoomFinanceSummary {
  room: RentalCycleRoom;
  totals: {
    rentalCycles: number;
    invoiceTotal: number;
    cashReceived: number;
    writtenOff: number;
    outstanding: number;
    depositBalance: number;
  };
  rentalCycles: RentalCycleFinanceSummary[];
}
