import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { BaseCrudService } from "../shared/services/base-crud.service";
import { Invoice, InvoiceStatus, Prisma } from "@prisma/client";
import { InvoicesRepository } from "./invoices.repository";
import { AuditService } from "../shared/audit/audit.service";
import {
  CreateInvoiceAdjustmentInput,
  PaginatedResult,
} from "@homeland/shared";
import { DomainEventPublisher } from "../shared/events/domain-event.publisher";
import { PrismaService } from "../prisma.service";
import { buildRoomContext } from "../shared/context/room-context";
import { createHash } from "node:crypto";

type InvoiceTransactionClient = Prisma.TransactionClient;

type InvoiceCreateScope = {
  tenantId: string;
  roomId: string;
  rentalCycleId?: string;
};

const BASE_BILLING_KINDS = new Set(["ENTRY", "MONTHLY_BASE"]);
const ADJUSTMENT_BILLING_KINDS = new Set([
  "DEBIT_ADJUSTMENT",
  "CREDIT_ADJUSTMENT",
]);

@Injectable()
export class InvoicesService extends BaseCrudService<Invoice> {
  constructor(
    repository: InvoicesRepository,
    auditService: AuditService,
    _eventPublisher: DomainEventPublisher,
    private readonly prisma: PrismaService,
  ) {
    super(repository, auditService, "Invoice");
  }

  async listInvoices(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    roomId?: string,
    customerId?: string,
    contractId?: string,
    rentalCycleId?: string,
    period?: string,
    overdue?: boolean,
    sort?: string,
    order?: string,
    tenantId?: string,
  ): Promise<PaginatedResult<Invoice>> {
    const where: any = {
      AND: [
        {
          OR: [{ total: { gt: 0 } }, { status: InvoiceStatus.DRAFT }],
        },
      ],
    };
    // Room/customer/cycle filters are not a tenancy boundary.
    if (tenantId) where.tenantId = tenantId;
    if (search) {
      where.AND.push({
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { customer: { fullName: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    if (status) where.status = status;
    if (roomId) where.contract = { is: { roomId } };
    if (customerId) where.customerId = customerId;
    if (contractId) where.contractId = contractId;
    if (rentalCycleId) where.rentalCycleId = rentalCycleId;
    if (period) where.period = period;

    if (overdue) {
      where.dueDate = { lt: new Date() };
      where.status = {
        notIn: [
          InvoiceStatus.PAID,
          InvoiceStatus.CANCELLED,
          InvoiceStatus.WRITTEN_OFF,
        ],
      };
    }

    const orderBy = { [sort || "createdAt"]: order || "desc" };

    return this.repository.paginate(where, page, limit, orderBy, {
      customer: {
        select: { id: true, fullName: true, phone: true, gender: true },
      },
      contract: {
        select: {
          id: true,
          code: true,
          room: {
            select: {
              id: true,
              code: true,
              building: { select: { id: true, name: true } },
            },
          },
        },
      },
    });
  }

  async getDetail(id: string, include?: any) {
    return this.prisma.tx.invoice.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        contract: {
          include: { room: { include: { building: true, floor: true } } },
        },
        items: true,
        allocations: {
          include: { payment: true },
        },
      },
    });
  }

  async getDetailWithFamily(id: string, tenantId: string) {
    const invoice = await this.prisma.tx.invoice.findFirstOrThrow({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        contract: {
          include: { room: { include: { building: true, floor: true } } },
        },
        items: true,
        allocations: {
          include: { payment: true },
        },
      },
    });
    const rootInvoiceId = invoice.adjustmentOfInvoiceId || invoice.id;
    const familyTotals = await this.getFamilyTotals(
      this.prisma.tx,
      tenantId,
      rootInvoiceId,
    );
    return { ...invoice, familyTotals };
  }

  async createAdjustment(
    tenantId: string,
    baseInvoiceId: string,
    idempotencyKeyInput: string,
    input: CreateInvoiceAdjustmentInput,
    userId: string,
  ) {
    tenantId = this.requireTenantId(tenantId);
    const idempotencyKey = this.requireIdempotencyKey(idempotencyKeyInput);
    const normalizedInput = {
      baseInvoiceId,
      type: input.type,
      reason: input.reason.trim(),
      items: input.items.map((item) => ({
        type: item.type,
        description: item.description.trim(),
        quantity: this.toMoney(item.quantity),
        unitPrice: this.toMoney(item.unitPrice ?? item.amount / item.quantity),
        amount: this.toMoney(item.amount),
      })),
    };
    const requestHash = this.hash(normalizedInput);

    try {
      return await this.runSerializable(async (tx) => {
        await this.lockAdjustmentCommand(tx, tenantId, idempotencyKey);

        const existing = await tx.invoice.findFirst({
          where: {
            tenantId,
            adjustmentIdempotencyKey: idempotencyKey,
            deletedAt: null,
          },
          include: { items: true },
        });
        if (existing) {
          return this.adjustmentReplay(tx, tenantId, existing, requestHash);
        }

        await this.lockInvoice(tx, tenantId, baseInvoiceId);
        const base = await tx.invoice.findFirst({
          where: { id: baseInvoiceId, tenantId, deletedAt: null },
        });
        if (!base) {
          throw new NotFoundException("INVOICE_ADJUSTMENT_BASE_NOT_FOUND");
        }
        if (
          base.adjustmentOfInvoiceId ||
          ADJUSTMENT_BILLING_KINDS.has(base.billingKind || "")
        ) {
          throw new BadRequestException(
            "INVOICE_ADJUSTMENT_REQUIRES_ROOT_BASE",
          );
        }
        if (!BASE_BILLING_KINDS.has(base.billingKind || "")) {
          throw new BadRequestException("INVOICE_ADJUSTMENT_BASE_KIND_INVALID");
        }
        if (
          !(
            [
              InvoiceStatus.ISSUED,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.PAID,
              InvoiceStatus.OVERDUE,
            ] as string[]
          ).includes(base.status)
        ) {
          throw new ConflictException("INVOICE_ADJUSTMENT_BASE_STATUS_INVALID");
        }

        const total = this.sumMoney(
          normalizedInput.items.map((item) => item.amount),
        );
        if (total <= 0) {
          throw new BadRequestException("INVOICE_ADJUSTMENT_MAGNITUDE_INVALID");
        }

        const billingKind =
          input.type === "DEBIT" ? "DEBIT_ADJUSTMENT" : "CREDIT_ADJUSTMENT";
        if (billingKind === "CREDIT_ADJUSTMENT") {
          const financialState = await this.getFamilyFinancialState(
            tx,
            tenantId,
            base.id,
          );
          const grossAfterCredit = this.toMoney(
            financialState.grossTotal - total,
          );
          if (
            grossAfterCredit < 0 ||
            financialState.allocatedCash > grossAfterCredit
          ) {
            throw new ConflictException("INVOICE_CREDIT_REQUIRES_CREDIT_NOTE");
          }
        }
        const codeHash = createHash("sha256")
          .update(`${tenantId}:${idempotencyKey}`)
          .digest("hex")
          .slice(0, 12)
          .toUpperCase();
        const adjustment = await tx.invoice.create({
          data: {
            tenantId,
            contractId: base.contractId,
            rentalCycleId: base.rentalCycleId,
            customerId: base.customerId,
            code: `ADJ-${codeHash}`,
            period: base.period,
            usagePeriod: base.usagePeriod,
            status: InvoiceStatus.DRAFT,
            dueDate: base.dueDate,
            subtotal: total,
            discount: 0,
            total,
            paidAmount: 0,
            creditAmount: 0,
            billingKind,
            baseInvoiceKey: null,
            adjustmentOfInvoiceId: base.id,
            adjustmentReason: normalizedInput.reason,
            adjustmentCreatedBy: userId,
            adjustmentRequestHash: requestHash,
            adjustmentIdempotencyKey: idempotencyKey,
            items: {
              create: normalizedInput.items.map((item) => ({
                tenantId,
                type: item.type,
                description: item.description,
                servicePeriod: this.adjustmentServicePeriod(
                  item.type,
                  base.period,
                  base.usagePeriod,
                ),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.amount,
              })),
            },
          },
          include: { items: true },
        });

        const issued = await tx.invoice.update({
          where: { id: adjustment.id, tenantId, status: InvoiceStatus.DRAFT },
          data: { status: InvoiceStatus.ISSUED },
          include: { items: true },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            module: "InvoicesCore",
            entity: "InvoiceAdjustment",
            entityId: issued.id,
            action: "CREATE",
            after: {
              baseInvoiceId: base.id,
              adjustmentInvoiceId: issued.id,
              billingKind,
              total,
              reason: normalizedInput.reason,
              requestHash,
              idempotencyKey,
            },
          },
        });
        await tx.outboxEvent.create({
          data: {
            tenantId,
            aggregateType: "Invoice",
            aggregateId: issued.id,
            eventName: "invoice.adjustment.created",
            payload: {
              tenantId,
              baseInvoiceId: base.id,
              adjustmentInvoiceId: issued.id,
              billingKind,
              total,
              reason: normalizedInput.reason,
              createdBy: userId,
            },
            idempotencyKey: `invoice-adjustment:${issued.id}:created`,
          },
        });

        const familyTotals = await this.getFamilyTotals(tx, tenantId, base.id);
        return {
          adjustment: issued,
          familyTotals,
          replayed: false,
          accountingStatus: "PENDING_FINANCE_MAPPING",
        };
      });
    } catch (error: any) {
      if (error?.code === "P2002") {
        const existing = await this.prisma.tx.invoice.findFirst({
          where: {
            tenantId,
            adjustmentIdempotencyKey: idempotencyKey,
            deletedAt: null,
          },
          include: { items: true },
        });
        if (existing) {
          return this.adjustmentReplay(
            this.prisma.tx,
            tenantId,
            existing,
            requestHash,
          );
        }
        throw new ConflictException("INVOICE_ADJUSTMENT_DUPLICATE");
      }
      throw error;
    }
  }

  async create(
    data: Prisma.InvoiceCreateInput,
    userId?: string,
    moduleName?: string,
    scope?: InvoiceCreateScope,
  ) {
    const tenantId = this.requireTenantId(scope?.tenantId);
    const roomId = String(scope?.roomId || "").trim();
    const contractId = String((data as any).contractId || "").trim();
    const customerId = String((data as any).customerId || "").trim();
    if (!roomId || !contractId || !customerId) {
      throw new BadRequestException("INVOICE_CREATE_SCOPE_REQUIRED");
    }

    const [contract, customer, room] = await Promise.all([
      this.prisma.tx.contract.findFirst({
        where: {
          id: contractId,
          tenantId,
          customerId,
          roomId,
          deletedAt: null,
        },
        select: { rentalCycleId: true },
      }),
      this.prisma.tx.customer.findFirst({
        where: { id: customerId, tenantId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.tx.room.findFirst({
        where: { id: roomId, tenantId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!contract || !customer || !room) {
      throw new BadRequestException("INVOICE_CREATE_SCOPE_MISMATCH");
    }

    const expectedRentalCycleId = String(scope?.rentalCycleId || "").trim();
    const rentalCycleId = expectedRentalCycleId || contract.rentalCycleId;
    if (!rentalCycleId) {
      throw new ConflictException("INVOICE_CONTRACT_RENTAL_CYCLE_MISSING");
    }
    if (
      expectedRentalCycleId &&
      expectedRentalCycleId !== contract.rentalCycleId
    ) {
      throw new BadRequestException("INVOICE_RENTAL_CYCLE_SCOPE_MISMATCH");
    }

    const rentalCycle = await this.prisma.tx.rentalCycle.findFirst({
      where: { id: rentalCycleId, tenantId, customerId, roomId },
      select: { id: true },
    });
    if (!rentalCycle) {
      throw new BadRequestException("INVOICE_RENTAL_CYCLE_SCOPE_MISMATCH");
    }

    return super.create(
      {
        ...data,
        tenantId,
        rentalCycleId: rentalCycle.id,
        status: InvoiceStatus.DRAFT,
      } as any,
      userId,
      moduleName,
    );
  }

  async update(id: string, data: any, userId?: string, moduleName?: string) {
    const invoice = await this.getDetail(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        "Can only update DRAFT invoices. Use explicit commands (issue, pay, cancel, writeoff) for state transitions.",
      );
    }
    return super.update(id, data, userId, moduleName);
  }

  async issue(id: string, userId: string, tenantIdInput?: string) {
    const tenantId = this.requireTenantId(tenantIdInput);
    const updated = await this.runSerializable(async (tx) => {
      await this.lockInvoice(tx, tenantId, id, "INVOICE_NOT_FOUND");
      const invoice = await this.getScopedInvoiceDetail(tx, id, tenantId);
      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot issue invoice in ${invoice.status} status.`,
        );
      }
      if (ADJUSTMENT_BILLING_KINDS.has(invoice.billingKind || "")) {
        throw new ConflictException("INVOICE_ADJUSTMENT_COMMAND_REQUIRED");
      }

      const subtotalFromItems =
        invoice.items && invoice.items.length > 0
          ? invoice.items.reduce(
              (sum: number, item: any) => sum + Number(item.amount),
              0,
            )
          : Number(invoice.subtotal) || Number(invoice.total) || 0;
      const discount = Number(invoice.discount) || 0;
      const total =
        subtotalFromItems > 0
          ? subtotalFromItems - discount
          : Number(invoice.total) || 0;
      if (total <= 0) {
        throw new BadRequestException(
          "Invoice total must be strictly positive to be issued.",
        );
      }

      const claimed = await tx.invoice.updateMany({
        where: {
          id,
          tenantId,
          deletedAt: null,
          status: InvoiceStatus.DRAFT,
        },
        data: {
          status: InvoiceStatus.ISSUED,
          subtotal: subtotalFromItems > 0 ? subtotalFromItems : total,
          total,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("INVOICE_ISSUE_CONCURRENT_UPDATE");
      }
      const updated = await tx.invoice.findFirstOrThrow({
        where: { id, tenantId, deletedAt: null },
      });
      await this.writeLifecycleEvidence(tx, {
        tenantId,
        userId,
        invoiceId: id,
        action: "ISSUE",
        beforeStatus: invoice.status,
        afterStatus: updated.status,
        payload: { total },
        eventName: "invoice.issued",
        eventPayload: this.invoiceIssuedEventPayload(
          invoice,
          tenantId,
          userId,
          total,
        ),
      });
      return updated;
    }, "INVOICE_ISSUE_CONCURRENT_UPDATE");

    return updated;
  }

  async markOverdueInvoices(tenantIdInput: string, userId: string) {
    const tenantId = this.requireTenantId(tenantIdInput);
    const now = new Date();
    return this.runSerializable(async (tx) => {
      const candidates = await tx.invoice.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
          total: { gt: 0 },
          dueDate: { lt: now },
          OR: [
            { billingKind: null },
            { billingKind: { not: "CREDIT_ADJUSTMENT" } },
          ],
        },
        orderBy: { id: "asc" },
      });
      let updatedCount = 0;
      for (const invoice of candidates) {
        await this.lockInvoice(tx, tenantId, invoice.id, "INVOICE_NOT_FOUND");
        const claimed = await tx.invoice.updateMany({
          where: {
            id: invoice.id,
            tenantId,
            deletedAt: null,
            status: invoice.status,
          },
          data: { status: InvoiceStatus.OVERDUE },
        });
        if (claimed.count !== 1) continue;
        await this.writeLifecycleEvidence(tx, {
          tenantId,
          userId,
          invoiceId: invoice.id,
          action: "OVERDUE",
          beforeStatus: invoice.status,
          afterStatus: InvoiceStatus.OVERDUE,
          payload: { dueDate: invoice.dueDate.toISOString() },
          eventName: "invoice.overdue",
          eventPayload: {
            tenantId,
            userId,
            sourceId: invoice.id,
            sourceType: "INVOICE",
            amount: Number(invoice.total),
            occurredAt: now.toISOString(),
            metadata: {
              code: invoice.code,
              dueDate: invoice.dueDate.toISOString(),
            },
          },
        });
        updatedCount += 1;
      }
      return { updated: updatedCount, checkedAt: now };
    }, "INVOICE_OVERDUE_CONCURRENT_UPDATE");
  }

  async pay(
    id: string,
    amount: number,
    provider: string,
    providerRef: string,
    userId: string,
    tenantIdInput?: string,
  ) {
    const tenantId = this.requireTenantId(tenantIdInput);
    const normalizedProvider = String(provider || "MANUAL").trim().toUpperCase();
    const normalizedProviderRef = String(providerRef || "").trim();
    if (!normalizedProviderRef) {
      throw new BadRequestException("PAYMENT_PROVIDER_REFERENCE_REQUIRED");
    }
    const operation = await this.runSerializable(async (tx) => {
      await this.lockPaymentReference(
        tx,
        tenantId,
        normalizedProvider,
        normalizedProviderRef,
      );
      const existingPayment = await tx.payment.findFirst({
        where: {
          tenantId,
          provider: normalizedProvider,
          providerRef: normalizedProviderRef,
          deletedAt: null,
        },
        select: { invoiceId: true, amount: true, status: true },
      });
      if (existingPayment) {
        if (
          existingPayment.invoiceId !== id ||
          this.toMoney(existingPayment.amount) !== this.toMoney(amount) ||
          existingPayment.status !== "CONFIRMED"
        ) {
          throw new ConflictException("PAYMENT_PROVIDER_REFERENCE_CONFLICT");
        }
        return { result: await this.getScopedInvoiceDetail(tx, id, tenantId) };
      }
      const target = await tx.invoice.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: { id: true, adjustmentOfInvoiceId: true },
      });
      if (!target) throw new NotFoundException("INVOICE_NOT_FOUND");
      const rootInvoiceId = target.adjustmentOfInvoiceId || target.id;
      await this.lockInvoice(tx, tenantId, rootInvoiceId, "INVOICE_NOT_FOUND");
      if (id !== rootInvoiceId) {
        await this.lockInvoice(tx, tenantId, id, "INVOICE_NOT_FOUND");
      }
      const invoice = await this.getScopedInvoiceDetail(tx, id, tenantId);
      if (invoice.billingKind === "CREDIT_ADJUSTMENT") {
        throw new ConflictException(
          "CREDIT_ADJUSTMENT_PAYMENT_ALLOCATION_FORBIDDEN",
        );
      }
      if (
        !(
          [
            InvoiceStatus.ISSUED,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE,
          ] as string[]
        ).includes(invoice.status)
      ) {
        throw new BadRequestException(
          `Cannot receive payment for invoice in ${invoice.status} status.`,
        );
      }

      const creditAmount = Math.max(0, Number(invoice.creditAmount || 0));
      const remaining = Math.max(
        0,
        Number(invoice.total) - Number(invoice.paidAmount) - creditAmount,
      );
      if (amount <= 0 || amount > remaining) {
        throw new BadRequestException(
          `Payment amount must be strictly positive and cannot exceed the remaining balance of ${remaining}.`,
        );
      }
      const financialState = await this.getFamilyFinancialState(
        tx,
        tenantId,
        rootInvoiceId,
      );
      if (
        this.toMoney(financialState.allocatedCash + amount) >
        financialState.grossTotal
      ) {
        throw new ConflictException("INVOICE_PAYMENT_EXCEEDS_FAMILY_GROSS");
      }

      const newPaidAmount = this.toMoney(Number(invoice.paidAmount) + amount);
      const newStatus =
        newPaidAmount + creditAmount >= Number(invoice.total)
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;
      const claimed = await tx.invoice.updateMany({
        where: {
          id,
          tenantId,
          deletedAt: null,
          paidAmount: invoice.paidAmount,
          creditAmount: invoice.creditAmount,
          status: invoice.status,
        },
        data: { paidAmount: newPaidAmount, status: newStatus },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("INVOICE_PAYMENT_CONCURRENT_UPDATE");
      }
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          rentalCycleId: invoice.rentalCycleId,
          amount,
          provider: normalizedProvider,
          providerRef: normalizedProviderRef,
          status: "CONFIRMED",
          paidAt: new Date(),
        },
      });
      await tx.paymentAllocation.create({
        data: {
          tenantId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount,
        },
      });
      const result = {
        ...invoice,
        paidAmount: newPaidAmount,
        status: newStatus,
      };
      await this.writeLifecycleEvidence(tx, {
        tenantId,
        userId,
        invoiceId: id,
        action: "PAY",
        beforeStatus: invoice.status,
        afterStatus: newStatus,
        payload: {
          amount,
          paymentId: payment.id,
          provider: normalizedProvider,
          providerRef: normalizedProviderRef,
        },
        eventName:
          newStatus === InvoiceStatus.PAID
            ? "invoice.paid"
            : "invoice.payment.recorded",
        eventPayload: this.invoicePaymentEventPayload(
          invoice,
          tenantId,
          userId,
          result,
          newStatus,
          creditAmount,
          newPaidAmount,
          normalizedProvider,
          normalizedProviderRef,
        ),
      });
      return { result };
    }, "INVOICE_PAYMENT_CONCURRENT_UPDATE");
    return operation.result;
  }

  async cancel(id: string, userId: string, tenantIdInput?: string) {
    const tenantId = this.requireTenantId(tenantIdInput);
    return this.transitionInvoiceStatus(
      id,
      tenantId,
      userId,
      "CANCEL",
      [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED],
      InvoiceStatus.CANCELLED,
    );
  }

  async writeoff(id: string, userId: string, tenantIdInput?: string) {
    const tenantId = this.requireTenantId(tenantIdInput);
    return this.transitionInvoiceStatus(
      id,
      tenantId,
      userId,
      "WRITEOFF",
      [
        InvoiceStatus.ISSUED,
        InvoiceStatus.PARTIALLY_PAID,
        InvoiceStatus.OVERDUE,
      ],
      InvoiceStatus.WRITTEN_OFF,
    );
  }

  async softDelete(
    id: string,
    userId?: string,
    moduleName?: string,
    tenantIdInput?: string,
  ): Promise<Invoice> {
    const tenantId = this.requireTenantId(tenantIdInput);
    return this.runSerializable(async (tx) => {
      await this.lockInvoice(tx, tenantId, id, "INVOICE_NOT_FOUND");
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          payments: { select: { id: true } },
          allocations: { select: { id: true } },
          creditNotes: { select: { id: true } },
          adjustments: { select: { id: true } },
          items: { select: { billingSnapshotId: true } },
        },
      });
      if (!invoice) throw new NotFoundException("INVOICE_NOT_FOUND");
      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new ConflictException("INVOICE_DELETE_REQUIRES_DRAFT");
      }
      const hasSourceDocument =
        Boolean(invoice.billingKind) ||
        Boolean(invoice.baseInvoiceKey) ||
        Boolean(invoice.adjustmentOfInvoiceId) ||
        invoice.payments.length > 0 ||
        invoice.allocations.length > 0 ||
        invoice.creditNotes.length > 0 ||
        invoice.adjustments.length > 0 ||
        invoice.items.some((item: any) => Boolean(item.billingSnapshotId));
      if (hasSourceDocument) {
        throw new ConflictException("INVOICE_DELETE_SOURCE_DOCUMENT_EXISTS");
      }
      const deleted = await tx.invoice.update({
        where: { id, tenantId, status: InvoiceStatus.DRAFT },
        data: { deletedAt: new Date(), deletedBy: userId },
      });
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "Invoice",
          entityId: id,
          module: moduleName || "Invoices",
          tenantId,
          userId,
          before: this.invoiceAuditSnapshot(invoice),
        },
      });
      return deleted;
    }, "INVOICE_DELETE_CONCURRENT_UPDATE");
  }

  private async adjustmentReplay(
    tx: any,
    tenantId: string,
    existing: any,
    requestHash: string,
  ) {
    if (existing.adjustmentRequestHash !== requestHash) {
      throw new ConflictException(
        "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST",
      );
    }
    const rootInvoiceId = existing.adjustmentOfInvoiceId;
    if (!rootInvoiceId) {
      throw new ConflictException("INVOICE_ADJUSTMENT_REPLAY_CORRUPTED");
    }
    const familyTotals = await this.getFamilyTotals(
      tx,
      tenantId,
      rootInvoiceId,
    );
    return {
      adjustment: existing,
      familyTotals,
      replayed: true,
      accountingStatus: "PENDING_FINANCE_MAPPING",
    };
  }

  private async transitionInvoiceStatus(
    id: string,
    tenantId: string,
    userId: string,
    action: "CANCEL" | "WRITEOFF",
    allowedStatuses: InvoiceStatus[],
    nextStatus: InvoiceStatus,
  ) {
    return this.runSerializable(async (tx) => {
      await this.lockInvoice(tx, tenantId, id, "INVOICE_NOT_FOUND");
      const invoice = await this.getScopedInvoiceDetail(tx, id, tenantId);
      if (
        invoice.status !== InvoiceStatus.DRAFT &&
        (BASE_BILLING_KINDS.has(invoice.billingKind || "") ||
          ADJUSTMENT_BILLING_KINDS.has(invoice.billingKind || ""))
      ) {
        throw new ConflictException("INVOICE_APPEND_ONLY_REQUIRES_ADJUSTMENT");
      }
      if (!(allowedStatuses as string[]).includes(invoice.status)) {
        throw new BadRequestException(
          `Cannot ${action.toLowerCase()} invoice in ${invoice.status} status.`,
        );
      }
      const claimed = await tx.invoice.updateMany({
        where: {
          id,
          tenantId,
          deletedAt: null,
          status: invoice.status,
        },
        data: { status: nextStatus },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("INVOICE_LIFECYCLE_CONCURRENT_UPDATE");
      }
      const updated = await tx.invoice.findFirstOrThrow({
        where: { id, tenantId, deletedAt: null },
      });
      await this.writeLifecycleEvidence(tx, {
        tenantId,
        userId,
        invoiceId: id,
        action,
        beforeStatus: invoice.status,
        afterStatus: updated.status,
        payload: {},
      });
      return updated;
    }, "INVOICE_LIFECYCLE_CONCURRENT_UPDATE");
  }

  private async getScopedInvoiceDetail(
    tx: InvoiceTransactionClient,
    id: string,
    tenantId: string,
  ) {
    const invoice = await tx.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        contract: {
          include: { room: { include: { building: true, floor: true } } },
        },
        items: true,
        allocations: { include: { payment: true } },
      },
    });
    if (!invoice) throw new NotFoundException("INVOICE_NOT_FOUND");
    return invoice;
  }

  private async writeLifecycleEvidence(
    tx: InvoiceTransactionClient,
    input: {
      tenantId: string;
      userId: string;
      invoiceId: string;
      action: "ISSUE" | "PAY" | "CANCEL" | "WRITEOFF" | "OVERDUE";
      beforeStatus: string;
      afterStatus: string;
      payload: Record<string, unknown>;
      eventName?: string;
      eventPayload?: Record<string, any>;
    },
  ) {
    const eventNameByAction = {
      ISSUE: "invoice.issued",
      PAY: "invoice.payment.recorded",
      CANCEL: "invoice.cancelled",
      WRITEOFF: "invoice.written_off",
      OVERDUE: "invoice.overdue",
    } as const;
    const evidenceKey =
      typeof input.payload.paymentId === "string"
        ? input.payload.paymentId
        : input.afterStatus;
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        module: "InvoicesCore",
        entity: "Invoice",
        entityId: input.invoiceId,
        action: "UPDATE",
        before: { status: input.beforeStatus },
        after: { status: input.afterStatus, ...input.payload },
      },
    });
    await tx.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregateType: "Invoice",
        aggregateId: input.invoiceId,
        eventName: input.eventName || eventNameByAction[input.action],
        payload: input.eventPayload || {
          tenantId: input.tenantId,
          invoiceId: input.invoiceId,
          userId: input.userId,
          beforeStatus: input.beforeStatus,
          afterStatus: input.afterStatus,
          ...input.payload,
        },
        idempotencyKey: `invoice-lifecycle:${input.invoiceId}:${input.action}:${evidenceKey}`,
      },
    });
  }

  private invoiceIssuedEventPayload(
    invoice: any,
    tenantId: string,
    userId: string,
    total: number,
  ) {
    const roomContext = buildRoomContext(
      invoice.contract?.room,
      invoice.contract,
    );
    return {
      tenantId,
      userId,
      customerId: invoice.customerId,
      customerName: invoice.customer?.fullName,
      customerPhone: invoice.customer?.phone,
      customerZaloChatId: invoice.customer?.zaloChatId,
      customerZaloUserId: invoice.customer?.zaloUserId,
      ...roomContext,
      metadata: {
        code: invoice.code,
        roomCode: invoice.contract?.room?.code,
        buildingName: invoice.contract?.room?.building?.name,
        roomRentalType: invoice.contract?.room?.rentalType || null,
        roomRentalTypeLabel: roomContext.roomRentalTypeLabel,
        roomMemberCount: roomContext.roomMemberCount,
        title: `Phát hành hóa đơn ${invoice.code}`,
        message: `Hóa đơn ${invoice.code} đã được phát hành với số tiền ${total.toLocaleString("vi-VN")} VND.`,
      },
      sourceId: invoice.id,
      sourceType: "INVOICE",
      amount: Number(total),
      occurredAt: new Date().toISOString(),
    };
  }

  private invoicePaymentEventPayload(
    invoice: any,
    tenantId: string,
    userId: string,
    result: any,
    status: InvoiceStatus,
    creditAmount: number,
    newPaidAmount: number,
    provider: string,
    providerRef: string,
  ) {
    const roomContext = buildRoomContext(
      invoice.contract?.room,
      invoice.contract,
    );
    return {
      tenantId,
      userId,
      customerId: invoice.customerId,
      customerName: invoice.customer?.fullName,
      customerPhone: invoice.customer?.phone,
      customerZaloChatId: invoice.customer?.zaloChatId,
      customerZaloUserId: invoice.customer?.zaloUserId,
      ...roomContext,
      metadata: {
        code: invoice.code,
        grossTotal: Number(result.total),
        creditAmount,
        paymentStatus: status,
        roomRentalType: invoice.contract?.room?.rentalType || null,
        roomRentalTypeLabel: roomContext.roomRentalTypeLabel,
        roomMemberCount: roomContext.roomMemberCount,
      },
      sourceId: invoice.id,
      sourceType: "INVOICE",
      amount: Number(result.paidAmount ?? newPaidAmount),
      paymentProvider: provider,
      paymentRef: providerRef,
      occurredAt: new Date().toISOString(),
    };
  }

  private invoiceAuditSnapshot(invoice: any) {
    return {
      id: invoice.id,
      tenantId: invoice.tenantId,
      code: invoice.code,
      status: invoice.status,
      billingKind: invoice.billingKind,
      total: this.toMoney(invoice.total),
      paidAmount: this.toMoney(invoice.paidAmount),
      creditAmount: this.toMoney(invoice.creditAmount),
    };
  }

  private async getFamilyFinancialState(
    tx: InvoiceTransactionClient,
    tenantId: string,
    rootInvoiceId: string,
  ) {
    const family = await tx.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ id: rootInvoiceId }, { adjustmentOfInvoiceId: rootInvoiceId }],
      },
      select: { id: true, billingKind: true, status: true, total: true },
    });
    const root = family.find((candidate) => candidate.id === rootInvoiceId);
    if (!root) throw new NotFoundException("INVOICE_FAMILY_ROOT_NOT_FOUND");
    const economicFamily = family.filter(
      (candidate) =>
        candidate.id === rootInvoiceId ||
        candidate.status !== InvoiceStatus.DRAFT,
    );
    const grossTotal = this.toMoney(
      this.toMoney(root.total) +
        this.sumMoney(
          economicFamily
            .filter((candidate) => candidate.billingKind === "DEBIT_ADJUSTMENT")
            .map((candidate) => candidate.total),
        ) -
        this.sumMoney(
          economicFamily
            .filter(
              (candidate) => candidate.billingKind === "CREDIT_ADJUSTMENT",
            )
            .map((candidate) => candidate.total),
        ),
    );
    const payableInvoiceIds = economicFamily
      .filter(
        (candidate) =>
          candidate.id === rootInvoiceId ||
          candidate.billingKind === "DEBIT_ADJUSTMENT",
      )
      .map((candidate) => candidate.id);
    const allocations = payableInvoiceIds.length
      ? await tx.paymentAllocation.findMany({
          where: {
            tenantId,
            invoiceId: { in: payableInvoiceIds },
            payment: {
              tenantId,
              status: "CONFIRMED",
              deletedAt: null,
            },
          },
          select: { amount: true },
        })
      : [];
    return {
      grossTotal,
      allocatedCash: this.sumMoney(
        allocations.map((allocation) => allocation.amount),
      ),
    };
  }

  private async getFamilyTotals(
    tx: any,
    tenantId: string,
    rootInvoiceId: string,
  ) {
    const family = await tx.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ id: rootInvoiceId }, { adjustmentOfInvoiceId: rootInvoiceId }],
      },
      select: {
        id: true,
        billingKind: true,
        status: true,
        total: true,
      },
    });
    const root = family.find(
      (candidate: any) => candidate.id === rootInvoiceId,
    );
    if (!root) throw new NotFoundException("INVOICE_FAMILY_ROOT_NOT_FOUND");
    const economicFamily = family.filter(
      (candidate: any) =>
        candidate.id === rootInvoiceId ||
        candidate.status !== InvoiceStatus.DRAFT,
    );
    const baseTotal = this.toMoney(root.total);
    const debitAdjustmentTotal = this.sumMoney(
      economicFamily
        .filter(
          (candidate: any) => candidate.billingKind === "DEBIT_ADJUSTMENT",
        )
        .map((candidate: any) => candidate.total),
    );
    const creditAdjustmentTotal = this.sumMoney(
      economicFamily
        .filter(
          (candidate: any) => candidate.billingKind === "CREDIT_ADJUSTMENT",
        )
        .map((candidate: any) => candidate.total),
    );
    return {
      rootInvoiceId,
      baseTotal,
      debitAdjustmentTotal,
      creditAdjustmentTotal,
      adjustedTotal: this.toMoney(
        baseTotal + debitAdjustmentTotal - creditAdjustmentTotal,
      ),
    };
  }

  private adjustmentServicePeriod(
    itemType: string,
    billingPeriod: string | null,
    usagePeriod: string | null,
  ) {
    return itemType === "RENT" ? billingPeriod : usagePeriod || billingPeriod;
  }

  private async runSerializable<T>(
    callback: (tx: InvoiceTransactionClient) => Promise<T>,
    conflictCode = "INVOICE_ADJUSTMENT_CONCURRENT_UPDATE",
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.tx.$transaction(callback, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: any) {
        if (this.isSerializationConflict(error) && attempt < 3) continue;
        if (this.isSerializationConflict(error)) {
          throw new ConflictException(conflictCode);
        }
        throw error;
      }
    }
    throw new ConflictException(conflictCode);
  }

  private isSerializationConflict(error: any) {
    return (
      error?.code === "P2034" ||
      (error?.code === "P2010" && error?.meta?.code === "40001")
    );
  }

  private async lockAdjustmentCommand(
    tx: InvoiceTransactionClient,
    tenantId: string,
    key: string,
  ) {
    const lockKey = `${tenantId}:invoice-adjustment:${key}`;
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"`,
    );
  }

  private async lockInvoice(
    tx: InvoiceTransactionClient,
    tenantId: string,
    invoiceId: string,
    notFoundCode = "INVOICE_ADJUSTMENT_BASE_NOT_FOUND",
  ) {
    const rows = (await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Invoice" WHERE "tenantId" = ${tenantId} AND "id" = ${invoiceId} AND "deletedAt" IS NULL FOR UPDATE`,
    )) as Array<{ id: string }>;
    if (!rows.length) {
      throw new NotFoundException(notFoundCode);
    }
  }

  private async lockPaymentReference(
    tx: InvoiceTransactionClient,
    tenantId: string,
    provider: string,
    providerRef: string,
  ) {
    const lockKey = `${tenantId}:invoice-payment:${provider}:${providerRef}`;
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"`,
    );
  }

  private requireIdempotencyKey(value: string) {
    const key = String(value || "").trim();
    if (key.length < 8 || key.length > 128) {
      throw new BadRequestException("IDEMPOTENCY_KEY_INVALID");
    }
    return key;
  }

  private requireTenantId(value?: string) {
    const tenantId = String(value || "").trim();
    if (!tenantId) throw new BadRequestException("TENANT_CONTEXT_REQUIRED");
    return tenantId;
  }

  private hash(value: unknown) {
    return createHash("sha256")
      .update(this.stableStringify(value))
      .digest("hex");
  }

  private stableStringify(value: any): string {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Prisma.Decimal.isDecimal(value)) {
      return JSON.stringify(value.toFixed(2));
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    }
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`,
      )
      .join(",")}}`;
  }

  private toMoney(value: Prisma.Decimal | number | string) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  private sumMoney(values: Array<Prisma.Decimal | number | string>) {
    return this.toMoney(
      values.reduce<number>((sum, value) => sum + this.toMoney(value), 0),
    );
  }
}
