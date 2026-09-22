import { describe, it, expect, beforeEach, vi } from "vitest";
import { InvoicesService } from "./invoices.service";
import { InvoiceStatus } from "@prisma/client";
import { BadRequestException, ConflictException } from "@nestjs/common";

describe("InvoicesService", () => {
  let service: InvoicesService;
  let repository: any;
  let auditService: any;
  let eventPublisher: any;
  let prisma: any;

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      paginate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
    auditService = { log: vi.fn() };
    eventPublisher = { publish: vi.fn(), publishAsync: vi.fn() };
    prisma = {
      tx: {
        invoice: {
          findFirst: vi.fn(),
          findFirstOrThrow: vi.fn(),
          findMany: vi.fn(),
          findUniqueOrThrow: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
        outboxEvent: { create: vi.fn().mockResolvedValue({ id: "outbox-1" }) },
        payment: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
        paymentAllocation: {
          create: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
        },
        contract: { findFirst: vi.fn() },
        customer: { findFirst: vi.fn() },
        room: { findFirst: vi.fn() },
        rentalCycle: { findFirst: vi.fn() },
        $queryRaw: vi.fn().mockResolvedValue([{ id: "locked" }]),
        $transaction: vi.fn((cb) => cb(prisma.tx)),
      },
    };

    service = new InvoicesService(
      repository,
      auditService,
      eventPublisher,
      prisma,
    );
  });

  describe("listInvoices", () => {
    it("keeps drafts but excludes legacy zero-value non-drafts", async () => {
      repository.paginate.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0 },
      });

      await service.listInvoices(1, 20, "INV-001", InvoiceStatus.OVERDUE);

      expect(repository.paginate).toHaveBeenCalledWith(
        {
          AND: [
            { OR: [{ total: { gt: 0 } }, { status: InvoiceStatus.DRAFT }] },
            {
              OR: [
                { code: { contains: "INV-001", mode: "insensitive" } },
                {
                  customer: {
                    fullName: { contains: "INV-001", mode: "insensitive" },
                  },
                },
              ],
            },
          ],
          status: InvoiceStatus.OVERDUE,
        },
        1,
        20,
        { createdAt: "desc" },
        expect.any(Object),
      );
    });

    it("scopes room finance by room, customer, contract and cycle", async () => {
      repository.paginate.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0 },
      });

      await service.listInvoices(
        1,
        20,
        undefined,
        undefined,
        "room-1",
        "customer-1",
        "contract-1",
        "cycle-1",
      );

      expect(repository.paginate).toHaveBeenCalledWith(
        expect.objectContaining({
          contract: { is: { roomId: "room-1" } },
          customerId: "customer-1",
          contractId: "contract-1",
          rentalCycleId: "cycle-1",
        }),
        1,
        20,
        { createdAt: "desc" },
        expect.any(Object),
      );
    });
  });

  describe("create", () => {
    const scope = {
      tenantId: "tenant-1",
      roomId: "room-1",
      rentalCycleId: "cycle-1",
    };
    const data = () => ({
      tenantId: "untrusted-tenant",
      customerId: "customer-1",
      contractId: "contract-1",
      rentalCycleId: "untrusted-cycle",
      status: InvoiceStatus.ISSUED,
      items: { create: [{ amount: 50 }] },
    });
    const permitExactScope = () => {
      prisma.tx.contract.findFirst.mockResolvedValue({
        rentalCycleId: "cycle-1",
      });
      prisma.tx.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.tx.room.findFirst.mockResolvedValue({ id: "room-1" });
      prisma.tx.rentalCycle.findFirst.mockResolvedValue({ id: "cycle-1" });
      repository.create.mockResolvedValue({ id: "invoice-1" });
    };

    it("persists an exact authenticated scope as a DRAFT without mutating caller input", async () => {
      permitExactScope();
      const input = data();
      const original = structuredClone(input);

      await service.create(input as any, "user-1", "Invoices", scope);

      expect(prisma.tx.contract.findFirst).toHaveBeenCalledWith({
        where: {
          id: "contract-1",
          tenantId: "tenant-1",
          customerId: "customer-1",
          roomId: "room-1",
          deletedAt: null,
        },
        select: { rentalCycleId: true },
      });
      expect(prisma.tx.rentalCycle.findFirst).toHaveBeenCalledWith({
        where: {
          id: "cycle-1",
          tenantId: "tenant-1",
          customerId: "customer-1",
          roomId: "room-1",
        },
        select: { id: true },
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          customerId: "customer-1",
          contractId: "contract-1",
          rentalCycleId: "cycle-1",
          status: InvoiceStatus.DRAFT,
        }),
      );
      expect(input).toEqual(original);
    });

    it("derives the contract cycle for legacy commands that omit optional scope cycle", async () => {
      permitExactScope();
      const input = data();
      delete (input as any).rentalCycleId;

      await service.create(input as any, "user-1", "Invoices", {
        tenantId: "tenant-1",
        roomId: "room-1",
      });

      expect(prisma.tx.rentalCycle.findFirst).toHaveBeenCalledWith({
        where: {
          id: "cycle-1",
          tenantId: "tenant-1",
          customerId: "customer-1",
          roomId: "room-1",
        },
        select: { id: true },
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ rentalCycleId: "cycle-1" }),
      );
    });

    it.each([
      [
        "authenticated tenant",
        { customerId: "customer-1", contractId: "contract-1" },
        { roomId: "room-1" },
        "TENANT_CONTEXT_REQUIRED",
      ],
      [
        "room scope",
        { customerId: "customer-1", contractId: "contract-1" },
        { tenantId: "tenant-1", roomId: "" },
        "INVOICE_CREATE_SCOPE_REQUIRED",
      ],
      [
        "contract id",
        { customerId: "customer-1" },
        { tenantId: "tenant-1", roomId: "room-1" },
        "INVOICE_CREATE_SCOPE_REQUIRED",
      ],
      [
        "customer id",
        { contractId: "contract-1" },
        { tenantId: "tenant-1", roomId: "room-1" },
        "INVOICE_CREATE_SCOPE_REQUIRED",
      ],
    ])(
      "requires %s before querying or creating",
      async (_label, input, commandScope, errorCode) => {
      await expect(
        service.create(
          input as any,
          "user-1",
          "Invoices",
          commandScope as any,
        ),
      ).rejects.toThrow(errorCode);

      expect(prisma.tx.contract.findFirst).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      },
    );

    it("rejects a contract whose customer or room does not match the command scope", async () => {
      prisma.tx.contract.findFirst.mockResolvedValue(null);
      prisma.tx.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.tx.room.findFirst.mockResolvedValue({ id: "room-1" });

      await expect(
        service.create(data() as any, "user-1", "Invoices", scope),
      ).rejects.toThrow("INVOICE_CREATE_SCOPE_MISMATCH");

      expect(repository.create).not.toHaveBeenCalled();
      expect(prisma.tx.rentalCycle.findFirst).not.toHaveBeenCalled();
    });

    it("rejects a supplied cycle that differs from the contract cycle", async () => {
      permitExactScope();

      await expect(
        service.create(data() as any, "user-1", "Invoices", {
          ...scope,
          rentalCycleId: "cycle-other",
        }),
      ).rejects.toThrow("INVOICE_RENTAL_CYCLE_SCOPE_MISMATCH");

      expect(repository.create).not.toHaveBeenCalled();
      expect(prisma.tx.rentalCycle.findFirst).not.toHaveBeenCalled();
    });

    it("rejects an active-looking contract without a rental cycle", async () => {
      prisma.tx.contract.findFirst.mockResolvedValue({ rentalCycleId: null });
      prisma.tx.customer.findFirst.mockResolvedValue({ id: "customer-1" });
      prisma.tx.room.findFirst.mockResolvedValue({ id: "room-1" });

      await expect(
        service.create(data() as any, "user-1", "Invoices", {
          tenantId: "tenant-1",
          roomId: "room-1",
        }),
      ).rejects.toThrow("INVOICE_CONTRACT_RENTAL_CYCLE_MISSING");

      expect(repository.create).not.toHaveBeenCalled();
    });

    it.each([
      ["cross-tenant or deleted contract", "contract"],
      ["cross-tenant or deleted customer", "customer"],
      ["cross-tenant or deleted room", "room"],
      ["cross-tenant or mismatched rental cycle", "rentalCycle"],
    ])("rejects %s without creating an invoice", async (_label, missing) => {
      permitExactScope();
      prisma.tx[missing].findFirst.mockResolvedValue(null);

      await expect(
        service.create(data() as any, "user-1", "Invoices", scope),
      ).rejects.toThrow(
        missing === "rentalCycle"
          ? "INVOICE_RENTAL_CYCLE_SCOPE_MISMATCH"
          : "INVOICE_CREATE_SCOPE_MISMATCH",
      );

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("issue", () => {
    it("issues once and stores the semantic event only in outbox", async () => {
      const draft = {
        id: "inv-1",
        tenantId: "tenant-1",
        customerId: "customer-1",
        code: "INV-001",
        status: InvoiceStatus.DRAFT,
        billingKind: null,
        items: [{ amount: 100 }],
        discount: 10,
        total: 0,
        customer: { fullName: "Khach A", phone: "0909000001" },
        contract: {
          room: { code: "31-01", building: { name: "LK01-31" } },
        },
      };
      prisma.tx.invoice.findFirst.mockResolvedValue(draft);
      prisma.tx.invoice.findFirstOrThrow.mockResolvedValue({
        ...draft,
        status: InvoiceStatus.ISSUED,
        total: 90,
      });

      const result = await service.issue("inv-1", "user-1", "tenant-1");

      expect(result.status).toBe(InvoiceStatus.ISSUED);
      expect(prisma.tx.invoice.updateMany).toHaveBeenCalledWith({
        where: {
          id: "inv-1",
          tenantId: "tenant-1",
          deletedAt: null,
          status: InvoiceStatus.DRAFT,
        },
        data: { status: InvoiceStatus.ISSUED, subtotal: 100, total: 90 },
      });
      expect(prisma.tx.auditLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.tx.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventName: "invoice.issued",
            payload: expect.objectContaining({
              tenantId: "tenant-1",
              sourceId: "inv-1",
              amount: 90,
            }),
          }),
        }),
      );
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it("rejects a non-positive total", async () => {
      prisma.tx.invoice.findFirst.mockResolvedValue({
        id: "inv-1",
        status: InvoiceStatus.DRAFT,
        billingKind: null,
        items: [{ amount: 100 }],
        discount: 100,
      });

      await expect(
        service.issue("inv-1", "user-1", "tenant-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a non-DRAFT invoice", async () => {
      prisma.tx.invoice.findFirst.mockResolvedValue({
        id: "inv-1",
        status: InvoiceStatus.ISSUED,
        billingKind: null,
      });

      await expect(
        service.issue("inv-1", "user-1", "tenant-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("pay", () => {
    const mockPaymentTarget = (invoice: any) => {
      prisma.tx.invoice.findFirst
        .mockResolvedValueOnce({
          id: invoice.id,
          adjustmentOfInvoiceId: invoice.adjustmentOfInvoiceId || null,
        })
        .mockResolvedValueOnce(invoice);
      prisma.tx.invoice.findMany.mockResolvedValue([
        {
          id: invoice.id,
          billingKind: invoice.billingKind || "ENTRY",
          status: invoice.status,
          total: invoice.total,
        },
      ]);
    };

    it("records a partial payment with a durable event", async () => {
      const invoice = {
        id: "inv-1",
        status: InvoiceStatus.ISSUED,
        billingKind: "ENTRY",
        total: 100,
        paidAmount: 0,
        creditAmount: 0,
        tenantId: "tenant-1",
        customer: {},
        contract: null,
      };
      mockPaymentTarget(invoice);
      prisma.tx.payment.create.mockResolvedValue({ id: "pay-1" });

      const result = await service.pay(
        "inv-1",
        40,
        "MANUAL",
        "manual-partial-1",
        "user-1",
        "tenant-1",
      );

      expect(result.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(prisma.tx.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventName: "invoice.payment.recorded",
          }),
        }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "invoice.payment.recorded",
        expect.objectContaining({
          sourceId: "inv-1",
          outboxEventId: "outbox-1",
          paymentAmount: 40,
          paymentProvider: "MANUAL",
          paymentRef: "manual-partial-1",
        }),
      );
    });

    it("records a full payment as durable invoice.paid", async () => {
      const invoice = {
        id: "inv-1",
        code: "INV-001",
        status: InvoiceStatus.PARTIALLY_PAID,
        billingKind: "ENTRY",
        total: 100,
        paidAmount: 40,
        creditAmount: 0,
        tenantId: "tenant-1",
        customer: {},
        contract: null,
      };
      mockPaymentTarget(invoice);
      prisma.tx.payment.create.mockResolvedValue({ id: "pay-2" });

      const result = await service.pay(
        "inv-1",
        60,
        "MANUAL",
        "manual-full-1",
        "user-1",
        "tenant-1",
      );

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(prisma.tx.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventName: "invoice.paid",
            payload: expect.objectContaining({
              sourceId: "inv-1",
              amount: 100,
            }),
          }),
        }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "invoice.paid",
        expect.objectContaining({
          sourceId: "inv-1",
          outboxEventId: "outbox-1",
          paymentAmount: 60,
          paymentProvider: "MANUAL",
          paymentRef: "manual-full-1",
        }),
      );
    });

    it("uses invoice credit in remaining balance", async () => {
      const invoice = {
        id: "inv-credit-1",
        code: "INV-CREDIT-1",
        status: InvoiceStatus.ISSUED,
        billingKind: "ENTRY",
        total: 100,
        paidAmount: 0,
        creditAmount: 30,
        tenantId: "tenant-1",
        customerId: "customer-1",
        customer: {},
        contract: null,
      };
      mockPaymentTarget(invoice);
      prisma.tx.payment.create.mockResolvedValue({ id: "pay-credit-1" });

      const result = await service.pay(
        "inv-credit-1",
        70,
        "MANUAL",
        "PAY-CREDIT-1",
        "user-1",
        "tenant-1",
      );

      expect(result).toMatchObject({
        status: InvoiceStatus.PAID,
        paidAmount: 70,
        creditAmount: 30,
      });
    });

    it("rejects payment above the invoice remainder", async () => {
      mockPaymentTarget({
        id: "inv-1",
        status: InvoiceStatus.PARTIALLY_PAID,
        billingKind: "ENTRY",
        total: 100,
        paidAmount: 80,
        creditAmount: 0,
        tenantId: "tenant-1",
      });

      await expect(
        service.pay("inv-1", 50, "MANUAL", "manual-overpay-1", "user-1", "tenant-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("requires a stable provider reference before any financial write", async () => {
      await expect(
        service.pay("inv-1", 50, "MANUAL", "", "user-1", "tenant-1"),
      ).rejects.toThrow("PAYMENT_PROVIDER_REFERENCE_REQUIRED");
      expect(prisma.tx.payment.create).not.toHaveBeenCalled();
      expect(prisma.tx.paymentAllocation.create).not.toHaveBeenCalled();
    });

    it("rejects a stale CAS before creating payment records", async () => {
      mockPaymentTarget({
        id: "inv-race-1",
        status: InvoiceStatus.ISSUED,
        billingKind: "ENTRY",
        total: 100,
        paidAmount: 0,
        creditAmount: 0,
        tenantId: "tenant-1",
      });
      prisma.tx.invoice.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.pay("inv-race-1", 40, "MANUAL", "race-1", "user-1", "tenant-1"),
      ).rejects.toThrow(ConflictException);
      expect(prisma.tx.payment.create).not.toHaveBeenCalled();
      expect(prisma.tx.paymentAllocation.create).not.toHaveBeenCalled();
    });

    it("replays a confirmed provider reference without another payment or allocation", async () => {
      const invoice = {
        id: "inv-replay-1",
        status: InvoiceStatus.PAID,
        billingKind: "ENTRY",
        total: 100,
        paidAmount: 100,
        creditAmount: 0,
        tenantId: "tenant-1",
        customer: {},
        contract: null,
      };
      prisma.tx.payment.findFirst.mockResolvedValue({
        invoiceId: "inv-replay-1",
        amount: 100,
        status: "CONFIRMED",
      });
      prisma.tx.invoice.findFirst.mockResolvedValue(invoice);

      await expect(
        service.pay("inv-replay-1", 100, "SEPAY", "txn-replay-1", "user-1", "tenant-1"),
      ).resolves.toMatchObject({ id: "inv-replay-1", status: InvoiceStatus.PAID });

      expect(prisma.tx.payment.create).not.toHaveBeenCalled();
      expect(prisma.tx.paymentAllocation.create).not.toHaveBeenCalled();
    });
  });

  describe("markOverdueInvoices", () => {
    it("excludes credit adjustments and writes audit/outbox per invoice", async () => {
      const dueDate = new Date("2026-08-01T00:00:00.000Z");
      prisma.tx.invoice.findMany.mockResolvedValue([
        {
          id: "inv-1",
          tenantId: "tenant-1",
          code: "INV-1",
          status: InvoiceStatus.ISSUED,
          billingKind: "ENTRY",
          total: 100,
          dueDate,
        },
        {
          id: "inv-2",
          tenantId: "tenant-1",
          code: "INV-2",
          status: InvoiceStatus.PARTIALLY_PAID,
          billingKind: "DEBIT_ADJUSTMENT",
          total: 50,
          dueDate,
        },
      ]);

      const result = await service.markOverdueInvoices("tenant-1", "user-1");

      expect(prisma.tx.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "tenant-1",
            OR: [
              { billingKind: null },
              { billingKind: { not: "CREDIT_ADJUSTMENT" } },
            ],
          }),
        }),
      );
      expect(result).toMatchObject({ updated: 2, checkedAt: expect.any(Date) });
      expect(prisma.tx.auditLog.create).toHaveBeenCalledTimes(2);
      expect(prisma.tx.outboxEvent.create).toHaveBeenCalledTimes(2);
    });
  });
});
