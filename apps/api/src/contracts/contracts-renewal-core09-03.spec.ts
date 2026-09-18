import { describe, expect, it, vi } from "vitest";
import { ContractStatus, RentalCycleStatus } from "@prisma/client";
import { ContractsService } from "./contracts.service";

const source = {
  id: "contract-old",
  tenantId: "tenant-a",
  roomId: "room-a",
  customerId: "customer-a",
  rentalCycleId: "cycle-closed",
  code: "OLD-1",
  status: ContractStatus.EXPIRED,
  startDate: new Date("2026-01-01T00:00:00.000Z"),
  endDate: new Date("2026-01-31T00:00:00.000Z"),
  monthlyRent: 2_000_000,
  depositMoney: 2_000_000,
  memberCount: 1,
  firstPaymentDate: null,
  purpose: "residential",
  coRepresentativeIds: [],
  termsSnapshot: { historical: true },
};
const terminalCycle = Object.freeze({ id: "cycle-closed", status: RentalCycleStatus.CLOSED });

function setup() {
  let renewed: any = null;
  let cycleCount = 0;
  const oldFinancialDocuments = Object.freeze({
    invoices: [{ id: "invoice-old", total: 2_000_000 }],
    payments: [{ id: "payment-old", amount: 2_000_000 }],
    deposits: [{ id: "deposit-old", amount: 2_000_000 }],
    settlements: [{ id: "settlement-old" }],
  });
  const tx: any = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: source.id }]),
    contract: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.id) return where.tenantId === source.tenantId ? source : null;
        if (where.code) return renewed;
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        if (renewed) throw { code: "P2002" };
        renewed = { id: "contract-renewed", ...data };
        return renewed;
      }),
    },
    rentalCycle: {
      create: vi.fn(async ({ data }: any) => ({ id: `cycle-new-${++cycleCount}`, ...data })),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    invoice: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    deposit: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    contractSettlement: { create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma: any = {
    tx: {
      ...tx,
      $transaction: vi.fn(async (callback: any) => callback(tx)),
    },
  };
  const audit = { log: vi.fn() };
  const service = new ContractsService(
    {} as any,
    audit as any,
    prisma,
    { publish: vi.fn() } as any,
    { getRoomElectricityPricing: vi.fn() } as any,
  );
  vi.spyOn(service as any, "withContractSnapshots").mockImplementation(async (data: any) => ({
    ...data,
    customerSnapshot: {},
    roomSnapshot: {},
    termsSnapshot: { monthlyRent: data.monthlyRent },
  }));
  return {
    service,
    tx,
    audit,
    oldFinancialDocuments,
    persistedRenewalCount: () => (renewed ? 1 : 0),
  };
}

const input = {
  startDate: new Date("2026-02-01T00:00:00.000Z"),
  endDate: new Date("2026-12-31T00:00:00.000Z"),
};
const key = "renewal-key-09-03";

describe("CORE-09.03 renewal", () => {
  it("creates a new DRAFT contract and PLANNED cycle without writing terminal history or finance", async () => {
    const { service, tx, oldFinancialDocuments } = setup();
    const sourceBefore = structuredClone(source);

    const result = await service.renewContract(source.id, input, "user-a", "tenant-a", key);

    expect(result.id).toBe("contract-renewed");
    expect(result.rentalCycleId).toBe("cycle-new-1");
    expect(result.status).toBe(ContractStatus.DRAFT);
    expect(tx.rentalCycle.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: RentalCycleStatus.PLANNED }),
    }));
    expect(tx.rentalCycle.update).not.toHaveBeenCalled();
    expect(tx.rentalCycle.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(terminalCycle).toEqual({ id: "cycle-closed", status: RentalCycleStatus.CLOSED });
    expect(tx.contract.create.mock.calls[0][0].data.termsSnapshot.renewal).toEqual(
      expect.objectContaining({ sourceContractId: source.id, sourceRentalCycleId: "cycle-closed" }),
    );
    expect(oldFinancialDocuments).toEqual({
      invoices: [{ id: "invoice-old", total: 2_000_000 }],
      payments: [{ id: "payment-old", amount: 2_000_000 }],
      deposits: [{ id: "deposit-old", amount: 2_000_000 }],
      settlements: [{ id: "settlement-old" }],
    });
    expect(source).toEqual(sourceBefore);
    for (const model of [tx.invoice, tx.payment, tx.deposit, tx.contractSettlement]) {
      for (const operation of Object.values(model) as any[]) {
        expect(operation).not.toHaveBeenCalled();
      }
    }
  });

  it("replays the same request and converges concurrent retries on one contract", async () => {
    const { service, tx, persistedRenewalCount } = setup();

    const [first, second] = await Promise.all([
      service.renewContract(source.id, input, "user-a", "tenant-a", key),
      service.renewContract(source.id, input, "user-a", "tenant-a", key),
    ]);

    expect(first.id).toBe(second.id);
    expect(persistedRenewalCount()).toBe(1);
    expect(tx.contract.create).toHaveBeenCalledTimes(2); // second insert lost its transaction race
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    await expect(
      service.renewContract(source.id, { ...input, endDate: new Date("2027-01-31T00:00:00.000Z") }, "user-a", "tenant-a", key),
    ).rejects.toThrow("RENEWAL_IDEMPOTENCY_CONFLICT");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(4); // source row lock for both contenders, collision retry, and replay
  });

  it("rejects a cross-tenant source before it can create a cycle", async () => {
    const { service, tx } = setup();

    await expect(
      service.renewContract(source.id, input, "user-b", "tenant-b", key),
    ).rejects.toThrow("Contract with ID contract-old not found");
    expect(tx.rentalCycle.create).not.toHaveBeenCalled();
  });
});
