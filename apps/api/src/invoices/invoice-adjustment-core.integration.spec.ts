import { randomUUID } from "node:crypto";
import { InvoiceStatus, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { InvoicesService } from "./invoices.service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL || "";
const hasIsolatedDatabaseMarker = /test|tmp|ci|isolated/i.test(testDatabaseUrl);
const dbDescribe =
  process.env.RUN_INVOICE_ADJUSTMENT_DB_TESTS === "1" &&
  testDatabaseUrl &&
  hasIsolatedDatabaseMarker
    ? describe
    : describe.skip;

dbDescribe("InvoicesService CORE-07.01 PostgreSQL invariants", () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          testDatabaseUrl ||
          "postgresql://disabled:disabled@127.0.0.1:1/core07_test_disabled",
      },
    },
  });
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const tenantId = `tenant-core0701-${suffix}`;
  const otherTenantId = `tenant-core0701-other-${suffix}`;
  const buildingId = `building-core0701-${suffix}`;
  const floorId = `floor-core0701-${suffix}`;
  const roomId = `room-core0701-${suffix}`;
  const customerId = `customer-core0701-${suffix}`;
  const otherCustomerId = `customer-core0701-other-${suffix}`;
  const rentalCycleId = `cycle-core0701-${suffix}`;
  const contractId = `contract-core0701-${suffix}`;
  const baseInvoiceId = `invoice-core0701-${suffix}`;
  let baseItemId = "";

  const lifecyclePublisher = { publish: vi.fn(), publishAsync: vi.fn() };
  const service = new InvoicesService(
    {} as any,
    { log: vi.fn() } as any,
    lifecyclePublisher as any,
    { tx: prisma } as any,
  );

  const debitInput = {
    type: "DEBIT" as const,
    reason: "Điều chỉnh phí điện integration",
    items: [
      {
        type: "UTILITY_ELECTRICITY" as const,
        description: "Bổ sung phí điện",
        quantity: 1,
        unitPrice: 125_000,
        amount: 125_000,
      },
    ],
  };
  let invoiceSequence = 0;

  const createIssuedBase = async (total: number, label: string) => {
    invoiceSequence += 1;
    const token = `${label}-${suffix}-${invoiceSequence}`;
    return prisma.invoice.create({
      data: {
        tenantId,
        contractId,
        rentalCycleId,
        customerId,
        code: `INV-${token}`,
        period: "2026-09",
        usagePeriod: "2026-08",
        status: InvoiceStatus.ISSUED,
        dueDate: new Date("2026-09-05T00:00:00.000Z"),
        subtotal: total,
        total,
        billingKind: "ENTRY",
        baseInvoiceKey: `ENTRY:${contractId}:${token}`,
        items: {
          create: {
            tenantId,
            type: "RENT",
            description: `Base ${label}`,
            servicePeriod: "2026-09",
            quantity: 1,
            unitPrice: total,
            amount: total,
          },
        },
      },
      include: { items: true },
    });
  };

  beforeAll(async () => {
    await prisma.tenantOrg.createMany({
      data: [
        { id: tenantId, name: "CORE 07.01", code: `C0701-${suffix}` },
        {
          id: otherTenantId,
          name: "CORE 07.01 Other",
          code: `C0701-O-${suffix}`,
        },
      ],
    });
    await prisma.building.create({
      data: {
        id: buildingId,
        tenantId,
        code: `B-${suffix}`,
        name: "Tòa CORE 07.01",
      },
    });
    await prisma.floor.create({
      data: {
        id: floorId,
        tenantId,
        buildingId,
        level: 1,
        name: "Tầng 1",
      },
    });
    await prisma.room.create({
      data: {
        id: roomId,
        tenantId,
        buildingId,
        floorId,
        code: `R-${suffix}`,
        name: "Phòng CORE 07.01",
        monthlyPrice: 3_500_000,
      },
    });
    await prisma.customer.createMany({
      data: [
        {
          id: customerId,
          tenantId,
          fullName: "Khách CORE 07.01",
          phone: `0701${suffix.slice(0, 6)}`,
        },
        {
          id: otherCustomerId,
          tenantId: otherTenantId,
          fullName: "Khách tenant khác",
          phone: `0702${suffix.slice(0, 6)}`,
        },
      ],
    });
    await prisma.rentalCycle.create({
      data: {
        id: rentalCycleId,
        tenantId,
        customerId,
        roomId,
        status: "ACTIVE",
      },
    });
    await prisma.contract.create({
      data: {
        id: contractId,
        tenantId,
        roomId,
        customerId,
        rentalCycleId,
        code: `HD-${suffix}`,
        status: "ACTIVE",
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2027-09-01T00:00:00.000Z"),
        monthlyRent: 3_500_000,
        depositMoney: 3_500_000,
      },
    });
    const base = await prisma.invoice.create({
      data: {
        id: baseInvoiceId,
        tenantId,
        contractId,
        rentalCycleId,
        customerId,
        code: `INV-${suffix}`,
        period: "2026-09",
        usagePeriod: "2026-08",
        status: InvoiceStatus.ISSUED,
        dueDate: new Date("2026-09-05T00:00:00.000Z"),
        subtotal: 3_500_000,
        total: 3_500_000,
        billingKind: "MONTHLY_BASE",
        baseInvoiceKey: `MONTHLY:${contractId}:2026-09`,
        items: {
          create: {
            tenantId,
            type: "RENT",
            description: "Tiền thuê tháng 2026-09",
            servicePeriod: "2026-09",
            quantity: 1,
            unitPrice: 3_500_000,
            amount: 3_500_000,
          },
        },
      },
      include: { items: true },
    });
    baseItemId = base.items[0].id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("serializes concurrent same-key commands into one adjustment, audit and outbox", async () => {
    const key = `same-key-${suffix}`;
    const results = await Promise.all([
      service.createAdjustment(
        tenantId,
        baseInvoiceId,
        key,
        debitInput,
        "finance-a",
      ),
      service.createAdjustment(
        tenantId,
        baseInvoiceId,
        key,
        debitInput,
        "finance-b",
      ),
    ]);

    expect(results.map((result) => result.replayed).sort()).toEqual([
      false,
      true,
    ]);
    const adjustments = await prisma.invoice.findMany({
      where: { tenantId, adjustmentIdempotencyKey: key },
    });
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toMatchObject({
      adjustmentOfInvoiceId: baseInvoiceId,
      billingKind: "DEBIT_ADJUSTMENT",
      status: InvoiceStatus.ISSUED,
      contractId,
      rentalCycleId,
      customerId,
      period: "2026-09",
      usagePeriod: "2026-08",
    });
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          module: "InvoicesCore",
          entity: "InvoiceAdjustment",
          entityId: adjustments[0].id,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.count({
        where: {
          tenantId,
          aggregateType: "Invoice",
          aggregateId: adjustments[0].id,
          eventName: "invoice.adjustment.created",
        },
      }),
    ).resolves.toBe(1);
  }, 20_000);

  it("enforces same-tenant parent FK and prevents payment allocation to credit adjustments", async () => {
    await expect(
      prisma.invoice.create({
        data: {
          tenantId: otherTenantId,
          customerId: otherCustomerId,
          code: `ADJ-CROSS-${suffix}`,
          period: "2026-09",
          usagePeriod: "2026-08",
          status: InvoiceStatus.DRAFT,
          dueDate: new Date("2026-09-05T00:00:00.000Z"),
          subtotal: 10_000,
          total: 10_000,
          billingKind: "DEBIT_ADJUSTMENT",
          adjustmentOfInvoiceId: baseInvoiceId,
          adjustmentReason: "Cross tenant must fail",
          adjustmentCreatedBy: "finance-other",
          adjustmentRequestHash: "cross-tenant-hash",
          adjustmentIdempotencyKey: `cross-tenant-${suffix}`,
        },
      }),
    ).rejects.toBeTruthy();

    const credit = await service.createAdjustment(
      tenantId,
      baseInvoiceId,
      `credit-key-${suffix}`,
      {
        type: "CREDIT",
        reason: "Giảm nghĩa vụ sau đối soát",
        items: [
          {
            type: "UTILITY_ELECTRICITY",
            description: "Giảm tiền điện",
            quantity: 1,
            amount: 50_000,
          },
        ],
      },
      "finance-credit",
    );
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        invoiceId: credit.adjustment.id,
        rentalCycleId,
        amount: 50_000,
        provider: "MANUAL",
        status: "CONFIRMED",
        paidAt: new Date(),
      },
    });
    await expect(
      prisma.paymentAllocation.create({
        data: {
          tenantId,
          paymentId: payment.id,
          invoiceId: credit.adjustment.id,
          amount: 50_000,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("keeps issued base and adjustment economic fields/items immutable", async () => {
    const created = await service.createAdjustment(
      tenantId,
      baseInvoiceId,
      `immutable-key-${suffix}`,
      debitInput,
      "finance-immutable",
    );
    const adjustmentItem = await prisma.invoiceItem.findFirstOrThrow({
      where: { tenantId, invoiceId: created.adjustment.id },
    });

    await expect(
      prisma.invoice.update({
        where: { id: baseInvoiceId },
        data: { total: { increment: 1 } },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.invoiceItem.update({
        where: { id: baseItemId },
        data: { amount: { increment: 1 } },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.invoice.update({
        where: { id: created.adjustment.id },
        data: { adjustmentReason: "Không được sửa" },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.invoiceItem.update({
        where: { id: adjustmentItem.id },
        data: { amount: { increment: 1 } },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.invoice.delete({ where: { id: created.adjustment.id } }),
    ).rejects.toBeTruthy();
  });

  it("rolls back adjustment, audit and outbox together when outbox insertion fails", async () => {
    const functionName = `core07_fail_outbox_${suffix}`;
    const triggerName = `core07_fail_outbox_trigger_${suffix}`;
    const key = `rollback-key-${suffix}`;
    const invoiceCountBefore = await prisma.invoice.count({
      where: { tenantId },
    });
    const auditCountBefore = await prisma.auditLog.count({
      where: { tenantId, module: "InvoicesCore" },
    });
    const outboxCountBefore = await prisma.outboxEvent.count({
      where: { tenantId, eventName: "invoice.adjustment.created" },
    });

    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${functionName}"() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW."eventName" = 'invoice.adjustment.created' THEN
          RAISE EXCEPTION 'CORE07_TEST_OUTBOX_FAILURE';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}"
      BEFORE INSERT ON "OutboxEvent"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"();
    `);

    try {
      await expect(
        service.createAdjustment(
          tenantId,
          baseInvoiceId,
          key,
          debitInput,
          "finance-rollback",
        ),
      ).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${triggerName}" ON "OutboxEvent"`,
      );
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS "${functionName}"()`,
      );
    }

    await expect(prisma.invoice.count({ where: { tenantId } })).resolves.toBe(
      invoiceCountBefore,
    );
    await expect(
      prisma.auditLog.count({ where: { tenantId, module: "InvoicesCore" } }),
    ).resolves.toBe(auditCountBefore);
    await expect(
      prisma.outboxEvent.count({
        where: { tenantId, eventName: "invoice.adjustment.created" },
      }),
    ).resolves.toBe(outboxCountBefore);
    await expect(
      prisma.invoice.count({
        where: { tenantId, adjustmentIdempotencyKey: key },
      }),
    ).resolves.toBe(0);
  }, 20_000);

  it.each(["issue", "pay", "cancel", "writeoff"] as const)(
    "fails closed for cross-tenant %s with zero writes",
    async (command) => {
      const paymentsBefore = await prisma.payment.count({
        where: { tenantId },
      });
      const allocationsBefore = await prisma.paymentAllocation.count({
        where: { tenantId },
      });
      const auditsBefore = await prisma.auditLog.count({ where: { tenantId } });
      const outboxBefore = await prisma.outboxEvent.count({
        where: { tenantId },
      });

      const operation =
        command === "issue"
          ? service.issue(baseInvoiceId, "other-user", otherTenantId)
          : command === "pay"
            ? service.pay(
                baseInvoiceId,
                1,
                "MANUAL",
                "cross-tenant",
                "other-user",
                otherTenantId,
              )
            : command === "cancel"
              ? service.cancel(baseInvoiceId, "other-user", otherTenantId)
              : service.writeoff(baseInvoiceId, "other-user", otherTenantId);

      await expect(operation).rejects.toThrow("INVOICE_NOT_FOUND");
      await expect(prisma.payment.count({ where: { tenantId } })).resolves.toBe(
        paymentsBefore,
      );
      await expect(
        prisma.paymentAllocation.count({ where: { tenantId } }),
      ).resolves.toBe(allocationsBefore);
      await expect(
        prisma.auditLog.count({ where: { tenantId } }),
      ).resolves.toBe(auditsBefore);
      await expect(
        prisma.outboxEvent.count({ where: { tenantId } }),
      ).resolves.toBe(outboxBefore);
    },
  );

  it("blocks cancel, writeoff and soft-delete for every protected issued kind", async () => {
    const entry = await createIssuedBase(200_000, "append-entry");
    const debit = await service.createAdjustment(
      tenantId,
      entry.id,
      `append-debit-${suffix}`,
      debitInput,
      "finance-append",
    );
    const credit = await service.createAdjustment(
      tenantId,
      entry.id,
      `append-credit-${suffix}`,
      {
        type: "CREDIT",
        reason: "Credit append-only",
        items: [
          {
            type: "OTHER",
            description: "Credit",
            quantity: 1,
            amount: 10_000,
          },
        ],
      },
      "finance-append",
    );
    const protectedIds = [
      baseInvoiceId,
      entry.id,
      debit.adjustment.id,
      credit.adjustment.id,
    ];

    for (const invoiceId of protectedIds) {
      await expect(
        service.cancel(invoiceId, "finance-append", tenantId),
      ).rejects.toThrow("INVOICE_APPEND_ONLY_REQUIRES_ADJUSTMENT");
      await expect(
        service.writeoff(invoiceId, "finance-append", tenantId),
      ).rejects.toThrow("INVOICE_APPEND_ONLY_REQUIRES_ADJUSTMENT");
      await expect(
        service.softDelete(invoiceId, "finance-append", "Invoices", tenantId),
      ).rejects.toThrow("INVOICE_DELETE_REQUIRES_DRAFT");
      await expect(
        prisma.invoice.update({
          where: { id: invoiceId },
          data: { deletedAt: new Date(), deletedBy: "sql-bypass" },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.CANCELLED },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.WRITTEN_OFF },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.DRAFT },
        }),
      ).rejects.toBeTruthy();
      const before = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        select: { status: true, total: true },
      });
      await expect(
        prisma.invoice.update({
          where: { id: invoiceId },
          data: { total: Number(before.total) + 1 },
        }),
      ).rejects.toBeTruthy();
      await expect(
        prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } }),
      ).resolves.toMatchObject({ status: before.status, total: before.total });
    }
  }, 20_000);

  it("stores one durable semantic event for issue and full payment without direct emit", async () => {
    const draft = await prisma.invoice.create({
      data: {
        tenantId,
        customerId,
        code: `OUTBOX-LIFECYCLE-${suffix}`,
        status: InvoiceStatus.DRAFT,
        dueDate: new Date("2026-09-05T00:00:00.000Z"),
        subtotal: 100,
        total: 100,
        items: {
          create: {
            tenantId,
            type: "OTHER",
            description: "Lifecycle semantic outbox",
            quantity: 1,
            unitPrice: 100,
            amount: 100,
          },
        },
      },
    });

    await service.issue(draft.id, "finance-outbox", tenantId);
    const issuedEvents = await prisma.outboxEvent.findMany({
      where: {
        tenantId,
        aggregateId: draft.id,
        eventName: "invoice.issued",
      },
    });
    expect(issuedEvents).toHaveLength(1);
    expect(issuedEvents[0].payload).toMatchObject({
      tenantId,
      sourceId: draft.id,
      sourceType: "INVOICE",
      amount: 100,
    });

    await service.pay(
      draft.id,
      100,
      "MANUAL",
      `semantic-${suffix}`,
      "finance-outbox",
      tenantId,
    );
    const paidEvents = await prisma.outboxEvent.findMany({
      where: {
        tenantId,
        aggregateId: draft.id,
        eventName: "invoice.paid",
      },
    });
    expect(paidEvents).toHaveLength(1);
    expect(paidEvents[0].payload).toMatchObject({
      tenantId,
      sourceId: draft.id,
      sourceType: "INVOICE",
      amount: 100,
    });
    expect(lifecyclePublisher.publish).not.toHaveBeenCalled();
    expect(lifecyclePublisher.publishAsync).not.toHaveBeenCalled();
  }, 20_000);

  it("CORE-08 replays one manual payment operation without duplicate payment, allocation or credit note", async () => {
    const invoice = await createIssuedBase(100_000, "manual-retry");
    const providerRef = `manual-retry-${suffix}`;

    await service.pay(
      invoice.id,
      100_000,
      "MANUAL",
      providerRef,
      "finance-manual-retry",
      tenantId,
    );
    await service.pay(
      invoice.id,
      100_000,
      "MANUAL",
      providerRef,
      "finance-manual-retry",
      tenantId,
    );

    await expect(
      prisma.payment.count({
        where: { tenantId, provider: "MANUAL", providerRef },
      }),
    ).resolves.toBe(1);
    const retryAllocation = await prisma.paymentAllocation.aggregate({
      where: { tenantId, invoiceId: invoice.id },
      _count: true,
      _sum: { amount: true },
    });
    expect(retryAllocation._count).toBe(1);
    expect(Number(retryAllocation._sum.amount)).toBe(100_000);
    await expect(
      prisma.creditNote.count({
        where: { tenantId, sourceInvoiceId: invoice.id },
      }),
    ).resolves.toBe(0);
  }, 20_000);

  it("CORE-08 replays after manual payment commits but response/request completion is lost", async () => {
    const invoice = await createIssuedBase(100_000, "manual-partial-completion");
    const providerRef = `manual-partial-completion-${suffix}`;
    const submitThenLoseCompletion = async () => {
      await service.pay(
        invoice.id,
        100_000,
        "MANUAL",
        providerRef,
        "finance-manual-partial",
        tenantId,
      );
      throw new Error("REQUEST_COMPLETION_FAILED");
    };

    await expect(submitThenLoseCompletion()).rejects.toThrow(
      "REQUEST_COMPLETION_FAILED",
    );
    await service.pay(
      invoice.id,
      100_000,
      "MANUAL",
      providerRef,
      "finance-manual-partial",
      tenantId,
    );

    await expect(
      prisma.payment.count({
        where: { tenantId, provider: "MANUAL", providerRef },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.paymentAllocation.count({
        where: { tenantId, invoiceId: invoice.id },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.creditNote.count({
        where: { tenantId, sourceInvoiceId: invoice.id },
      }),
    ).resolves.toBe(0);
  }, 20_000);

  it("CORE-08 serializes concurrent manual submissions for one logical operation", async () => {
    const invoice = await createIssuedBase(100_000, "manual-concurrent");
    const providerRef = `manual-concurrent-${suffix}`;
    const attempts = await Promise.allSettled([
      service.pay(
        invoice.id,
        100_000,
        "MANUAL",
        providerRef,
        "finance-manual-concurrent-a",
        tenantId,
      ),
      service.pay(
        invoice.id,
        100_000,
        "MANUAL",
        providerRef,
        "finance-manual-concurrent-b",
        tenantId,
      ),
    ]);

    expect(attempts.map((attempt) => attempt.status)).toEqual([
      "fulfilled",
      "fulfilled",
    ]);
    await expect(
      prisma.payment.count({
        where: { tenantId, provider: "MANUAL", providerRef },
      }),
    ).resolves.toBe(1);
    const concurrentAllocation = await prisma.paymentAllocation.aggregate({
      where: { tenantId, invoiceId: invoice.id },
      _count: true,
      _sum: { amount: true },
    });
    expect(concurrentAllocation._count).toBe(1);
    expect(Number(concurrentAllocation._sum.amount)).toBe(100_000);
    await expect(
      prisma.creditNote.count({
        where: { tenantId, sourceInvoiceId: invoice.id },
      }),
    ).resolves.toBe(0);
  }, 20_000);

  it("enforces credit conservation for unpaid, partial, paid and over-credit families", async () => {
    const unpaid = await createIssuedBase(100_000, "credit-unpaid");
    await expect(
      service.createAdjustment(
        tenantId,
        unpaid.id,
        `credit-unpaid-${suffix}`,
        {
          type: "CREDIT",
          reason: "Unpaid valid",
          items: [
            {
              type: "OTHER",
              description: "Credit 20k",
              quantity: 1,
              amount: 20_000,
            },
          ],
        },
        "finance-credit",
      ),
    ).resolves.toMatchObject({ replayed: false });

    const partial = await createIssuedBase(100_000, "credit-partial");
    await service.pay(
      partial.id,
      40_000,
      "MANUAL",
      `partial-${suffix}`,
      "finance-credit",
      tenantId,
    );
    await expect(
      service.createAdjustment(
        tenantId,
        partial.id,
        `credit-partial-${suffix}`,
        {
          type: "CREDIT",
          reason: "Partial valid",
          items: [
            {
              type: "OTHER",
              description: "Credit 50k",
              quantity: 1,
              amount: 50_000,
            },
          ],
        },
        "finance-credit",
      ),
    ).resolves.toMatchObject({ replayed: false });

    const paid = await createIssuedBase(100_000, "credit-paid");
    await service.pay(
      paid.id,
      100_000,
      "MANUAL",
      `paid-${suffix}`,
      "finance-credit",
      tenantId,
    );
    await expect(
      service.createAdjustment(
        tenantId,
        paid.id,
        `credit-paid-${suffix}`,
        {
          type: "CREDIT",
          reason: "Paid invalid",
          items: [
            {
              type: "OTHER",
              description: "Credit 1",
              quantity: 1,
              amount: 1,
            },
          ],
        },
        "finance-credit",
      ),
    ).rejects.toThrow("INVOICE_CREDIT_REQUIRES_CREDIT_NOTE");

    const overCredit = await createIssuedBase(100_000, "credit-over");
    await expect(
      service.createAdjustment(
        tenantId,
        overCredit.id,
        `credit-over-${suffix}`,
        {
          type: "CREDIT",
          reason: "Over-credit invalid",
          items: [
            {
              type: "OTHER",
              description: "Credit 100001",
              quantity: 1,
              amount: 100_001,
            },
          ],
        },
        "finance-credit",
      ),
    ).rejects.toThrow("INVOICE_CREDIT_REQUIRES_CREDIT_NOTE");
  }, 20_000);

  it("serializes payment versus credit so exactly one economic command wins", async () => {
    const raceBase = await createIssuedBase(100_000, "pay-credit-race");
    const results = await Promise.allSettled([
      service.pay(
        raceBase.id,
        100_000,
        "MANUAL",
        `race-pay-${suffix}`,
        "finance-race",
        tenantId,
      ),
      service.createAdjustment(
        tenantId,
        raceBase.id,
        `race-credit-${suffix}`,
        {
          type: "CREDIT",
          reason: "Concurrent full credit",
          items: [
            {
              type: "OTHER",
              description: "Full credit",
              quantity: 1,
              amount: 100_000,
            },
          ],
        },
        "finance-race",
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);

    const family = await prisma.invoice.findMany({
      where: {
        tenantId,
        OR: [{ id: raceBase.id }, { adjustmentOfInvoiceId: raceBase.id }],
      },
    });
    const gross = family.reduce((sum, invoice) => {
      if (invoice.billingKind === "CREDIT_ADJUSTMENT") {
        return sum - Number(invoice.total);
      }
      return sum + Number(invoice.total);
    }, 0);
    const allocations = await prisma.paymentAllocation.aggregate({
      where: {
        tenantId,
        invoiceId: { in: family.map((invoice) => invoice.id) },
      },
      _sum: { amount: true },
    });
    expect(Number(allocations._sum.amount || 0)).toBeLessThanOrEqual(gross);
  }, 20_000);

  it("blocks InvoiceItem reparenting and tenant spoof against both OLD and NEW parents", async () => {
    const draft = await prisma.invoice.create({
      data: {
        tenantId,
        customerId,
        code: `DRAFT-ITEM-${suffix}`,
        status: InvoiceStatus.DRAFT,
        dueDate: new Date("2026-09-05T00:00:00.000Z"),
        subtotal: 1,
        total: 1,
        items: {
          create: {
            tenantId,
            type: "OTHER",
            description: "Draft item",
            quantity: 1,
            unitPrice: 1,
            amount: 1,
          },
        },
      },
      include: { items: true },
    });

    await expect(
      prisma.invoiceItem.update({
        where: { id: baseItemId },
        data: { invoiceId: draft.id },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.invoiceItem.create({
        data: {
          tenantId: otherTenantId,
          invoiceId: draft.id,
          type: "OTHER",
          description: "Tenant spoof",
          quantity: 1,
          unitPrice: 1,
          amount: 1,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("blocks PaymentAllocation tenant mismatch and credit allocation spoof", async () => {
    const creditBase = await createIssuedBase(100_000, "allocation-credit");
    const credit = await service.createAdjustment(
      tenantId,
      creditBase.id,
      `allocation-credit-${suffix}`,
      {
        type: "CREDIT",
        reason: "Credit allocation guard",
        items: [
          {
            type: "OTHER",
            description: "Credit",
            quantity: 1,
            amount: 10_000,
          },
        ],
      },
      "finance-allocation",
    );
    const sameTenantPayment = await prisma.payment.create({
      data: {
        tenantId,
        invoiceId: creditBase.id,
        amount: 1,
        provider: "MANUAL",
        status: "CONFIRMED",
        paidAt: new Date(),
      },
    });
    const foreignTenantPayment = await prisma.payment.create({
      data: {
        tenantId: otherTenantId,
        invoiceId: creditBase.id,
        amount: 1,
        provider: "MANUAL",
        status: "CONFIRMED",
        paidAt: new Date(),
      },
    });

    await expect(
      prisma.paymentAllocation.create({
        data: {
          tenantId: otherTenantId,
          paymentId: sameTenantPayment.id,
          invoiceId: creditBase.id,
          amount: 1,
        },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.paymentAllocation.create({
        data: {
          tenantId,
          paymentId: foreignTenantPayment.id,
          invoiceId: creditBase.id,
          amount: 1,
        },
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.paymentAllocation.create({
        data: {
          tenantId,
          paymentId: sameTenantPayment.id,
          invoiceId: credit.adjustment.id,
          amount: 1,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("blocks nested, self-linked and cross-scope adjustments plus null-kind metadata", async () => {
    const root = await createIssuedBase(100_000, "scope-root");
    const debit = await service.createAdjustment(
      tenantId,
      root.id,
      `scope-debit-${suffix}`,
      debitInput,
      "finance-scope",
    );
    let attempt = 0;
    const createInvalidAdjustment = (overrides: Record<string, unknown>) => {
      attempt += 1;
      const id = `invalid-scope-${suffix}-${attempt}`;
      return prisma.invoice.create({
        data: {
          id,
          tenantId,
          contractId,
          rentalCycleId,
          customerId,
          code: `INVALID-SCOPE-${suffix}-${attempt}`,
          period: "2026-09",
          usagePeriod: "2026-08",
          status: InvoiceStatus.DRAFT,
          dueDate: new Date("2026-09-05T00:00:00.000Z"),
          subtotal: 1,
          total: 1,
          billingKind: "DEBIT_ADJUSTMENT",
          adjustmentOfInvoiceId: root.id,
          adjustmentReason: "Must fail",
          adjustmentCreatedBy: "finance-scope",
          adjustmentRequestHash: `hash-${attempt}`,
          adjustmentIdempotencyKey: `invalid-scope-key-${suffix}-${attempt}`,
          ...overrides,
        },
      });
    };

    await expect(
      createInvalidAdjustment({ adjustmentOfInvoiceId: debit.adjustment.id }),
    ).rejects.toBeTruthy();
    await expect(
      createInvalidAdjustment({
        id: `self-${suffix}`,
        adjustmentOfInvoiceId: `self-${suffix}`,
      }),
    ).rejects.toBeTruthy();
    await expect(
      createInvalidAdjustment({ customerId: otherCustomerId }),
    ).rejects.toBeTruthy();
    await expect(
      createInvalidAdjustment({ contractId: null }),
    ).rejects.toBeTruthy();
    await expect(
      createInvalidAdjustment({ rentalCycleId: null }),
    ).rejects.toBeTruthy();
    await expect(
      createInvalidAdjustment({ period: "2026-10" }),
    ).rejects.toBeTruthy();
    await expect(
      createInvalidAdjustment({ usagePeriod: "2026-07" }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.invoice.create({
        data: {
          tenantId,
          customerId,
          code: `NULL-KIND-META-${suffix}`,
          status: InvoiceStatus.DRAFT,
          dueDate: new Date("2026-09-05T00:00:00.000Z"),
          subtotal: 1,
          total: 1,
          billingKind: null,
          adjustmentReason: "Metadata without kind",
        },
      }),
    ).rejects.toBeTruthy();
  }, 20_000);

  it("rolls back issue, audit and outbox together when lifecycle outbox fails", async () => {
    const draft = await prisma.invoice.create({
      data: {
        tenantId,
        customerId,
        code: `LIFECYCLE-ROLLBACK-${suffix}`,
        status: InvoiceStatus.DRAFT,
        dueDate: new Date("2026-09-05T00:00:00.000Z"),
        subtotal: 100,
        total: 100,
        items: {
          create: {
            tenantId,
            type: "OTHER",
            description: "Lifecycle rollback",
            quantity: 1,
            unitPrice: 100,
            amount: 100,
          },
        },
      },
    });
    const functionName = `core07_fail_lifecycle_${suffix}`;
    const triggerName = `core07_fail_lifecycle_trigger_${suffix}`;
    const auditBefore = await prisma.auditLog.count({
      where: { tenantId, entityId: draft.id },
    });
    const outboxBefore = await prisma.outboxEvent.count({
      where: { tenantId, aggregateId: draft.id },
    });
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${functionName}"() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW."eventName" = 'invoice.issued' THEN
          RAISE EXCEPTION 'CORE07_TEST_LIFECYCLE_OUTBOX_FAILURE';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}"
      BEFORE INSERT ON "OutboxEvent"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"();
    `);
    try {
      await expect(
        service.issue(draft.id, "finance-rollback", tenantId),
      ).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${triggerName}" ON "OutboxEvent"`,
      );
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS "${functionName}"()`,
      );
    }
    await expect(
      prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({ status: InvoiceStatus.DRAFT });
    await expect(
      prisma.auditLog.count({ where: { tenantId, entityId: draft.id } }),
    ).resolves.toBe(auditBefore);
    await expect(
      prisma.outboxEvent.count({ where: { tenantId, aggregateId: draft.id } }),
    ).resolves.toBe(outboxBefore);
  }, 20_000);
});
