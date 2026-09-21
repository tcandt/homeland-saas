import { BadRequestException, ConflictException } from "@nestjs/common";
import { InvoiceStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateInvoiceAdjustmentSchema } from "@homeland/shared";
import { InvoicesService } from "./invoices.service";

describe("InvoicesService CORE-07.01 adjustment command", () => {
  let service: InvoicesService;
  let tx: any;
  let prisma: any;

  const debitInput = {
    type: "DEBIT" as const,
    reason: "Bổ sung phí điện sau đối soát",
    items: [
      {
        type: "UTILITY_ELECTRICITY" as const,
        description: "Điều chỉnh điện tháng 2026-08",
        quantity: 2,
        unitPrice: 50_000,
        amount: 100_000,
      },
    ],
  };

  const base = {
    id: "base-1",
    tenantId: "tenant-1",
    contractId: "contract-1",
    rentalCycleId: "cycle-1",
    customerId: "customer-1",
    code: "INV-202609-101",
    period: "2026-09",
    usagePeriod: "2026-08",
    status: InvoiceStatus.ISSUED,
    dueDate: new Date("2026-09-05T00:00:00.000Z"),
    subtotal: 3_500_000,
    total: 3_500_000,
    billingKind: "MONTHLY_BASE",
    baseInvoiceKey: "MONTHLY:contract-1:2026-09",
    adjustmentOfInvoiceId: null,
  };

  beforeEach(() => {
    tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ lock: "" }]),
      invoice: {
        findFirst: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findFirstOrThrow: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn() },
      outboxEvent: { create: vi.fn() },
      payment: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
      paymentAllocation: { create: vi.fn(), findMany: vi.fn() },
    };
    prisma = {
      tx: {
        ...tx,
        $transaction: vi.fn(async (callback: any) => callback(tx)),
      },
    };
    service = new InvoicesService(
      {} as any,
      { log: vi.fn() } as any,
      { publish: vi.fn() } as any,
      prisma,
    );
  });

  it("rejects an absent or invalid idempotency header", async () => {
    await expect(
      service.createAdjustment("tenant-1", base.id, "", debitInput, "user-1"),
    ).rejects.toThrow("IDEMPOTENCY_KEY_INVALID");
    await expect(
      service.createAdjustment(
        "tenant-1",
        base.id,
        "short",
        debitInput,
        "user-1",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.tx.$transaction).not.toHaveBeenCalled();
  });

  it("validates type, positive item magnitude and rejects caller-supplied period scope", () => {
    expect(() =>
      CreateInvoiceAdjustmentSchema.parse({
        ...debitInput,
        type: "REVERSAL",
      }),
    ).toThrow();
    expect(() =>
      CreateInvoiceAdjustmentSchema.parse({
        ...debitInput,
        items: [{ ...debitInput.items[0], amount: 0 }],
      }),
    ).toThrow();
    expect(() =>
      CreateInvoiceAdjustmentSchema.parse({
        ...debitInput,
        period: "2026-10",
      }),
    ).toThrow();
    expect(() =>
      CreateInvoiceAdjustmentSchema.parse({
        ...debitInput,
        items: [
          {
            ...debitInput.items[0],
            quantity: 2,
            unitPrice: 60_000,
            amount: 100_000,
          },
        ],
      }),
    ).toThrow();
  });

  it("creates one issued debit adjustment inheriting the entire root scope with atomic audit and outbox", async () => {
    tx.invoice.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(base);
    tx.invoice.create.mockImplementation(async ({ data }: any) => ({
      id: "adjustment-1",
      ...data,
      items: data.items.create,
    }));
    tx.invoice.update.mockImplementation(async ({ data }: any) => ({
      id: "adjustment-1",
      ...tx.invoice.create.mock.results[0].value,
      ...data,
      adjustmentOfInvoiceId: base.id,
      billingKind: "DEBIT_ADJUSTMENT",
      total: 100_000,
      items: [{ amount: 100_000 }],
    }));
    tx.invoice.findMany.mockResolvedValue([
      base,
      {
        id: "adjustment-1",
        billingKind: "DEBIT_ADJUSTMENT",
        status: InvoiceStatus.ISSUED,
        total: 100_000,
      },
    ]);

    const result = await service.createAdjustment(
      "tenant-1",
      base.id,
      "adjustment-key-1",
      debitInput,
      "user-1",
    );

    expect(tx.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        contractId: base.contractId,
        rentalCycleId: base.rentalCycleId,
        customerId: base.customerId,
        period: base.period,
        usagePeriod: base.usagePeriod,
        dueDate: base.dueDate,
        status: InvoiceStatus.DRAFT,
        billingKind: "DEBIT_ADJUSTMENT",
        baseInvoiceKey: null,
        adjustmentOfInvoiceId: base.id,
        adjustmentReason: debitInput.reason,
        adjustmentCreatedBy: "user-1",
        adjustmentIdempotencyKey: "adjustment-key-1",
        subtotal: 100_000,
        total: 100_000,
        items: {
          create: [
            expect.objectContaining({
              tenantId: "tenant-1",
              servicePeriod: base.usagePeriod,
              amount: 100_000,
            }),
          ],
        },
      }),
      include: { items: true },
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      replayed: false,
      accountingStatus: "PENDING_FINANCE_MAPPING",
      familyTotals: {
        baseTotal: 3_500_000,
        debitAdjustmentTotal: 100_000,
        creditAdjustmentTotal: 0,
        adjustedTotal: 3_600_000,
      },
    });
  });

  it("replays the exact record for the same key and rejects a changed request hash", async () => {
    const normalized = {
      baseInvoiceId: base.id,
      type: debitInput.type,
      reason: debitInput.reason,
      items: debitInput.items.map((item) => ({
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
    };
    const existing = {
      id: "adjustment-replay",
      tenantId: "tenant-1",
      adjustmentOfInvoiceId: base.id,
      adjustmentRequestHash: (service as any).hash(normalized),
      billingKind: "DEBIT_ADJUSTMENT",
      status: InvoiceStatus.ISSUED,
      total: 100_000,
      items: [{ amount: 100_000 }],
    };
    tx.invoice.findFirst.mockResolvedValue(existing);
    tx.invoice.findMany.mockResolvedValue([base, existing]);

    await expect(
      service.createAdjustment(
        "tenant-1",
        base.id,
        "adjustment-replay-key",
        debitInput,
        "user-1",
      ),
    ).resolves.toMatchObject({ adjustment: existing, replayed: true });
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();

    tx.invoice.findFirst.mockResolvedValue({
      ...existing,
      adjustmentRequestHash: "different-hash",
    });
    await expect(
      service.createAdjustment(
        "tenant-1",
        base.id,
        "adjustment-replay-key",
        debitInput,
        "user-1",
      ),
    ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
  });

  it.each([
    [
      "DRAFT base",
      { ...base, status: InvoiceStatus.DRAFT },
      "INVOICE_ADJUSTMENT_BASE_STATUS_INVALID",
    ],
    [
      "adjustment target",
      {
        ...base,
        billingKind: "DEBIT_ADJUSTMENT",
        adjustmentOfInvoiceId: "root-1",
      },
      "INVOICE_ADJUSTMENT_REQUIRES_ROOT_BASE",
    ],
    [
      "manual invoice",
      { ...base, billingKind: null, baseInvoiceKey: null },
      "INVOICE_ADJUSTMENT_BASE_KIND_INVALID",
    ],
  ])("rejects %s", async (_name, invalidBase, errorCode) => {
    tx.invoice.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(invalidBase);
    await expect(
      service.createAdjustment(
        "tenant-1",
        base.id,
        "invalid-base-key",
        debitInput,
        "user-1",
      ),
    ).rejects.toThrow(errorCode);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("uses explicit tenant scope for locks and base reads and cannot see another tenant root", async () => {
    tx.invoice.findFirst.mockResolvedValue(null);
    tx.$queryRaw
      .mockResolvedValueOnce([{ lock: "" }])
      .mockResolvedValueOnce([]);

    await expect(
      service.createAdjustment(
        "tenant-b",
        base.id,
        "cross-tenant-key",
        debitInput,
        "user-b",
      ),
    ).rejects.toThrow("INVOICE_ADJUSTMENT_BASE_NOT_FOUND");
    expect(tx.invoice.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-b",
        adjustmentIdempotencyKey: "cross-tenant-key",
        deletedAt: null,
      },
      include: { items: true },
    });
  });

  it("rejects payment allocation to a credit adjustment inside a tenant-scoped transaction", async () => {
    const creditAdjustment = {
      id: "credit-adjustment-1",
      tenantId: "tenant-1",
      adjustmentOfInvoiceId: base.id,
      billingKind: "CREDIT_ADJUSTMENT",
      status: InvoiceStatus.ISSUED,
      total: 100_000,
      paidAmount: 0,
      creditAmount: 0,
      items: [],
      allocations: [],
      customer: {},
      contract: null,
    };
    tx.invoice.findFirst
      .mockResolvedValueOnce({
        id: creditAdjustment.id,
        adjustmentOfInvoiceId: base.id,
      })
      .mockResolvedValueOnce(creditAdjustment);

    await expect(
      service.pay(
        "credit-adjustment-1",
        100_000,
        "MANUAL",
        "credit-pay",
        "user-1",
        "tenant-1",
      ),
    ).rejects.toThrow("CREDIT_ADJUSTMENT_PAYMENT_ALLOCATION_FORBIDDEN");
    expect(prisma.tx.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("returns signed family totals without counting a credit adjustment as positive debt", async () => {
    tx.invoice.findFirstOrThrow.mockResolvedValue({
      ...base,
      items: [],
      allocations: [],
    });
    tx.invoice.findMany.mockResolvedValue([
      base,
      {
        id: "debit-1",
        billingKind: "DEBIT_ADJUSTMENT",
        status: InvoiceStatus.ISSUED,
        total: 200_000,
      },
      {
        id: "credit-1",
        billingKind: "CREDIT_ADJUSTMENT",
        status: InvoiceStatus.ISSUED,
        total: 500_000,
      },
      {
        id: "cancelled-credit",
        billingKind: "CREDIT_ADJUSTMENT",
        status: InvoiceStatus.CANCELLED,
        total: 1_000_000,
      },
    ]);

    const result = await service.getDetailWithFamily(base.id, "tenant-1");
    expect(result.familyTotals).toEqual({
      rootInvoiceId: base.id,
      baseTotal: 3_500_000,
      debitAdjustmentTotal: 200_000,
      creditAdjustmentTotal: 1_500_000,
      adjustedTotal: 2_200_000,
    });
    expect(tx.invoice.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: base.id, tenantId: "tenant-1", deletedAt: null },
      }),
    );
  });

  it("propagates outbox failure so the surrounding transaction can roll back all writes", async () => {
    tx.invoice.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(base);
    tx.invoice.create.mockResolvedValue({ id: "adjustment-rollback" });
    tx.invoice.update.mockResolvedValue({
      id: "adjustment-rollback",
      adjustmentOfInvoiceId: base.id,
      billingKind: "DEBIT_ADJUSTMENT",
      total: 100_000,
      items: [],
    });
    tx.outboxEvent.create.mockRejectedValue(new Error("OUTBOX_TEST_FAILURE"));

    await expect(
      service.createAdjustment(
        "tenant-1",
        base.id,
        "rollback-key-1",
        debitInput,
        "user-1",
      ),
    ).rejects.toThrow("OUTBOX_TEST_FAILURE");
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.invoice.findMany).not.toHaveBeenCalled();
  });

  it.each(["issue", "pay", "cancel", "writeoff"] as const)(
    "fails closed for cross-tenant %s and performs zero economic/evidence writes",
    async (command) => {
      tx.$queryRaw.mockResolvedValue([]);
      tx.invoice.findFirst.mockResolvedValue(null);

      const operation =
        command === "issue"
          ? service.issue(base.id, "user-b", "tenant-b")
          : command === "pay"
            ? service.pay(
                base.id,
                100_000,
                "MANUAL",
                "cross-tenant",
                "user-b",
                "tenant-b",
              )
            : command === "cancel"
              ? service.cancel(base.id, "user-b", "tenant-b")
              : service.writeoff(base.id, "user-b", "tenant-b");

      await expect(operation).rejects.toThrow("INVOICE_NOT_FOUND");
      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(tx.invoice.updateMany).not.toHaveBeenCalled();
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(tx.paymentAllocation.create).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
      expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["ENTRY", "cancel"],
    ["MONTHLY_BASE", "writeoff"],
    ["DEBIT_ADJUSTMENT", "cancel"],
    ["CREDIT_ADJUSTMENT", "writeoff"],
  ] as const)(
    "keeps issued %s append-only for %s",
    async (billingKind, command) => {
      tx.invoice.findFirst.mockResolvedValue({
        ...base,
        billingKind,
        adjustmentOfInvoiceId: billingKind.includes("ADJUSTMENT")
          ? base.id
          : null,
        items: [],
        allocations: [],
        customer: {},
        contract: null,
      });

      const operation =
        command === "cancel"
          ? service.cancel("protected-1", "user-1", "tenant-1")
          : service.writeoff("protected-1", "user-1", "tenant-1");
      await expect(operation).rejects.toThrow(
        "INVOICE_APPEND_ONLY_REQUIRES_ADJUSTMENT",
      );
      expect(tx.invoice.updateMany).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
      expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    },
  );

  it.each(["ENTRY", "MONTHLY_BASE", "DEBIT_ADJUSTMENT", "CREDIT_ADJUSTMENT"])(
    "does not soft-delete an issued %s document",
    async (billingKind) => {
      tx.invoice.findFirst.mockResolvedValue({
        ...base,
        billingKind,
        payments: [],
        allocations: [],
        creditNotes: [],
        adjustments: [],
        items: [],
      });
      await expect(
        service.softDelete("protected-1", "user-1", "Invoices", "tenant-1"),
      ).rejects.toThrow("INVOICE_DELETE_REQUIRES_DRAFT");
      expect(tx.invoice.update).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["paid family", 3_500_000, 100_000],
    ["over-credit", 0, 3_500_001],
  ])(
    "rejects credit conservation violation for %s",
    async (_caseName, allocatedCash, creditAmount) => {
      tx.invoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(base);
      tx.invoice.findMany.mockResolvedValue([base]);
      tx.paymentAllocation.findMany.mockResolvedValue(
        allocatedCash > 0 ? [{ amount: allocatedCash }] : [],
      );
      await expect(
        service.createAdjustment(
          "tenant-1",
          base.id,
          `credit-conservation-${creditAmount}`,
          {
            type: "CREDIT",
            reason: "Giảm nghĩa vụ",
            items: [
              {
                type: "OTHER",
                description: "Điều chỉnh giảm",
                quantity: 1,
                amount: creditAmount,
              },
            ],
          },
          "user-1",
        ),
      ).rejects.toThrow("INVOICE_CREDIT_REQUIRES_CREDIT_NOTE");
      expect(tx.invoice.create).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
      expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["unpaid", 0, 500_000],
    ["partially paid", 1_000_000, 500_000],
  ])(
    "allows a credit that preserves conservation for an %s family",
    async (_caseName, allocatedCash, creditAmount) => {
      tx.invoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(base);
      tx.invoice.findMany.mockResolvedValueOnce([base]).mockResolvedValueOnce([
        base,
        {
          id: "credit-created",
          billingKind: "CREDIT_ADJUSTMENT",
          status: InvoiceStatus.ISSUED,
          total: creditAmount,
        },
      ]);
      tx.paymentAllocation.findMany.mockResolvedValue(
        allocatedCash > 0 ? [{ amount: allocatedCash }] : [],
      );
      tx.invoice.create.mockResolvedValue({ id: "credit-created" });
      tx.invoice.update.mockResolvedValue({
        id: "credit-created",
        adjustmentOfInvoiceId: base.id,
        billingKind: "CREDIT_ADJUSTMENT",
        status: InvoiceStatus.ISSUED,
        total: creditAmount,
        items: [],
      });

      await expect(
        service.createAdjustment(
          "tenant-1",
          base.id,
          `credit-allowed-${allocatedCash}`,
          {
            type: "CREDIT",
            reason: "Giảm nghĩa vụ hợp lệ",
            items: [
              {
                type: "OTHER",
                description: "Điều chỉnh giảm",
                quantity: 1,
                amount: creditAmount,
              },
            ],
          },
          "user-1",
        ),
      ).resolves.toMatchObject({ replayed: false });
      expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
      expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    },
  );

  it("propagates lifecycle outbox failure before commit", async () => {
    tx.invoice.findFirst.mockResolvedValue({
      ...base,
      billingKind: null,
      baseInvoiceKey: null,
      status: InvoiceStatus.DRAFT,
      discount: 0,
      items: [{ amount: 100_000 }],
      allocations: [],
      customer: {},
      contract: null,
    });
    tx.invoice.findFirstOrThrow.mockResolvedValue({
      ...base,
      billingKind: null,
      status: InvoiceStatus.ISSUED,
      total: 100_000,
    });
    tx.outboxEvent.create.mockRejectedValue(new Error("LIFECYCLE_OUTBOX_FAIL"));

    await expect(
      service.issue("manual-draft", "user-1", "tenant-1"),
    ).rejects.toThrow("LIFECYCLE_OUTBOX_FAIL");
    expect(tx.invoice.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });
});
