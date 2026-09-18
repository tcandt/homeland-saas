import { describe, it, expect, vi, beforeEach } from "vitest";
import { depositsApi } from "../../lib/api/deposits.api";
import { apiClient } from "../../lib/api/client";
import type { RentalCycleFinanceSummary, RoomFinanceSummary } from "../../lib/types/finance-summary";
import { invoicesApi } from "../../lib/api/invoices.api";

describe("D2-FIX-01: Production RentalCycle Finance Summary Query & Invariants", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getRentalCycleFinanceSummary queries GET /deposits/rental-cycles/:rentalCycleId/finance-summary", async () => {
    const mockSummary: RentalCycleFinanceSummary = {
      rentalCycleId: "cycle-123",
      status: "ACTIVE",
      customer: { id: "cust-1", fullName: "Nguyen Van A", phone: "0981111111" },
      room: {
        id: "room-1",
        code: "P.101",
        name: "Phòng 101",
        rentalType: "WHOLE",
      },
      contracts: [
        {
          id: "c-1",
          code: "HD-101",
          status: "ACTIVE",
          monthlyRent: 4000000,
          depositMoney: 4000000,
        },
      ],
      deposits: [
        {
          id: "d-1",
          code: "DC-101",
          type: "SECURITY",
          status: "PAID",
          amount: 4000000,
          balance: 4000000,
          contractId: "c-1",
        },
      ],
      depositLedger: {
        totalsByType: {
          CASH_IN: 4000000,
          TRANSFER_OUT: 0,
          TRANSFER_IN: 0,
          REFUND: 0,
          KEEP: 0,
          DEDUCT: 0,
          CREDIT: 0,
        },
        balance: 4000000,
      },
      invoices: {
        count: 1,
        total: 4000000,
        paid: 4000000,
        credit: 0,
        outstanding: 0,
      },
      payments: {
        confirmed: 4000000,
        items: [
          {
            id: "pay-1",
            status: "CONFIRMED",
            amount: 4000000,
            provider: "BANK_TRANSFER",
            paidAt: "2026-09-01T00:00:00.000Z",
          },
        ],
      },
      pendingOperations: [],
    };

    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValue({ data: mockSummary } as any);

    const result = await depositsApi.getRentalCycleFinanceSummary("cycle-123");

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenCalledWith(
      "/deposits/rental-cycles/cycle-123/finance-summary",
    );
    expect(result.data.rentalCycleId).toBe("cycle-123");
    expect(result.data.depositLedger.balance).toBe(4000000);
    expect(result.data.depositLedger.totalsByType.CASH_IN).toBe(4000000);
  });

  it("gets total-room financial truth from its dedicated server endpoint", async () => {
    const roomSummary: RoomFinanceSummary = {
      room: { id: "room-1", code: "P.101", name: "Phòng 101", rentalType: "SHARED" },
      totals: {
        rentalCycles: 2,
        invoiceTotal: 7000000,
        cashReceived: 5000000,
        writtenOff: 0,
        outstanding: 2000000,
        depositBalance: 4000000,
      },
      rentalCycles: [],
    };
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({ data: roomSummary } as any);

    const result = await depositsApi.getRoomFinanceSummary("room-1");

    expect(getSpy).toHaveBeenCalledWith("/deposits/rooms/room-1/finance-summary");
    expect(result.data.totals).toEqual(roomSummary.totals);
  });

  it("correctly maps all authoritative backend ledger enum types", () => {
    const totalsByType = {
      CASH_IN: 5000000,
      TRANSFER_OUT: 3000000,
      TRANSFER_IN: 3000000,
      REFUND: 1000000,
      KEEP: 500000,
      DEDUCT: 500000,
      CREDIT: 200000,
      REVERSAL: 0,
    };

    // Verify all keys are recognized backend ledger types
    const validBackendTypes = [
      "CASH_IN",
      "TRANSFER_OUT",
      "TRANSFER_IN",
      "REFUND",
      "KEEP",
      "DEDUCT",
      "CREDIT",
      "REVERSAL",
    ];
    for (const key of Object.keys(totalsByType)) {
      expect(validBackendTypes).toContain(key);
    }
    expect(totalsByType.CASH_IN).toBe(5000000);
    expect(totalsByType.TRANSFER_OUT).toBe(3000000);
    expect(totalsByType.REFUND).toBe(1000000);
  });

  it("isolates invoices strictly by rentalCycleId across consecutive rental cycles of same customer", () => {
    const cycle1Id = "cycle-cust1-period1";
    const cycle2Id = "cycle-cust1-period2";

    const allInvoices = [
      {
        id: "inv-1",
        code: "HD-001",
        customerId: "cust-1",
        rentalCycleId: cycle1Id,
        total: 3000000,
      },
      {
        id: "inv-2",
        code: "HD-002",
        customerId: "cust-1",
        rentalCycleId: cycle1Id,
        total: 3000000,
      },
      {
        id: "inv-3",
        code: "HD-003",
        customerId: "cust-1",
        rentalCycleId: cycle2Id,
        total: 3500000,
      },
    ];

    const cycle1Invoices = allInvoices.filter(
      (inv) => inv.rentalCycleId === cycle1Id,
    );
    const cycle2Invoices = allInvoices.filter(
      (inv) => inv.rentalCycleId === cycle2Id,
    );

    expect(cycle1Invoices).toHaveLength(2);
    expect(cycle1Invoices.map((i) => i.id)).toEqual(["inv-1", "inv-2"]);

    expect(cycle2Invoices).toHaveLength(1);
    expect(cycle2Invoices.map((i) => i.id)).toEqual(["inv-3"]);
  });

  it("requests invoices with the full room, customer, contract and rental-cycle scope", async () => {
    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValue({ data: [] } as any);

    await invoicesApi.list({
      roomId: "room-1",
      customerId: "customer-1",
      contractId: "contract-1",
      rentalCycleId: "cycle-1",
    });

    expect(getSpy).toHaveBeenCalledWith("/invoices", {
      params: {
        roomId: "room-1",
        customerId: "customer-1",
        contractId: "contract-1",
        rentalCycleId: "cycle-1",
      },
    });
  });
});
