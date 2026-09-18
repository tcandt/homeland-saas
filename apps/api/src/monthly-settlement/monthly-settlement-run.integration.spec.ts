import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { MonthlySettlementService } from "./monthly-settlement.service";

const dbDescribe =
  process.env.RUN_MONTHLY_SETTLEMENT_DB_TESTS === "1"
    ? describe
    : describe.skip;

dbDescribe("MonthlySettlementRun PostgreSQL concurrency", () => {
  const prisma = new PrismaClient();
  const service = new MonthlySettlementService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { log: vi.fn().mockResolvedValue(undefined) } as any,
  );

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows one runner, rejects the concurrent runner and replays completion", async () => {
    let markStarted!: () => void;
    let releaseFirst!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const result = {
      success: true,
      period: "2026-09",
      settledCount: 1,
      skippedCount: 0,
      sentCount: 0,
      invoices: [{ invoiceId: "invoice-core07-1" }],
      skippedInvoices: [],
    };
    const executeSpy = vi
      .spyOn(service as any, "executeCloseMonth")
      .mockImplementation(async () => {
        markStarted();
        await release;
        return result;
      });

    const first = service.closeMonth(
      "tenant-core07-integration",
      "user-core07-a",
      { period: "2026-09", autoSend: false },
    );
    await started;

    await expect(
      service.closeMonth("tenant-core07-integration", "user-core07-b", {
        period: "2026-09",
        autoSend: false,
      }),
    ).rejects.toThrow("MONTHLY_SETTLEMENT_ALREADY_RUNNING");

    releaseFirst();
    await expect(first).resolves.toEqual(result);
    await expect(
      service.closeMonth("tenant-core07-integration", "user-core07-retry", {
        period: "2026-09",
        autoSend: false,
      }),
    ).resolves.toEqual(result);

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(
      await prisma.monthlySettlementRun.count({
        where: {
          tenantId: "tenant-core07-integration",
          billingPeriod: "2026-09",
          scopeKey: "ALL",
        },
      }),
    ).toBe(1);
    expect(
      await prisma.monthlySettlementRun.findFirstOrThrow({
        where: {
          tenantId: "tenant-core07-integration",
          billingPeriod: "2026-09",
          scopeKey: "ALL",
        },
      }),
    ).toMatchObject({ status: "COMPLETED", result });
  }, 20_000);
});
