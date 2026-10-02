import { describe, it, expect, beforeEach, vi } from "vitest";
import { InvoicesService } from "./invoices.service";
import { assertCombinedEntryInvoice, getCombinedEntryInvoice } from "./combined-entry-invoice";
import { InvoiceStatus } from "@prisma/client";
import { BadRequestException, ConflictException } from "@nestjs/common";

describe("InvoicesService", () => {
  let service: InvoicesService;
  let repository: any;
  let auditService: any;
  let prisma: any;

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      paginate: vi.fn(),
      paginateCursor: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
    auditService = { log: vi.fn() };
    prisma = {
      tx: {
        invoice: {
          create: vi.fn().mockResolvedValue({ id: "invoice-1" }),
          findFirst: vi.fn(),
          findFirstOrThrow: vi.fn(),
          findMany: vi.fn(),
          findUniqueOrThrow: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
        outboxEvent: { create: vi.fn().mockResolvedValue({ id: "outbox-1" }), findMany: vi.fn().mockResolvedValue([]) },
        payment: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
        paymentAllocation: {
          create: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
        },
        contract: { findFirst: vi.fn() },
        customer: { findFirst: vi.fn() },
        room: { findFirst: vi.fn() },
        rentalCycle: { findFirst: vi.fn() },
        paymentPromise: {
          findFirst: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({
            id: "promise-1",
            tenantId: "tenant-1",
            invoiceId: "invoice-1",
            amount: 300,
            dueDate: new Date("2026-10-01T00:00:00.000Z"),
            status: "PENDING",
          }),
        },
        $queryRaw: vi.fn().mockResolvedValue([{ id: "locked" }]),
        $transaction: vi.fn((cb) => cb(prisma.tx)),
      },
    };

    service = new InvoicesService(
      repository,
      auditService,
      prisma,
    );
  });

  describe("listDepositBillingDocuments", () => {
    it("reads security documents with exact tenant and rental scope without writing", async () => {
      prisma.tx.deposit = {
        findMany: vi.fn().mockResolvedValue([{
          id: "security-1", type: "SECURITY", amount: 8_000_000, status: "PAID", ledgerEntries: [
            { id: "transfer", type: "TRANSFER_IN", balanceEffect: 1_000_000 },
            { id: "cash", type: "CASH_IN", balanceEffect: 7_000_000, operationId: "collect-1", operation: { idempotencyKey: "manual-1" } },
          ],
        }]),
        count: vi.fn().mockResolvedValue(101),
        create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
      };
      const scope = { roomId: "room-1", customerId: "customer-1", contractId: "contract-1", rentalCycleId: "cycle-1" };
      const result = await service.listDepositBillingDocuments("tenant-1", 2, 100, scope);
      const where = { tenantId: "tenant-1", deletedAt: null, type: { in: ["SECURITY", "BOOKING", "RESERVATION"] }, ...scope };
      expect(prisma.tx.deposit.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where, skip: 100, take: 100, orderBy: { createdAt: "desc" },
        include: expect.objectContaining({ ledgerEntries: {
          where: { tenantId: "tenant-1" },
          select: {
            id: true, type: true, balanceEffect: true, reversalOfId: true, operationId: true,
            operation: { select: { idempotencyKey: true } },
          },
        } }),
      }));
      expect(prisma.tx.deposit.count).toHaveBeenCalledWith({ where });
      expect(result).toMatchObject({ total: 101, page: 2, limit: 100, items: [
        { documentType: "DEPOSIT", total: 7_000_000, paidAmount: 7_000_000 },
      ] });
      expect(prisma.tx.deposit.create).not.toHaveBeenCalled();
      expect(prisma.tx.deposit.update).not.toHaveBeenCalled();
      expect(prisma.tx.deposit.updateMany).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(prisma.tx.payment.create).not.toHaveBeenCalled();
      expect(prisma.tx.outboxEvent.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", aggregateType: "DepositOperation", aggregateId: { in: ["collect-1"] }, eventName: "deposit.collected" },
        select: { aggregateId: true, payload: true },
      });
    });

    it.each(["outbox", "request", "legacy-invoice-key"])("excludes already invoiced cash linked by %s", async (source) => {
      const key = source === "request" ? "reconcile:confirmed-payment:request-1"
        : source === "legacy-invoice-key" ? "reconcile:confirmed-payment:paid-invoice:invoice-1" : "collection-1";
      prisma.tx.deposit = {
        findMany: vi.fn().mockResolvedValue([{
          id: "security-1", amount: 8_000_000, status: "PAID", ledgerEntries: [
            { id: "cash-1", type: "CASH_IN", balanceEffect: 8_000_000, operationId: "collect-1", operation: { idempotencyKey: key } },
          ],
        }]), count: vi.fn().mockResolvedValue(1),
      };
      prisma.tx.outboxEvent.findMany.mockResolvedValue(source === "outbox" ? [{
        aggregateId: "collect-1", payload: { metadata: { linkedInvoicePayment: true, sourceInvoiceId: "invoice-1" } },
      }] : []);
      prisma.tx.paymentRequest = { findMany: vi.fn().mockResolvedValue([{ id: "request-1", sourceId: "invoice-1" }]) };
      prisma.tx.invoice.findMany.mockResolvedValue([{ id: "invoice-1" }]);
      const result = await service.listDepositBillingDocuments("tenant-1", 1, 100);
      expect(result.items[0]).toMatchObject({ total: 0, paidAmount: 0, invoiceCoveredAmount: 8_000_000, status: "PAID" });
      expect(prisma.tx.invoice.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", deletedAt: null, id: { in: ["invoice-1"] } }, include: { items: true },
      });
      if (source === "request") expect(prisma.tx.paymentRequest.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", id: { in: ["request-1"] }, sourceType: "INVOICE", status: "CONFIRMED" },
        select: { id: true, sourceId: true },
      });
    });

    it("does not exclude cash when the linked invoice is absent from the authenticated tenant", async () => {
      prisma.tx.deposit = {
        findMany: vi.fn().mockResolvedValue([{
          id: "security-1", amount: 8_000_000, status: "PAID", ledgerEntries: [
            { id: "cash-1", type: "CASH_IN", balanceEffect: 8_000_000, operationId: "collect-1", operation: { idempotencyKey: "collection-1" } },
          ],
        }]), count: vi.fn().mockResolvedValue(1),
      };
      prisma.tx.outboxEvent.findMany.mockResolvedValue([{
        aggregateId: "collect-1", payload: { metadata: { linkedInvoicePayment: true, sourceInvoiceId: "foreign-invoice" } },
      }]);
      prisma.tx.invoice.findMany.mockResolvedValue([]);
      const result = await service.listDepositBillingDocuments("tenant-1", 1, 100);
      expect(result.items[0]).toMatchObject({ total: 8_000_000, paidAmount: 8_000_000, invoiceCoveredAmount: 0 });
    });

    it("requires a tenant before reading financial documents", async () => {
      await expect(service.listDepositBillingDocuments("", 1, 20)).rejects.toThrow("TENANT_REQUIRED");
    });
  });

  describe("payment promises", () => {
    it("records a partial-payment appointment without changing invoice obligation", async () => {
      prisma.tx.invoice.findFirst.mockResolvedValue({
        id: "invoice-1",
        customerId: "customer-1",
        contractId: "contract-1",
        rentalCycleId: "cycle-1",
        total: 1000,
        paidAmount: 400,
        creditAmount: 0,
        status: InvoiceStatus.PARTIALLY_PAID,
      });

      await expect(service.createPaymentPromise(
        "invoice-1",
        {
          amount: 300,
          dueDate: "2026-10-01T00:00:00.000Z",
          note: "Khách hẹn trả phần còn lại",
        },
        "user-1",
        "tenant-1",
        "promise-command-1",
      )).resolves.toMatchObject({ id: "promise-1", amount: 300 });

      expect(prisma.tx.invoice.update).not.toHaveBeenCalled();
      expect(prisma.tx.paymentPromise.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ invoiceId: "invoice-1" }),
        data: expect.objectContaining({ status: "CANCELLED" }),
      });
      expect(prisma.tx.paymentPromise.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          invoiceId: "invoice-1",
          amount: 300,
          idempotencyKey: "promise-command-1",
          createdBy: "user-1",
        }),
      });
    });

    it("rejects an appointment larger than the current remaining balance", async () => {
      prisma.tx.invoice.findFirst.mockResolvedValue({
        id: "invoice-1",
        total: 1000,
        paidAmount: 900,
        creditAmount: 0,
        status: InvoiceStatus.PARTIALLY_PAID,
      });

      await expect(service.createPaymentPromise(
        "invoice-1",
        { amount: 101, dueDate: "2026-10-01T00:00:00.000Z" },
        "user-1",
        "tenant-1",
        "promise-command-2",
      )).rejects.toThrow("PAYMENT_PROMISE_AMOUNT_EXCEEDS_REMAINING");
      expect(prisma.tx.paymentPromise.create).not.toHaveBeenCalled();
    });
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

    it("uses keyset pagination without the legacy count/offset path", async () => {
      repository.paginateCursor.mockResolvedValue({ data: [], hasNextPage: false });

      const result = await service.listInvoices(
        1,
        50,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        "createdAt",
        "desc",
        "tenant-1",
        undefined,
        "cursor",
      );

      expect(repository.paginateCursor).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-1" }),
        50,
        undefined,
        expect.any(Object),
      );
      expect(repository.paginate).not.toHaveBeenCalled();
      expect(result).toMatchObject({ meta: { limit: 50, hasNextPage: false, nextCursor: null } });
    });

    it("applies the createdAt/id tie-breaker and rejects a cursor from another tenant", async () => {
      repository.paginateCursor.mockResolvedValue({ data: [], hasNextPage: false });
      const cursor = Buffer.from(JSON.stringify({
        v: 1,
        tenantId: "tenant-1",
        createdAt: "2026-09-30T10:00:00.000Z",
        id: "invoice-100",
      })).toString("base64url");

      await service.listInvoices(1, 20, undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, undefined, undefined, "tenant-1", cursor);
      expect(repository.paginateCursor).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-1" }),
        20,
        expect.objectContaining({ createdAt: expect.any(Date), id: "invoice-100" }),
        expect.any(Object),
      );

      const foreignCursor = Buffer.from(JSON.stringify({
        v: 1,
        tenantId: "tenant-2",
        createdAt: "2026-09-30T10:00:00.000Z",
        id: "invoice-100",
      })).toString("base64url");
      await expect(
        service.listInvoices(1, 20, undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, undefined, undefined, "tenant-1", foreignCursor),
      ).rejects.toThrow("INVALID_INVOICE_CURSOR");
      await expect(
        service.listInvoices(1, 20, undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, undefined, undefined, "tenant-1", ""),
      ).rejects.toThrow("INVALID_INVOICE_CURSOR");
      expect(repository.paginateCursor).toHaveBeenCalledTimes(1);
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
      prisma.tx.invoice.create.mockResolvedValue({ id: "invoice-1" });
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
      expect(prisma.tx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({
          tenantId: "tenant-1",
          customerId: "customer-1",
          contractId: "contract-1",
          rentalCycleId: "cycle-1",
          status: InvoiceStatus.DRAFT,
        }) }),
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
      expect(prisma.tx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rentalCycleId: "cycle-1" }) }),
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

    it("rejects a generic immediate-entry invoice before scope reads or writes", async () => {
      await expect(
        service.create({
          ...data(),
          period: "Kỳ đầu vào ở",
          billingKind: null,
          baseInvoiceKey: null,
        } as any, "user-1", "Invoices", scope),
      ).rejects.toThrow("IMMEDIATE_ENTRY_BILLING_POLICY_REQUIRED");
      expect(prisma.tx.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.tx.invoice.create).not.toHaveBeenCalled();
    });

    it("does not allow a caller-supplied key to bypass immediate-entry policy selection", async () => {
      await expect(
        service.create({
          ...data(),
          period: "Kỳ đầu vào ở",
          billingKind: null,
          baseInvoiceKey: "caller-supplied-entry-key",
        } as any, "user-1", "Invoices", scope),
      ).rejects.toThrow("IMMEDIATE_ENTRY_BILLING_POLICY_REQUIRED");

      expect(prisma.tx.invoice.create).not.toHaveBeenCalled();
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

    const combinedInvoice = (status: InvoiceStatus = InvoiceStatus.ISSUED, paidAmount = 0) => ({
      id: "entry-combined-1",
      status,
      billingKind: "ENTRY",
      total: 11_000_000,
      paidAmount,
      creditAmount: 0,
      tenantId: "tenant-1",
      customerId: "customer-1",
      contractId: "rental-1",
      rentalCycleId: "cycle-1",
      customer: {},
      contract: {
        id: "rental-1",
        tenantId: "tenant-1",
        customerId: "customer-1",
        rentalCycleId: "cycle-1",
        termsSnapshot: {
          convertedFromBookingHold: {
            bookingDepositConversion: {
              sourceDepositId: "booking-1", securityDepositId: "security-1",
              securityRequired: 8_000_000, transferAmount: 1_000_000, additionalCashRequired: 7_000_000,
            },
            initialEntryInvoice: {
              invoiceId: "entry-combined-1", paymentPolicyVersion: "BOOKING_ENTRY_COMBINED_V1",
              rentAmount: 4_000_000, securityRequired: 8_000_000, transferredAmount: 1_000_000,
              additionalCashRequired: 7_000_000, amount: 11_000_000,
              sourceDepositId: "booking-1", securityDepositId: "security-1",
            },
          },
        },
      },
      items: [
        { type: "RENT", amount: 4_000_000 },
        { type: "OTHER", amount: 8_000_000, servicePeriod: "ENTRY_SECURITY:security-1" },
        { type: "DISCOUNT", amount: -1_000_000, servicePeriod: "ENTRY_BOOKING_TRANSFER:booking-1" },
      ],
    });

    it("collects only the 7M cash remainder after a full 11M combined ENTRY payment", async () => {
      const invoice = combinedInvoice();
      expect((service as any).getScopedInvoiceDetail).toBeDefined();
      expect(() => assertCombinedEntryInvoice(invoice, invoice.contract, getCombinedEntryInvoice(invoice.contract)!)).not.toThrow();
      mockPaymentTarget(invoice);
      const collectInTransaction = vi.fn().mockResolvedValue({ depositId: "security-1", collectedAmount: 7_000_000 });
      (service as any).depositCoreService = { collectInTransaction };
      prisma.tx.payment.create.mockResolvedValue({ id: "pay-combined-1", paidAt: new Date("2026-09-29") });

      await expect(service.pay(invoice.id, 11_000_000, "SEPAY", "txn-combined-1", "user-1", "tenant-1"))
        .resolves.toMatchObject({ status: InvoiceStatus.PAID, paidAmount: 11_000_000 });
      expect(collectInTransaction).toHaveBeenCalledWith(
        prisma.tx, "tenant-1", "security-1", expect.objectContaining({
          idempotencyKey: "entry-invoice:entry-combined-1:security-funding",
          notificationContext: expect.objectContaining({ linkedInvoicePayment: true, sourceInvoiceId: invoice.id }),
        }), "user-1",
      );
    });

    it("funds the full security deposit from one immediate-entry payment", async () => {
      const invoice = {
        ...combinedInvoice(),
        id: "entry-immediate-combined",
        contractId: "rental-immediate",
        total: 8_266_667,
        contract: {
          id: "rental-immediate",
          tenantId: "tenant-1",
          customerId: "customer-1",
          rentalCycleId: "cycle-1",
          termsSnapshot: {
            initialEntryInvoice: {
              invoiceId: "entry-immediate-combined",
              paymentPolicyVersion: "BOOKING_ENTRY_COMBINED_V1",
              rentAmount: 266_667,
              securityRequired: 8_000_000,
              transferredAmount: 0,
              additionalCashRequired: 8_000_000,
              amount: 8_266_667,
              sourceDepositId: null,
              securityDepositId: "security-immediate",
            },
          },
        },
        items: [
          { type: "RENT", amount: 266_667 },
          { type: "OTHER", amount: 8_000_000, servicePeriod: "ENTRY_SECURITY:security-immediate" },
        ],
      };
      mockPaymentTarget(invoice);
      const collectInTransaction = vi.fn().mockResolvedValue({
        depositId: "security-immediate",
        collectedAmount: 8_000_000,
      });
      (service as any).depositCoreService = { collectInTransaction };
      prisma.tx.payment.create.mockResolvedValue({ id: "pay-immediate-combined", paidAt: new Date("2026-09-29") });

      await expect(service.pay(
        invoice.id,
        8_266_667,
        "MANUAL",
        "cash-immediate-combined",
        "user-1",
        "tenant-1",
      )).resolves.toMatchObject({ status: InvoiceStatus.PAID, paidAmount: 8_266_667 });
      expect(collectInTransaction).toHaveBeenCalledWith(
        prisma.tx,
        "tenant-1",
        "security-immediate",
        expect.objectContaining({ idempotencyKey: "entry-invoice:entry-immediate-combined:security-funding" }),
        "user-1",
      );
    });

    it("does not collect security cash until the combined ENTRY invoice is fully paid", async () => {
      const invoice = combinedInvoice();
      mockPaymentTarget(invoice);
      const collectInTransaction = vi.fn();
      (service as any).depositCoreService = { collectInTransaction };
      prisma.tx.payment.create.mockResolvedValue({ id: "pay-combined-partial-1", paidAt: new Date("2026-09-29") });

      await expect(service.pay(invoice.id, 4_000_000, "MANUAL", "manual-combined-partial-1", "user-1", "tenant-1"))
        .resolves.toMatchObject({ status: InvoiceStatus.PARTIALLY_PAID, paidAmount: 4_000_000 });
      expect(collectInTransaction).not.toHaveBeenCalled();
    });

    it("propagates security collection failure so the caller transaction can roll back", async () => {
      const invoice = combinedInvoice();
      mockPaymentTarget(invoice);
      const collectInTransaction = vi.fn().mockRejectedValue(new ConflictException("COMBINED_ENTRY_DEPOSIT_FUNDING_CONFLICT"));
      (service as any).depositCoreService = { collectInTransaction };
      prisma.tx.payment.create.mockResolvedValue({ id: "pay-combined-fail-1", paidAt: new Date("2026-09-29") });

      await expect(service.pay(invoice.id, 11_000_000, "MANUAL", "manual-combined-fail-1", "user-1", "tenant-1"))
        .rejects.toThrow("COMBINED_ENTRY_DEPOSIT_FUNDING_CONFLICT");
      expect(collectInTransaction).toHaveBeenCalledWith(prisma.tx, "tenant-1", "security-1", expect.any(Object), "user-1");
    });

    it("replays a confirmed combined ENTRY reference without recollecting security cash", async () => {
      const invoice = combinedInvoice(InvoiceStatus.PAID, 11_000_000);
      prisma.tx.payment.findFirst.mockResolvedValue({
        invoiceId: invoice.id,
        amount: 11_000_000,
        status: "CONFIRMED",
      });
      prisma.tx.invoice.findFirst.mockResolvedValue(invoice);
      const collectInTransaction = vi.fn();
      (service as any).depositCoreService = { collectInTransaction };

      await expect(service.pay(invoice.id, 11_000_000, "SEPAY", "txn-combined-replay-1", "user-1", "tenant-1"))
        .resolves.toMatchObject({ id: invoice.id, status: InvoiceStatus.PAID });

      expect(collectInTransaction).not.toHaveBeenCalled();
      expect(prisma.tx.payment.create).not.toHaveBeenCalled();
      expect(prisma.tx.paymentAllocation.create).not.toHaveBeenCalled();
    });

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
      // Payment events are only delivered by the ordered durable outbox. This
      // prevents a bank confirmation from arriving before invoice.issued.
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
