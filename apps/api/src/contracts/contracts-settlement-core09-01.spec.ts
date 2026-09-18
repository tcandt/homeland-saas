import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ContractStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ContractsService } from "./contracts.service";

const settlementInput = {
  actualMoveOutDate: "2026-09-12",
  rentDaysCharged: 2,
  depositToDeduct: 200,
};

function createFixture() {
  const state: any = {
    contract: {
      id: "contract-1", tenantId: "tenant-1", customerId: "customer-1",
      roomId: "room-1", rentalCycleId: "cycle-1", code: "CT-01",
      status: ContractStatus.ACTIVE, monthlyRent: 3000, depositMoney: 1000,
      deletedAt: null, customer: { id: "customer-1" }, room: { id: "room-1" },
    },
    room: { id: "room-1", tenantId: "tenant-1", status: "OCCUPIED", deletedAt: null },
    cycle: { id: "cycle-1", tenantId: "tenant-1", customerId: "customer-1", roomId: "room-1" },
    deposits: [{ id: "deposit-1", tenantId: "tenant-1", contractId: "contract-1", rentalCycleId: "cycle-1", customerId: "customer-1", roomId: "room-1", createdAt: new Date(), deletedAt: null }],
    ledger: [{ depositId: "deposit-1", tenantId: "tenant-1", balanceEffect: 1000 }],
    settlement: null as any,
    invoices: [] as any[], receipts: [] as any[], operations: [] as any[],
    creditNotes: [] as any[],
    audits: [] as any[], outbox: [] as any[], failInvoice: false,
  };
  let transactionTail: Promise<void> = Promise.resolve();
  const clone = () => structuredClone(state);
  const restore = (snapshot: any) => Object.keys(state).forEach((key) => { state[key] = snapshot[key]; });
  const tx: any = {
    $queryRaw: vi.fn(async () => [{ id: "locked" }]),
    contract: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.tenantId === state.contract.tenantId && where.id === state.contract.id ? state.contract : null),
      updateMany: vi.fn(async () => {
        if (![ContractStatus.ACTIVE, ContractStatus.EXPIRING].includes(state.contract.status)) return { count: 0 };
        state.contract.status = ContractStatus.TERMINATED;
        state.contract.actualMoveOutAt = new Date(settlementInput.actualMoveOutDate);
        return { count: 1 };
      }),
      count: vi.fn(async () =>
        [ContractStatus.ACTIVE, ContractStatus.EXPIRING].includes(
          state.contract.status,
        )
          ? 1
          : 0),
    },
    occupancy: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      count: vi.fn(async () => 0),
    },
    contractParty: { updateMany: vi.fn(async () => ({ count: 1 })) },
    customer: { updateMany: vi.fn(async () => ({ count: 1 })) },
    roomHold: { count: vi.fn(async () => 0) },
    room: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === state.room.id && where.tenantId === state.room.tenantId
          ? state.room
          : null),
      update: vi.fn(async ({ data }: any) => Object.assign(state.room, data)),
    },
    rentalCycle: {
      findFirst: vi.fn(async ({ where }: any) => where.tenantId === state.cycle.tenantId ? state.cycle : null),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    contractSettlement: {
      findFirst: vi.fn(async () => state.settlement),
      create: vi.fn(async ({ data }: any) => (state.settlement = { id: "settlement-1", ...data })),
      update: vi.fn(async ({ data }: any) => Object.assign(state.settlement, data)),
    },
    deposit: { findMany: vi.fn(async () => state.deposits) },
    depositLedgerEntry: {
      aggregate: vi.fn(async ({ where }: any) => ({ _sum: { balanceEffect: state.ledger.filter((row: any) => row.tenantId === where.tenantId && row.depositId === where.depositId).reduce((sum: number, row: any) => sum + Number(row.balanceEffect), 0) } })),
      create: vi.fn(async ({ data }: any) => state.ledger.push(data)),
    },
    invoice: {
      findMany: vi.fn(async () => state.invoices),
      create: vi.fn(async ({ data }: any) => {
        if (state.failInvoice) throw new Error("INJECTED_AFTER_CLAIM_FAILURE");
        const invoice = { id: `invoice-${state.invoices.length + 1}`, ...data };
        state.invoices.push(invoice); return invoice;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const invoice = state.invoices.find(
          (item: any) =>
            item.id === where.id &&
            item.tenantId === where.tenantId &&
            Number(item.creditAmount || 0) === Number(where.creditAmount || 0),
        );
        if (!invoice) return { count: 0 };
        Object.assign(invoice, data);
        return { count: 1 };
      }),
    },
    creditNote: {
      create: vi.fn(async ({ data }: any) => {
        const note = { id: `credit-${state.creditNotes.length + 1}`, ...data };
        state.creditNotes.push(note);
        return note;
      }),
    },
    receipt: {
      create: vi.fn(async ({ data }: any) => { const receipt = { id: `receipt-${state.receipts.length + 1}`, ...data }; state.receipts.push(receipt); return receipt; }),
      findFirst: vi.fn(async ({ where }: any) => state.receipts.find((item: any) => item.id === where.id && item.tenantId === where.tenantId && item.status === where.status) || null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const receipt = state.receipts.find((item: any) => item.id === where.id && item.tenantId === where.tenantId && item.status === where.status);
        if (!receipt) return { count: 0 };
        Object.assign(receipt, data); return { count: 1 };
      }),
    },
    task: { create: vi.fn(async ({ data }: any) => ({ id: "task-1", ...data })), updateMany: vi.fn(async () => ({ count: 1 })) },
    depositOperation: {
      create: vi.fn(async ({ data }: any) => { const operation = { id: `operation-${state.operations.length + 1}`, ...data }; state.operations.push(operation); return operation; }),
      findMany: vi.fn(async ({ where }: any) => state.operations.filter((item: any) => item.tenantId === where.tenantId && item.contractId === where.contractId && item.receiptId === where.receiptId && item.status === where.status && item.type === where.type)),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const operation = state.operations.find((item: any) => item.id === where.id && item.tenantId === where.tenantId && item.status === where.status);
        if (!operation) return { count: 0 };
        Object.assign(operation, data); return { count: 1 };
      }),
    },
    auditLog: { create: vi.fn(async ({ data }: any) => state.audits.push(data)) },
    outboxEvent: { create: vi.fn(async ({ data }: any) => state.outbox.push(data)) },
  };
  const prisma: any = {
    tx: {
      ...tx,
      $transaction: async (callback: any) => {
        const previous = transactionTail;
        let release: (() => void) | undefined;
        transactionTail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        const snapshot = clone();
        try { return await callback(tx); } catch (error) { restore(snapshot); throw error; }
        finally { release?.(); }
      },
    },
    hunonicMeterMapping: { findFirst: vi.fn(async () => null) },
  };
  const service = new ContractsService(
    {} as any, { log: vi.fn() } as any, prisma, { publish: vi.fn() } as any,
    { getRoomElectricityPricing: vi.fn(async () => null) } as any,
  );
  return { state, service, tx };
}

describe("CORE-09.01 authoritative settlement command", () => {
  const addOldDebt = (state: any, input: Partial<any> = {}) => {
    state.invoices.push({
      id: input.id || `old-invoice-${state.invoices.length + 1}`,
      tenantId: "tenant-1",
      contractId: "contract-1",
      rentalCycleId: "cycle-1",
      customerId: "customer-1",
      status: input.status || "ISSUED",
      billingKind: input.billingKind || "MONTHLY_RENT",
      adjustmentOfInvoiceId: input.adjustmentOfInvoiceId || null,
      baseInvoiceKey: input.baseInvoiceKey || `OLD:${state.invoices.length + 1}`,
      total: input.total ?? 1000,
      paidAmount: input.paidAmount ?? 0,
      creditAmount: input.creditAmount ?? 0,
      dueDate: input.dueDate || new Date("2026-08-01"),
      createdAt: new Date("2026-08-01"),
    });
  };

  it.each([
    ["deposit greater than debt", 1000, 600, 0, 400],
    ["deposit equals debt", 1000, 1000, 0, 0],
    ["deposit below debt", 500, 1000, 500, 0],
  ])("offsets old debt before refund: %s", async (_name, deposit, debt, outstanding, refund) => {
    const { state, service } = createFixture();
    state.ledger[0].balanceEffect = deposit;
    addOldDebt(state, { total: debt });

    await service.terminateContract(
      "contract-1",
      "user-1",
      { actualMoveOutDate: "2026-09-12", rentDaysCharged: 0, depositToRefund: deposit },
      "tenant-1",
      `settle-old-debt-${deposit}-${debt}`,
    );

    expect(state.settlement.netReceivable).toBe(outstanding);
    expect(state.settlement.refundToCustomer).toBe(refund);
    expect(state.creditNotes.reduce((sum: number, note: any) => sum + note.amount, 0)).toBe(
      Math.min(deposit, debt),
    );
  });

  it("offsets old debt and final utilities in one conserved balance", async () => {
    const { state, service } = createFixture();
    state.ledger[0].balanceEffect = 700;
    addOldDebt(state, { total: 600 });
    await service.terminateContract(
      "contract-1",
      "user-1",
      { actualMoveOutDate: "2026-09-12", rentDaysCharged: 0, electricityAmount: 200, depositToRefund: 700 },
      "tenant-1",
      "settle-old-debt-utilities",
    );
    expect(state.settlement.netReceivable).toBe(100);
    expect(state.settlement.refundToCustomer).toBe(0);
    expect(state.creditNotes).toHaveLength(1);
    expect(state.creditNotes[0].amount).toBe(600);
  });

  it("does not count cancelled or issued credit-adjustment debt twice", async () => {
    const { state, service } = createFixture();
    addOldDebt(state, { id: "root", total: 1000 });
    addOldDebt(state, { id: "cancelled", total: 500, status: "CANCELLED" });
    addOldDebt(state, {
      id: "credit-adjustment",
      total: 400,
      billingKind: "CREDIT_ADJUSTMENT",
      adjustmentOfInvoiceId: "root",
    });
    await service.terminateContract(
      "contract-1",
      "user-1",
      { actualMoveOutDate: "2026-09-12", rentDaysCharged: 0, depositToRefund: 1000 },
      "tenant-1",
      "settle-reversed-credit",
    );
    expect(state.settlement.netReceivable).toBe(0);
    expect(state.settlement.refundToCustomer).toBe(400);
    expect(state.creditNotes).toHaveLength(1);
    expect(state.creditNotes[0].amount).toBe(600);
  });

  it("distributes a family credit across the root and debit adjustment exactly once", async () => {
    const { state, service } = createFixture();
    addOldDebt(state, { id: "family-root", total: 100 });
    addOldDebt(state, {
      id: "family-debit",
      total: 500,
      billingKind: "DEBIT_ADJUSTMENT",
      adjustmentOfInvoiceId: "family-root",
    });
    addOldDebt(state, {
      id: "family-credit",
      total: 500,
      billingKind: "CREDIT_ADJUSTMENT",
      adjustmentOfInvoiceId: "family-root",
    });

    await service.terminateContract(
      "contract-1",
      "user-1",
      {
        actualMoveOutDate: "2026-09-12",
        rentDaysCharged: 0,
        depositToRefund: 1000,
      },
      "tenant-1",
      "settle-family-credit-distribution",
    );

    expect(state.settlement.netReceivable).toBe(0);
    expect(state.settlement.refundToCustomer).toBe(900);
    expect(state.creditNotes).toHaveLength(1);
    expect(state.creditNotes[0].amount).toBe(100);
  });

  it("commits the exact deposit application once and replays the same operation", async () => {
    const { state, service, tx } = createFixture();
    await service.terminateContract("contract-1", "user-1", settlementInput, "tenant-1", "settle-key-0001");
    await service.terminateContract("contract-1", "user-1", settlementInput, "tenant-1", "settle-key-0001");
    expect(state.invoices).toHaveLength(1);
    expect(state.operations).toHaveLength(1);
    expect(state.ledger.filter((row: any) => row.type === "DEDUCT")).toHaveLength(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it("allows only one concurrent settlement and leaves no duplicate ledger effect", async () => {
    const { state, service } = createFixture();
    await Promise.all([
      service.terminateContract("contract-1", "user-1", settlementInput, "tenant-1", "settle-key-0002"),
      service.terminateContract("contract-1", "user-1", settlementInput, "tenant-1", "settle-key-0002"),
    ]);
    expect(state.invoices).toHaveLength(1);
    expect(state.ledger.filter((row: any) => row.type === "DEDUCT")).toHaveLength(1);
  });

  it("rolls back an after-claim failure, then safely commits on retry", async () => {
    const { state, service } = createFixture();
    state.failInvoice = true;
    await expect(service.terminateContract("contract-1", "user-1", settlementInput, "tenant-1", "settle-key-0003")).rejects.toThrow("INJECTED_AFTER_CLAIM_FAILURE");
    expect(state.settlement).toBeNull();
    expect(state.ledger.filter((row: any) => row.type === "DEDUCT")).toHaveLength(0);
    state.failInvoice = false;
    await service.terminateContract("contract-1", "user-1", settlementInput, "tenant-1", "settle-key-0003");
    expect(state.invoices).toHaveLength(1);
    expect(state.ledger.filter((row: any) => row.type === "DEDUCT")).toHaveLength(1);
  });

  it("rejects a deposit use above the authoritative ledger balance", async () => {
    const { service } = createFixture();
    await expect(service.terminateContract("contract-1", "user-1", { ...settlementInput, depositToDeduct: 1001 }, "tenant-1", "settle-key-0004")).rejects.toThrow(BadRequestException);
  });

  it("completes a pending refund once and replays its completion without a second ledger debit", async () => {
    const { state, service } = createFixture();
    await service.terminateContract(
      "contract-1", "user-1",
      { actualMoveOutDate: "2026-09-12", rentDaysCharged: 1, depositToRefund: 500, refundReceiptStatus: "PENDING" },
      "tenant-1", "settle-key-0006",
    );
    await service.completePendingSettlementRefund("contract-1", "user-1", "bank confirmed", "tenant-1", "refund-key-0006");
    await service.completePendingSettlementRefund("contract-1", "user-1", "bank confirmed", "tenant-1", "refund-key-0006");
    expect(state.ledger.filter((row: any) => row.type === "REFUND")).toHaveLength(1);
    expect(state.receipts[0].status).toBe("COMPLETED");
  });

  it("fails closed for a tenant that does not own the contract", async () => {
    const { state, service } = createFixture();
    await expect(service.terminateContract("contract-1", "user-1", settlementInput, "tenant-2", "settle-key-0005")).rejects.toThrow(NotFoundException);
    expect(state.settlement).toBeNull();
  });
});
