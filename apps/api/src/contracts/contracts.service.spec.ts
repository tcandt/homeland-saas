import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import {
  calculateFirstBillingPeriod,
  ContractsService,
} from "./contracts.service";
import { ContractsRepository } from "./contracts.repository";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../shared/audit/audit.service";
import { DomainEventPublisher } from "../shared/events/domain-event.publisher";
import {
  ContractStatus,
  DepositStatus,
  DepositType,
  InvoiceStatus,
  RoomStatus,
} from "@prisma/client";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { HunonicService } from "../hunonic/hunonic.service";
import { DepositCoreService } from "../deposits/deposit-core.service";
import { DepositsService } from "../deposits/deposits.service";
import { InvoicesService } from "../invoices/invoices.service";
import { COMBINED_ENTRY_POLICY } from "../invoices/combined-entry-invoice";

describe("ContractsService", () => {
  let service: ContractsService;
  let prismaService: any;
  let auditService: any;
  let eventPublisher: any;
  let hunonicService: any;
  let depositCoreService: any;
  let depositsService: any;

  beforeEach(async () => {
    prismaService = {
      hunonicMeterMapping: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      receipt: {
        findFirst: vi.fn(),
      },
      task: {
        findFirst: vi.fn(),
      },
      auditLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      tx: {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "r1" }]),
        invoice: {
          create: vi.fn().mockResolvedValue({
            id: "entry-invoice-1",
            code: "INV-ENTRY-HD-THUE-P101-ABCD1234",
            total: 3000000,
            dueDate: new Date("2026-10-01T00:00:00.000Z"),
            status: "DRAFT",
          }),
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        paymentRequest: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        contract: {
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        rentalCycle: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          updateMany: vi.fn(),
        },
        customer: {
          updateMany: vi.fn(),
          update: vi.fn(),
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        receipt: {
          create: vi.fn(),
        },
        task: {
          create: vi.fn(),
        },
        room: {
          findUnique: vi.fn(),
          findFirst: vi.fn().mockResolvedValue({ id: "r1", status: RoomStatus.OCCUPIED }),
          update: vi.fn(),
        },
        deposit: {
          create: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
        depositLedgerEntry: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 0 } }),
        },
        contractParty: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
        occupancy: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          upsert: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
          count: vi.fn().mockResolvedValue(0),
        },
        contractSettlement: {
          upsert: vi.fn(),
        },
        $transaction: vi.fn((callback) => callback(prismaService.tx)),
      },
    };

    auditService = {
      log: vi.fn(),
    };

    eventPublisher = {
      publish: vi.fn(),
    };

    hunonicService = {
      getRoomElectricityPricing: vi.fn().mockResolvedValue(null),
    };
    depositCoreService = {
      convertToSecurityInTransaction: vi.fn(),
      ensureActiveHoldForConversionInTransaction: vi.fn().mockResolvedValue({ id: "hold-1" }),
    };
    depositsService = { getDetail: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        {
          provide: ContractsRepository,
          useValue: {
            findById: vi.fn(),
            paginate: vi.fn(),
            softDelete: vi.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
        {
          provide: DomainEventPublisher,
          useValue: eventPublisher,
        },
        {
          provide: HunonicService,
          useValue: hunonicService,
        },
        {
          provide: DepositCoreService,
          useValue: depositCoreService,
        },
        {
          provide: DepositsService,
          useValue: depositsService,
        },
        {
          provide: InvoicesService,
          useValue: { issueInTransaction: vi.fn().mockResolvedValue({ status: "ISSUED" }) },
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  const mockLockedContract = (contract: any) => {
    prismaService.tx.contract.findFirst.mockImplementationOnce(async () => contract);
  };

  describe("deposit synchronization", () => {
    it("preserves the actual paid booking amount when linking it to a contract", async () => {
      prismaService.tx.deposit.findFirst.mockResolvedValue({
        id: "booking-1",
        type: "BOOKING",
        status: "PAID",
        amount: 1000000,
      });

      await service.syncContractDeposit({
        id: "contract-1",
        tenantId: "tenant-1",
        roomId: "room-1",
        customerId: "customer-1",
        status: ContractStatus.ACTIVE,
        depositMoney: 5000000,
      });

      expect(prismaService.tx.deposit.update).toHaveBeenCalledWith({
        where: { id: "booking-1" },
        data: {
          contractId: "contract-1",
          status: "CONVERTED_TO_CONTRACT",
          type: "BOOKING",
        },
      });
    });
  });

  describe("booking-hold conversion", () => {
    afterEach(() => vi.useRealTimers());
    it("reads live ledger and allocated credit for the linked rental in the source tenant", async () => {
      const source = { id: "source", tenantId: "tenant-1", code: "HD-COC-01", termsSnapshot: { bookingConversion: { rentalContractId: "rental" } } };
      prismaService.tx.contract.findFirst.mockResolvedValue({ id: "rental", tenantId: "tenant-1", status: "APPROVED", depositMoney: 5000, signedAt: new Date("2026-01-01"), startDate: new Date("2026-01-01") });
      prismaService.tx.deposit.findFirst.mockResolvedValue({ id: "security", status: "PAID", amount: 5000 });
      prismaService.tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 2000 } });
      prismaService.tx.invoice.findFirst.mockResolvedValue({ id: "entry", status: "PAID", total: 3000, paidAmount: 2000, creditAmount: 1000 });
      prismaService.tx.paymentRequest.findFirst.mockResolvedValue({ id: "payment-request-1", status: "CONFIRMED", metadata: { zaloSentAt: "2026-09-01T00:00:00.000Z" } });
      const first = await (service as any).getBookingConversionView(source);
      expect(first.rentalReadiness).toMatchObject({ depositPaid: false, entryInvoicePaid: true, canActivate: false });
      expect(first.entryPaymentRequest).toMatchObject({ id: "payment-request-1", metadata: { zaloSentAt: "2026-09-01T00:00:00.000Z" } });
      expect(prismaService.tx.paymentRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-1", sourceType: "INVOICE", sourceId: "entry" } }));
      expect(prismaService.tx.contract.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "rental", tenantId: "tenant-1", deletedAt: null } }));
      expect(prismaService.tx.depositLedgerEntry.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-1", depositId: "security" } }));
      prismaService.tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 5000 } });
      expect((await (service as any).getBookingConversionView(source)).rentalReadiness.canActivate).toBe(true);
    });

    it("treats a zero-security rental as deposit-ready", async () => {
      const source = {
        id: "source-zero",
        tenantId: "tenant-1",
        code: "HD-COC-00",
        termsSnapshot: { bookingConversion: { rentalContractId: "rental-zero" } },
      };
      prismaService.tx.contract.findFirst.mockResolvedValue({
        id: "rental-zero",
        tenantId: "tenant-1",
        status: ContractStatus.APPROVED,
        depositMoney: 0,
        signedAt: new Date("2026-01-01"),
        startDate: new Date("2026-01-01"),
      });
      prismaService.tx.deposit.findFirst.mockResolvedValue(null);
      prismaService.tx.invoice.findFirst.mockResolvedValue({
        id: "entry-zero",
        status: InvoiceStatus.PAID,
        total: 3000,
        paidAmount: 3000,
        creditAmount: 0,
      });

      const view = await (service as any).getBookingConversionView(source);

      expect(view.rentalReadiness.depositPaid).toBe(true);
      expect(view.rentalReadiness.blockingReasons).not.toContain(
        "SECURITY_DEPOSIT_UNPAID",
      );
    });

    it("recovers an older source link only from a target in the same rental cycle and tenant", async () => {
      const source = { id: "source", tenantId: "tenant-1", rentalCycleId: "cycle-1", code: "HD-COC-01" };
      prismaService.tx.contract.findMany = vi.fn().mockResolvedValue([{ id: "rental", termsSnapshot: { convertedFromBookingHold: { sourceContractId: "source" } } }]);
      const result = await (service as any).getBookingConversionView(source);
      expect(result.rentalContract.id).toBe("rental");
      expect(prismaService.tx.contract.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-1", rentalCycleId: "cycle-1", id: { not: "source" }, deletedAt: null } }));
    });

    it("rejects a stale generic edit before it can overwrite a newly committed source link", async () => {
      const version = new Date("2026-09-01T12:00:00Z");
      vi.spyOn(service, "getDetail").mockResolvedValue({ id: "source", tenantId: "tenant-1", status: "DRAFT", updatedAt: version, termsSnapshot: { bookingConversion: { rentalContractId: "rental" } } } as any);
      prismaService.tx.contract.findFirst.mockResolvedValue({ id: "source", tenantId: "tenant-1", status: "DRAFT", updatedAt: version, termsSnapshot: { bookingConversion: { rentalContractId: "rental" } } });
      (service as any).withContractSnapshots = vi.fn().mockResolvedValue({ termsSnapshot: { monthlyRent: 1000 } });
      prismaService.tx.contract.update.mockRejectedValue({ code: "P2025" });
      await expect(service.update("source", { signedAt: new Date() }, "user-1")).rejects.toThrow("CONTRACT_CONCURRENT_UPDATE_RELOAD_REQUIRED");
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "source", tenantId: "tenant-1", updatedAt: version }, data: expect.objectContaining({ termsSnapshot: expect.objectContaining({ bookingConversion: { rentalContractId: "rental" } }) }) }));
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it.each([
      { startDate: "2026-10-01T00:00:00.000Z", holdExpiresAt: undefined, expectedExpiry: "2026-10-02T00:00:00.000Z" },
      { startDate: "2026-09-22T00:00:00.000Z", holdExpiresAt: undefined, expectedExpiry: "2026-09-29T08:00:00.000Z" },
      { startDate: "2026-10-01T00:00:00.000Z", holdExpiresAt: "2026-10-03T00:00:00.000Z", expectedExpiry: "2026-10-03T00:00:00.000Z" },
    ])("creates the rental and reserves its slot automatically for $startDate ($expectedExpiry)", async ({ startDate, holdExpiresAt, expectedExpiry }) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-28T08:00:00.000Z"));
      const source = {
        id: "booking-contract-1",
        tenantId: "tenant-1",
        code: "HD-COC-001",
        purpose: "Cọc giữ phòng",
        rentalCycleId: "cycle-1",
        customerId: "customer-1",
        roomId: "room-1",
        monthlyRent: 3000000,
        depositMoney: 5000000,
        memberCount: 1,
        firstPaymentDate: null,
        coRepresentativeIds: [],
        roomSnapshot: { code: "P101" },
      };
      const created = {
        ...source,
        id: "rental-contract-1",
        code: "HD-THUE-P101-ABCD1234",
        termsSnapshot: { convertedFromBookingHold: { sourceContractId: source.id } },
      };
      const converted = {
        ...created,
        termsSnapshot: {
          convertedFromBookingHold: {
            sourceContractId: source.id,
            bookingDepositConversion: { operationId: "operation-1" },
          },
        },
      };
      prismaService.tx.contract.findFirst
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(null);
      prismaService.tx.contract.create.mockResolvedValue(created);
      prismaService.tx.contract.update.mockResolvedValue(converted);
      prismaService.tx.deposit.findFirst.mockResolvedValue({ id: "booking-deposit-1" });
      depositCoreService.convertToSecurityInTransaction.mockResolvedValue({
        operationId: "operation-1",
        securityDepositId: "security-deposit-1",
        securityRequired: 5000000,
        transferAmount: 2000000,
        additionalCashRequired: 3000000,
        excessAmount: 0,
        excessAction: null,
        creditNoteId: null,
        refundReceiptId: null,
      });
      (service as any).withContractSnapshots = vi.fn().mockResolvedValue({
        tenantId: "tenant-1",
        customerId: "customer-1",
        roomId: "room-1",
        rentalCycleId: "cycle-1",
        code: created.code,
        status: ContractStatus.DRAFT,
        startDate: new Date(startDate),
        endDate: new Date("2027-09-30T00:00:00.000Z"),
        monthlyRent: 3000000,
        depositMoney: 5000000,
        memberCount: 1,
        firstPaymentDate: new Date("2026-10-01T00:00:00.000Z"),
        purpose: "Hợp đồng thuê dài hạn",
        coRepresentativeIds: [],
        attachments: [],
      });
      (service as any).syncContractHistory = vi.fn().mockResolvedValue(undefined);

      await expect(
        service.createRentalFromBookingHold(
          source.id,
          {
            startDate,
            ...(holdExpiresAt ? { holdExpiresAt } : {}),
            endDate: "2027-09-30T00:00:00.000Z",
            depositAmount: 5000000,
            purpose: "Hợp đồng thuê dài hạn",
          },
          "user-1",
          "tenant-1",
          "booking-convert-command-1:contract",
        ),
      ).resolves.toEqual(converted);

      expect(depositCoreService.ensureActiveHoldForConversionInTransaction).toHaveBeenCalledWith(
        prismaService.tx,
        "tenant-1",
        "booking-deposit-1",
        new Date(expectedExpiry),
        "user-1",
        "booking-convert-command-1:deposit:conversion-hold",
      );
      expect(depositCoreService.convertToSecurityInTransaction).toHaveBeenCalledWith(
        prismaService.tx,
        "tenant-1",
        "booking-deposit-1",
        expect.objectContaining({
          idempotencyKey: "booking-convert-command-1:deposit",
          contractId: "rental-contract-1",
          securityRequired: 5000000,
        }),
        "user-1",
      );
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "rental-contract-1", tenantId: "tenant-1" } }),
      );
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: source.id, tenantId: "tenant-1" },
          data: expect.objectContaining({
            termsSnapshot: expect.objectContaining({
              bookingConversion: expect.objectContaining({
                status: "RENTAL_CONTRACT_CREATED",
                rentalContractId: "rental-contract-1",
              }),
            }),
          }),
        }),
      );
      expect((service as any).syncContractHistory).toHaveBeenCalledWith(converted, prismaService.tx);
      expect(prismaService.tx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractId: "rental-contract-1",
            billingKind: "ENTRY",
            status: "DRAFT",
            baseInvoiceKey: expect.stringMatching(/^ENTRY:rental-contract-1:/),
          }),
        }),
      );
    });

    it("finishes a legacy draft that was created before the paired deposit command", async () => {
      const source = {
        id: "booking-contract-legacy",
        tenantId: "tenant-1",
        code: "HD-COC-LEGACY",
        purpose: "Cọc giữ phòng",
        rentalCycleId: "cycle-legacy",
        customerId: "customer-1",
        roomId: "room-1",
        monthlyRent: 3000000,
        depositMoney: 5000000,
        memberCount: 1,
        firstPaymentDate: null,
        coRepresentativeIds: [],
        roomSnapshot: { code: "P102" },
      };
      const commandKey = "legacy-convert:contract";
      const input = {
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2027-09-30T00:00:00.000Z",
        depositAmount: 5000000,
        purpose: "Hợp đồng thuê dài hạn",
      };
      const requestHash = (service as any).hashSettlementRequest({
        sourceContractId: source.id,
        tenantId: "tenant-1",
        commandKey,
        startDate: new Date(input.startDate).toISOString(),
        endDate: new Date(input.endDate).toISOString(),
        rentAmount: null,
        depositAmount: input.depositAmount,
        memberCount: null,
        firstPaymentDate: new Date(input.startDate).toISOString(),
        purpose: input.purpose,
        coRepresentativeIds: null,
        securityDepositId: null,
        excessAction: null,
        refundStatus: null,
      });
      const legacy = {
        id: "legacy-rental-contract",
        ...source,
        code: "HD-THUE-P102-LEGACY",
        termsSnapshot: {
          convertedFromBookingHold: {
            sourceContractId: source.id,
            sourceRentalCycleId: source.rentalCycleId,
            policyVersion: "BOOKING_HOLD_TO_RENTAL_V1",
            idempotencyKey: commandKey,
            requestHash,
          },
        },
      };
      const completed = {
        ...legacy,
        termsSnapshot: {
          ...legacy.termsSnapshot,
          convertedFromBookingHold: {
            ...legacy.termsSnapshot.convertedFromBookingHold,
            bookingDepositConversion: { operationId: "operation-legacy" },
          },
        },
      };
      prismaService.tx.contract.findFirst
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(legacy);
      prismaService.tx.deposit.findFirst.mockResolvedValue({ id: "booking-deposit-legacy" });
      prismaService.tx.contract.update.mockResolvedValue(completed);
      depositCoreService.convertToSecurityInTransaction.mockResolvedValue({
        operationId: "operation-legacy",
        securityDepositId: "security-legacy",
        securityRequired: 5000000,
        transferAmount: 2000000,
        additionalCashRequired: 3000000,
        excessAmount: 0,
        excessAction: null,
        creditNoteId: null,
        refundReceiptId: null,
      });
      (service as any).syncContractHistory = vi.fn().mockResolvedValue(undefined);

      await expect(service.createRentalFromBookingHold(
        source.id,
        input,
        "user-1",
        "tenant-1",
        commandKey,
      )).resolves.toEqual(completed);

      expect(prismaService.tx.contract.create).not.toHaveBeenCalled();
      expect(depositCoreService.ensureActiveHoldForConversionInTransaction).not.toHaveBeenCalled();
      expect(depositCoreService.convertToSecurityInTransaction).toHaveBeenCalledWith(
        prismaService.tx,
        "tenant-1",
        "booking-deposit-legacy",
        expect.objectContaining({ idempotencyKey: "legacy-convert:deposit" }),
        "user-1",
      );
    });

    it("replays a completed conversion after the booking deposit is already marked converted", async () => {
      const source = {
        id: "booking-contract-replay",
        tenantId: "tenant-1",
        code: "HD-COC-REPLAY",
        purpose: "Cọc giữ phòng",
        rentalCycleId: "cycle-replay",
        customerId: "customer-1",
        roomId: "room-1",
        monthlyRent: 3000000,
        depositMoney: 5000000,
        memberCount: 1,
        firstPaymentDate: new Date("2026-10-01T00:00:00.000Z"),
        coRepresentativeIds: [],
        roomSnapshot: { code: "P103" },
      };
      const commandKey = "replay-convert:contract";
      const input = {
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2027-09-30T00:00:00.000Z",
        depositAmount: 5000000,
      };
      const requestHash = (service as any).hashSettlementRequest({
        sourceContractId: source.id,
        tenantId: "tenant-1",
        commandKey,
        startDate: new Date(input.startDate).toISOString(),
        endDate: new Date(input.endDate).toISOString(),
        rentAmount: null,
        depositAmount: input.depositAmount,
        memberCount: null,
        firstPaymentDate: new Date(input.startDate).toISOString(),
        purpose: null,
        coRepresentativeIds: null,
        securityDepositId: null,
        excessAction: null,
        refundStatus: null,
      });
      const replayedRental = {
        ...source,
        id: "rental-contract-replay",
        code: "HD-THUE-P103-REPLAY",
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        termsSnapshot: {
          convertedFromBookingHold: {
            sourceContractId: source.id,
            idempotencyKey: commandKey,
            requestHash,
            bookingDepositConversion: {
              operationId: "operation-replay",
              securityDepositId: "security-replay",
              additionalCashRequired: 3000000,
            },
          },
        },
      };
      prismaService.tx.contract.findFirst
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(replayedRental);
      prismaService.tx.deposit.findFirst.mockResolvedValue({ id: "booking-deposit-replay" });
      prismaService.tx.contract.update.mockResolvedValue(replayedRental);
      depositCoreService.convertToSecurityInTransaction.mockResolvedValue({
        operationId: "operation-replay",
        securityDepositId: "security-replay",
        securityRequired: 5000000,
        transferAmount: 2000000,
        additionalCashRequired: 3000000,
        excessAmount: 0,
        excessAction: null,
        creditNoteId: null,
        refundReceiptId: null,
      });
      (service as any).syncContractHistory = vi.fn().mockResolvedValue(undefined);

      await expect(service.createRentalFromBookingHold(
        source.id,
        input,
        "user-1",
        "tenant-1",
        commandKey,
      )).resolves.toEqual(replayedRental);

      expect(prismaService.tx.contract.create).not.toHaveBeenCalled();
      expect(depositCoreService.ensureActiveHoldForConversionInTransaction).not.toHaveBeenCalled();
      expect(depositCoreService.convertToSecurityInTransaction).toHaveBeenCalledWith(
        prismaService.tx,
        "tenant-1",
        "booking-deposit-replay",
        expect.objectContaining({ idempotencyKey: "replay-convert:deposit" }),
        "user-1",
      );
    });
  });

  describe("contract history synchronization", () => {
    it("uses one deterministic occupancy identity when an active contract is retried", async () => {
      prismaService.tx.customer.findMany.mockResolvedValue([
        { id: "customer-1", fullName: "Khách A" },
      ]);
      prismaService.tx.contractParty.findFirst.mockResolvedValue({
        id: "party-1",
        leftAt: null,
      });
      prismaService.tx.occupancy.findFirst.mockResolvedValue(null);
      const contract = {
        id: "contract-1",
        tenantId: "tenant-1",
        roomId: "room-1",
        customerId: "customer-1",
        coRepresentativeIds: [],
        status: ContractStatus.ACTIVE,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
      };

      await (service as any).syncContractHistory(contract);
      await (service as any).syncContractHistory(contract);

      expect(prismaService.tx.occupancy.upsert).toHaveBeenCalledTimes(2);
      const firstIdentity =
        prismaService.tx.occupancy.upsert.mock.calls[0][0].where.id;
      const secondIdentity =
        prismaService.tx.occupancy.upsert.mock.calls[1][0].where.id;
      expect(firstIdentity).toMatch(/^occ_[a-f0-9]{32}$/);
      expect(secondIdentity).toBe(firstIdentity);
      expect(prismaService.tx.occupancy.create).not.toHaveBeenCalled();
    });
  });

  describe("contract state boundaries", () => {
    it("creates a RentalCycle atomically with every new draft contract", async () => {
      const draft = {
        id: "c-new",
        tenantId: "tenant-1",
        customerId: "customer-1",
        roomId: "room-1",
        status: ContractStatus.DRAFT,
        startDate: new Date("2026-09-10"),
        endDate: new Date("2027-09-09"),
        monthlyRent: 2000000,
        depositMoney: 0,
        coRepresentativeIds: [],
      };
      prismaService.tx.contract.create.mockResolvedValue(draft);
      prismaService.tx.rentalCycle.create.mockResolvedValue({ id: "cycle-1" });
      prismaService.tx.contract.update.mockResolvedValue({
        ...draft,
        rentalCycleId: "cycle-1",
      });

      const created = await service.create(draft as any, "user-1", "Contracts");

      expect(prismaService.tx.rentalCycle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: "tenant-1",
            customerId: "customer-1",
            roomId: "room-1",
            status: "PLANNED",
          }),
        }),
      );
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: "c-new" },
        data: { rentalCycleId: "cycle-1" },
      });
      expect(prismaService.tx.deposit.create).not.toHaveBeenCalled();
      expect(created.rentalCycleId).toBe("cycle-1");
    });

    it("creates the pending security deposit with the rental draft", async () => {
      const draft = {
        id: "c-entry",
        code: "HD-PN-ENTRY",
        tenantId: "tenant-1",
        customerId: "customer-1",
        roomId: "room-1",
        status: ContractStatus.DRAFT,
        startDate: new Date("2026-09-29"),
        endDate: new Date("2027-09-28"),
        monthlyRent: 3000000,
        depositMoney: 3000000,
        coRepresentativeIds: [],
      };
      prismaService.tx.contract.create.mockResolvedValue(draft);
      prismaService.tx.rentalCycle.create.mockResolvedValue({ id: "cycle-entry" });
      prismaService.tx.contract.update.mockResolvedValue({
        ...draft,
        rentalCycleId: "cycle-entry",
      });
      prismaService.tx.deposit.create.mockResolvedValue({ id: "deposit-entry" });

      await service.create(draft as any, "user-1", "Contracts");

      expect(prismaService.tx.deposit.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-1",
          contractId: "c-entry",
          type: DepositType.SECURITY,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(prismaService.tx.deposit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          contractId: "c-entry",
          rentalCycleId: "cycle-entry",
          customerId: "customer-1",
          roomId: "room-1",
          type: DepositType.SECURITY,
          status: DepositStatus.PENDING,
          amount: 3000000,
        }),
      });
    });

    it("does not create a security deposit for a booking-hold draft", async () => {
      const bookingDraft = {
        id: "c-booking",
        code: "HD-COC-P101",
        tenantId: "tenant-1",
        customerId: "customer-1",
        roomId: "room-1",
        status: ContractStatus.DRAFT,
        startDate: new Date("2026-09-29"),
        endDate: new Date("2026-10-29"),
        monthlyRent: 0,
        depositMoney: 1000000,
        purpose: "Cọc giữ phòng",
        coRepresentativeIds: [],
      };
      prismaService.tx.contract.create.mockResolvedValue(bookingDraft);
      prismaService.tx.rentalCycle.create.mockResolvedValue({ id: "cycle-booking" });
      prismaService.tx.contract.update.mockResolvedValue({
        ...bookingDraft,
        rentalCycleId: "cycle-booking",
      });

      await service.create(bookingDraft as any, "user-1", "Contracts");

      expect(prismaService.tx.deposit.create).not.toHaveBeenCalled();
    });

    it.each([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED])(
      "blocks billing-term changes once a nondeleted %s invoice exists",
      async (invoiceStatus) => {
      const current = {
        id: "c-issued",
        tenantId: "tenant-1",
        status: ContractStatus.DRAFT,
        monthlyRent: 3000000,
        depositMoney: 3000000,
        roomId: "room-1",
        customerId: "customer-1",
        rentalCycleId: "cycle-1",
        startDate: new Date("2026-09-29"),
        firstPaymentDate: new Date("2026-09-29"),
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(current as any);
      prismaService.tx.contract.findFirst.mockResolvedValue(current);
      prismaService.tx.invoice.findFirst.mockResolvedValue({ id: "entry-document", status: invoiceStatus });

      await expect(
        service.update(current.id, { monthlyRent: 3100000 }, "user-1"),
      ).rejects.toThrow("CONTRACT_ENTRY_BILLING_ALREADY_ISSUED");
      expect(prismaService.tx.contract.update).not.toHaveBeenCalled();
      },
    );

    it.each([DepositStatus.DRAFT, DepositStatus.PENDING, DepositStatus.CANCELLED])(
      "blocks billing-term changes once a nondeleted %s linked deposit exists",
      async (depositStatus) => {
      const current = {
        id: "c-funded",
        tenantId: "tenant-1",
        status: ContractStatus.DRAFT,
        monthlyRent: 3000000,
        depositMoney: 3000000,
        roomId: "room-1",
        customerId: "customer-1",
        rentalCycleId: "cycle-1",
        startDate: new Date("2026-09-29"),
        firstPaymentDate: new Date("2026-09-29"),
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(current as any);
      prismaService.tx.contract.findFirst.mockResolvedValue(current);
      prismaService.tx.invoice.findFirst.mockResolvedValue(null);
      prismaService.tx.deposit.findFirst.mockResolvedValue({ id: "deposit-document", status: depositStatus });

      await expect(
        service.update(current.id, { firstPaymentDate: new Date("2026-10-01") }, "user-1"),
      ).rejects.toThrow("CONTRACT_ENTRY_BILLING_ALREADY_ISSUED");
      expect(prismaService.tx.contract.update).not.toHaveBeenCalled();
      },
    );

    it("keeps a combined entry snapshot immutable after its invoice is cancelled", async () => {
      const current = {
        id: "c-combined",
        tenantId: "tenant-1",
        status: ContractStatus.DRAFT,
        monthlyRent: 3000000,
        depositMoney: 0,
        roomId: "room-1",
        customerId: "customer-1",
        rentalCycleId: "cycle-1",
        startDate: new Date("2026-09-29"),
        firstPaymentDate: new Date("2026-09-29"),
        termsSnapshot: {
          convertedFromBookingHold: {
            initialEntryInvoice: { paymentPolicyVersion: COMBINED_ENTRY_POLICY },
          },
        },
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(current as any);
      prismaService.tx.contract.findFirst.mockResolvedValue(current);

      await expect(
        service.update(current.id, { depositMoney: 1 }, "user-1"),
      ).rejects.toThrow("CONTRACT_ENTRY_BILLING_ALREADY_ISSUED");
      expect(prismaService.tx.invoice.findFirst).not.toHaveBeenCalled();
      expect(prismaService.tx.contract.update).not.toHaveBeenCalled();
    });

    it("allows unchanged billing terms and signed documents after invoice issuance", async () => {
      const updatedAt = new Date("2026-09-29T00:00:00.000Z");
      const current = {
        id: "c-issued-documents",
        tenantId: "tenant-1",
        status: ContractStatus.DRAFT,
        monthlyRent: 3000000,
        depositMoney: 3000000,
        roomId: "room-1",
        customerId: "customer-1",
        rentalCycleId: "cycle-1",
        startDate: new Date("2026-09-29"),
        firstPaymentDate: new Date("2026-09-29"),
        updatedAt,
        termsSnapshot: {
          initialEntryInvoice: {
            invoiceId: "entry-immediate-combined",
            paymentPolicyVersion: COMBINED_ENTRY_POLICY,
          },
          convertedFromBookingHold: {
            initialEntryInvoice: { paymentPolicyVersion: COMBINED_ENTRY_POLICY },
          },
        },
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(current as any);
      prismaService.tx.contract.findFirst.mockResolvedValue(current);
      (service as any).withContractSnapshots = vi.fn().mockResolvedValue({
        customerSnapshot: {}, roomSnapshot: {}, termsSnapshot: {},
      });
      prismaService.tx.contract.update.mockResolvedValue({
        ...current,
        attachments: ["signed.pdf"],
      });

      await expect(
        service.update(current.id, {
          monthlyRent: 3000000,
          attachments: ["signed.pdf"],
          signedAt: new Date("2026-09-29T01:00:00.000Z"),
        }, "user-1"),
      ).resolves.toMatchObject({ attachments: ["signed.pdf"] });
      expect(prismaService.tx.invoice.findFirst).not.toHaveBeenCalled();
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: current.id, tenantId: "tenant-1", updatedAt },
        data: expect.objectContaining({
          termsSnapshot: expect.objectContaining({
            initialEntryInvoice: current.termsSnapshot.initialEntryInvoice,
          }),
        }),
      }));
    });

    it.each([InvoiceStatus.DRAFT, InvoiceStatus.PAID])(
      "does not create an ENTRY invoice beside a legacy generic first-entry document in %s",
      async (status) => {
        const contract = {
          id: "legacy-contract", tenantId: "tenant-1", code: "HD-LEGACY",
          customerId: "customer-1", rentalCycleId: "cycle-1", monthlyRent: 3_000_000,
          startDate: new Date("2026-09-01T00:00:00.000Z"), firstPaymentDate: null,
        };
        prismaService.tx.invoice.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: "legacy-entry", status });

        await expect(
          (service as any).ensureEntryInvoiceInTransaction(
            prismaService.tx, contract, InvoiceStatus.DRAFT,
          ),
        ).rejects.toThrow("LEGACY_GENERIC_ENTRY_INVOICE_CONFLICT");
        expect(prismaService.tx.invoice.create).not.toHaveBeenCalled();
      },
    );

    it("rejects creating a contract directly as ACTIVE", async () => {
      await expect(
        service.create({ status: ContractStatus.ACTIVE } as any),
      ).rejects.toThrow("CONTRACT_CREATE_REQUIRES_DRAFT");
    });

    it("rejects changing status through the generic update command", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        status: ContractStatus.DRAFT,
        tenantId: "tenant-1",
      } as any);
      prismaService.tx.contract.findFirst.mockResolvedValue({
        id: "c1",
        status: ContractStatus.DRAFT,
        tenantId: "tenant-1",
      });

      await expect(
        service.update("c1", { status: ContractStatus.ACTIVE }, "user1"),
      ).rejects.toThrow("CONTRACT_STATUS_TRANSITION_REQUIRES_COMMAND");
    });
  });

  describe("submitContract", () => {
    it("should submit a DRAFT contract successfully", async () => {
      const mockContract = { id: "c1", status: ContractStatus.DRAFT };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.PENDING_APPROVAL,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);

      const result = await service.submitContract("c1", "user1");

      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { status: ContractStatus.PENDING_APPROVAL },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE",
          entityId: "c1",
          before: mockContract,
          after: updatedContract,
        }),
      );
      expect(result).toEqual(updatedContract);
    });

    it("should throw BadRequestException if contract is not DRAFT", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        status: ContractStatus.ACTIVE,
      } as any);

      await expect(service.submitContract("c1", "user1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("getDetail", () => {
    const debtInvoice = (data: any) => ({
      tenantId: "tenant-1",
      contractId: "contract-1",
      deletedAt: null,
      status: InvoiceStatus.ISSUED,
      billingKind: "ENTRY",
      adjustmentOfInvoiceId: null,
      paidAmount: 0,
      creditAmount: 0,
      dueDate: new Date("2026-09-29"),
      createdAt: new Date("2026-09-29"),
      ...data,
    });

    it("hydrates authoritative debt from scoped issued, partial, and credit invoice families", async () => {
      const record = {
        id: "contract-1",
        code: "HD-PN-01",
        tenantId: "tenant-1",
        coRepresentativeIds: [],
      };
      (service as any).repository.findById.mockResolvedValue(record);
      prismaService.tx.invoice.findMany.mockResolvedValue([
        debtInvoice({ id: "entry-6m", total: 6000000 }),
        debtInvoice({
          id: "partial", total: 4000000, paidAmount: 1000000,
          creditAmount: 500000, status: InvoiceStatus.PARTIALLY_PAID,
        }),
        debtInvoice({ id: "family-root", total: 2000000 }),
        debtInvoice({
          id: "family-credit", total: 1000000,
          billingKind: "CREDIT_ADJUSTMENT", adjustmentOfInvoiceId: "family-root",
        }),
        debtInvoice({ id: "paid", total: 9000000, status: InvoiceStatus.PAID }),
        debtInvoice({ id: "cancelled", total: 9000000, status: InvoiceStatus.CANCELLED }),
        debtInvoice({ id: "deleted", total: 9000000, deletedAt: new Date() }),
        debtInvoice({ id: "foreign-tenant", total: 9000000, tenantId: "tenant-other" }),
        debtInvoice({ id: "foreign-contract", total: 9000000, contractId: "contract-other" }),
      ]);

      await expect(service.getDetail(record.id)).resolves.toMatchObject({ debt: 9500000 });
      expect(prismaService.tx.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { tenantId: "tenant-1", contractId: "contract-1", deletedAt: null },
      }));
    });

    it("returns the same debt in list and detail without per-contract invoice queries", async () => {
      const record = {
        id: "contract-1",
        code: "HD-PN-01",
        tenantId: "tenant-1",
        coRepresentativeIds: [],
      };
      const secondRecord = {
        id: "contract-2",
        code: "HD-PN-02",
        tenantId: "tenant-1",
        coRepresentativeIds: [],
      };
      const invoices = [
        debtInvoice({ id: "entry-6m", total: 6000000 }),
        debtInvoice({
          id: "partial", total: 4000000, paidAmount: 1000000,
          creditAmount: 500000, status: InvoiceStatus.PARTIALLY_PAID,
        }),
        debtInvoice({ id: "second-entry", contractId: "contract-2", total: 1000000 }),
      ];
      (service as any).repository.paginate.mockResolvedValue({
        data: [record, secondRecord], total: 2, page: 1, limit: 20,
      });
      (service as any).repository.findById.mockResolvedValue(record);
      prismaService.tx.invoice.findMany.mockResolvedValue(invoices);

      const listed = await service.listContracts(1, 20, undefined, undefined, undefined, undefined, undefined, undefined, "tenant-1");
      const detailed = await service.getDetail(record.id);

      expect(listed.data[0]).toMatchObject({ id: record.id, debt: 8500000 });
      expect(listed.data[1]).toMatchObject({ id: secondRecord.id, debt: 1000000 });
      expect(detailed).toMatchObject({ id: record.id, debt: 8500000 });
      expect(prismaService.tx.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          contractId: { in: [record.id, secondRecord.id] },
          deletedAt: null,
        }),
      }));
    });

    function mockPendingBooking(status: DepositStatus = DepositStatus.PENDING) {
      const deposit = {
        id: "booking-deposit", tenantId: "tenant-1", type: DepositType.BOOKING,
        status, amount: 1000000, contractId: "booking-contract",
      };
      (service as any).repository.findById.mockResolvedValue({
        id: "booking-contract", code: "HD-COC-TEST", tenantId: "tenant-1",
        customerId: "customer-1", roomId: "room-1", status: ContractStatus.APPROVED,
      });
      prismaService.tx.deposit.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(where.type === DepositType.SECURITY ? null : { ...deposit }),
      );
      prismaService.tx.invoice.findFirst.mockResolvedValue({
        id: "invoice-1", period: "Cọc giữ phòng", status: "PAID", total: 1000000,
      });
      prismaService.tx.paymentRequest.findFirst.mockResolvedValue({
        id: "request-1", status: "CONFIRMED", amount: 1000000,
      });
      return deposit;
    }

    it.each([DepositStatus.DRAFT, DepositStatus.PENDING])("automatically reconciles %s booking cash on contract detail and does not repeat after success", async (status) => {
      const deposit = mockPendingBooking(status);
      depositsService.getDetail.mockImplementation(async () => {
        deposit.status = DepositStatus.PAID;
        return { ...deposit, availableBalance: 1000000, reconciliationError: null };
      });
      await expect(service.getDetail("booking-contract")).resolves.toMatchObject({
        bookingDeposit: { status: "PAID", availableBalance: 1000000, reconciliationError: null },
      });
      await service.getDetail("booking-contract");
      expect(depositsService.getDetail).toHaveBeenCalledExactlyOnceWith("booking-deposit");
    });

    it("keeps failed payment proof blocked while exposing the automatic reconciliation error", async () => {
      const deposit = mockPendingBooking();
      depositsService.getDetail.mockResolvedValue({
        ...deposit, availableBalance: 0, reconciliationError: "DEPOSIT_RECONCILIATION_PROOF_INVALID",
      });
      await expect(service.getDetail("booking-contract")).resolves.toMatchObject({
        bookingDeposit: { status: "PENDING", availableBalance: 0, reconciliationError: "DEPOSIT_RECONCILIATION_PROOF_INVALID" },
      });
    });

    it("keeps transient automatic reconciliation failures readable and pending", async () => {
      mockPendingBooking();
      depositsService.getDetail.mockRejectedValue(new Error("temporary database failure"));
      await expect(service.getDetail("booking-contract")).resolves.toMatchObject({
        bookingDeposit: { status: "PENDING", reconciliationError: "DEPOSIT_RECONCILIATION_UNAVAILABLE" },
      });
    });

    it("never accepts a reconciliation result belonging to another tenant", async () => {
      const deposit = mockPendingBooking();
      depositsService.getDetail.mockResolvedValue({ ...deposit, tenantId: "tenant-other", status: "PAID" });
      await expect(service.getDetail("booking-contract")).resolves.toMatchObject({
        bookingDeposit: { status: "PENDING", reconciliationError: "DEPOSIT_RECONCILIATION_UNAVAILABLE" },
      });
    });

    it("does not trigger booking reconciliation for an ordinary rental detail", async () => {
      mockPendingBooking();
      (service as any).repository.findById.mockResolvedValue({
        id: "rental-contract", code: "HD-THUE-TEST", tenantId: "tenant-1",
      });
      await service.getDetail("rental-contract");
      expect(depositsService.getDetail).not.toHaveBeenCalled();
    });

    it("prefers the current contract deposit over a newer booking for the same customer and room", async () => {
      const deposit = mockPendingBooking();
      const newer = { ...deposit, id: "newer-deposit", contractId: "newer-contract", rentalCycleId: "newer-cycle" };
      prismaService.tx.deposit.findFirst.mockImplementation(({ where }: any) => Promise.resolve(
        where.type === DepositType.SECURITY ? null : where.contractId === deposit.contractId ? deposit : newer,
      ));
      depositsService.getDetail.mockResolvedValue({ ...deposit, status: DepositStatus.PAID, availableBalance: 1000000 });
      await expect(service.getDetail("booking-contract")).resolves.toMatchObject({ bookingDeposit: { id: deposit.id } });
      expect(depositsService.getDetail).toHaveBeenCalledExactlyOnceWith(deposit.id);
      expect(prismaService.tx.deposit.findMany).not.toHaveBeenCalled();
    });

    it("uses the owned cycle without collecting another contract's deposit in the same room", async () => {
      const deposit = { ...mockPendingBooking(), contractId: null, rentalCycleId: "old-cycle" };
      (service as any).repository.findById.mockResolvedValue({
        id: "booking-contract", code: "HD-COC-TEST", tenantId: "tenant-1",
        rentalCycleId: "old-cycle", roomId: "room-1", customerId: "customer-1",
      });
      prismaService.tx.deposit.findFirst.mockImplementation(({ where }: any) => Promise.resolve(
        where.type !== DepositType.SECURITY && where.rentalCycleId === "old-cycle" ? deposit : null,
      ));
      depositsService.getDetail.mockResolvedValue({ ...deposit, status: DepositStatus.PAID, availableBalance: 1000000 });
      await service.getDetail("booking-contract");
      expect(depositsService.getDetail).toHaveBeenCalledExactlyOnceWith(deposit.id);
      expect(prismaService.tx.deposit.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1", rentalCycleId: "old-cycle", OR: [{ contractId: null }, { status: "CONVERTED_TO_CONTRACT" }] }),
      }));
    });

    it("never guesses between ambiguous unlinked legacy booking deposits", async () => {
      const deposit = mockPendingBooking();
      prismaService.tx.deposit.findFirst.mockResolvedValue(null);
      prismaService.tx.deposit.findMany.mockResolvedValue([
        { ...deposit, contractId: null, rentalCycleId: null },
        { ...deposit, id: "legacy-second", contractId: null, rentalCycleId: null },
      ]);
      await expect(service.getDetail("booking-contract")).resolves.toMatchObject({ bookingDeposit: null });
      expect(depositsService.getDetail).not.toHaveBeenCalled();
      expect(prismaService.tx.deposit.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1", contractId: null, rentalCycleId: null, roomId: "room-1", customerId: "customer-1" }), take: 2,
      }));
    });

    it("should enrich detail with settlement refund summary", async () => {
      const repository = (service as any).repository;
      repository.findById.mockResolvedValue({
        id: "c1",
        code: "C-DETAIL-1",
        tenantId: "t1",
        coRepresentativeIds: [],
      });
      prismaService.receipt.findFirst.mockResolvedValue({
        id: "rcpt-1",
        code: "RCT-C-DETAIL-1-123",
        status: "PENDING",
        amount: 150000,
        description: "Contract settlement refund for C-DETAIL-1",
      });
      prismaService.task.findFirst.mockResolvedValue({
        id: "task-1",
        title: "Xu ly hoan tien quyet toan C-DETAIL-1",
        status: "TODO",
      });

      await expect(service.getDetail("c1")).resolves.toEqual(
        expect.objectContaining({
          id: "c1",
          settlementRefund: expect.objectContaining({
            receiptId: "rcpt-1",
            receiptStatus: "PENDING",
            taskId: "task-1",
            taskStatus: "TODO",
            pending: true,
            completed: false,
          }),
        }),
      );
    });
  });

  describe("approveContract", () => {
    it("should approve a PENDING_APPROVAL contract and create deposit", async () => {
      const mockContract = {
        id: "c1",
        status: ContractStatus.PENDING_APPROVAL,
        roomId: "r1",
        depositMoney: 1000,
        tenantId: "t1",
        customerId: "cu1",
      };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.APPROVED,
      };
      const mockRoom = { id: "r1", status: RoomStatus.AVAILABLE };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);

      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({
        ...mockRoom,
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.deposit.create.mockResolvedValue({
        id: "d1",
        amount: 1000,
      });
      mockLockedContract(mockContract);

      const result = await service.approveContract("c1", "user1");

      expect(prismaService.tx.room.findUnique).toHaveBeenCalledWith({
        where: { id: "r1" },
      });
      expect(prismaService.tx.$transaction).toHaveBeenCalled();
      expect(prismaService.tx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(
        prismaService.tx.$queryRaw.mock.invocationCallOrder[0],
      ).toBeLessThan(
        prismaService.tx.contract.findFirst.mock.invocationCallOrder[0],
      );
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { status: ContractStatus.APPROVED },
      });
      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { status: RoomStatus.RESERVED },
      });
      expect(prismaService.tx.deposit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roomId: "r1",
            code: "DC-c1",
            type: DepositType.SECURITY,
            status: DepositStatus.PENDING,
            amount: 1000,
          }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE",
          entityId: "c1",
          before: mockContract,
          after: updatedContract,
        }),
      );
      expect(result).toEqual(updatedContract);
    });

    it("reuses the pending security deposit created with the draft", async () => {
      const mockContract = {
        id: "c1",
        code: "HD-PN-001",
        status: ContractStatus.PENDING_APPROVAL,
        roomId: "r1",
        depositMoney: 1000,
        tenantId: "t1",
        customerId: "cu1",
      };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.APPROVED,
      };
      const mockRoom = { id: "r1", status: RoomStatus.AVAILABLE };
      const existingDeposit = {
        id: "deposit-existing",
        tenantId: "t1",
        contractId: "c1",
        type: DepositType.SECURITY,
        roomId: "r1",
        customerId: "cu1",
        rentalCycleId: null,
        status: DepositStatus.PENDING,
        amount: 1000,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({
        ...mockRoom,
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.deposit.findFirst.mockResolvedValue(existingDeposit);
      mockLockedContract(mockContract);

      const result = await service.approveContract("c1", "user1");

      expect(result).toEqual(updatedContract);
      expect(prismaService.tx.deposit.create).not.toHaveBeenCalled();
    });

    it("rejects approval if the locked contract is no longer pending", async () => {
      const snapshot = {
        id: "c-stale",
        tenantId: "t1",
        roomId: "r1",
        status: ContractStatus.PENDING_APPROVAL,
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(snapshot as any);
      mockLockedContract({ ...snapshot, status: ContractStatus.APPROVED });

      await expect(service.approveContract(snapshot.id, "user-1")).rejects.toThrow(
        "CONTRACT_APPROVAL_STATE_CHANGED",
      );
      expect(prismaService.tx.room.update).not.toHaveBeenCalled();
      expect(prismaService.tx.deposit.create).not.toHaveBeenCalled();
    });

    it("rejects approval when the contract changed rooms after the original room lock", async () => {
      const snapshot = {
        id: "c-room-race",
        tenantId: "t1",
        roomId: "r1",
        status: ContractStatus.PENDING_APPROVAL,
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(snapshot as any);
      mockLockedContract({ ...snapshot, roomId: "r2" });

      await expect(service.approveContract(snapshot.id, "user-1")).rejects.toThrow(
        "CONTRACT_APPROVAL_ROOM_CHANGED",
      );
      expect(prismaService.tx.room.findUnique).not.toHaveBeenCalled();
      expect(prismaService.tx.room.update).not.toHaveBeenCalled();
      expect(prismaService.tx.deposit.create).not.toHaveBeenCalled();
      expect(prismaService.tx.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it("rejects approval when the existing security deposit scope or amount differs", async () => {
      const contract = {
        id: "c1",
        code: "HD-PN-001",
        status: ContractStatus.PENDING_APPROVAL,
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        rentalCycleId: "cycle-1",
        depositMoney: 1000,
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(contract as any);
      prismaService.tx.room.findUnique.mockResolvedValue({ id: "r1", status: RoomStatus.AVAILABLE });
      prismaService.tx.contract.update.mockResolvedValue({ ...contract, status: ContractStatus.APPROVED });
      prismaService.tx.room.update.mockResolvedValue({ id: "r1", status: RoomStatus.RESERVED });
      prismaService.tx.deposit.findFirst.mockResolvedValue({
        id: "security-mismatch",
        tenantId: "t1",
        contractId: "c1",
        type: DepositType.SECURITY,
        roomId: "r1",
        customerId: "cu1",
        rentalCycleId: "cycle-1",
        amount: 999,
      });
      mockLockedContract(contract);

      await expect(service.approveContract("c1", "user-1")).rejects.toThrow(
        "CONTRACT_SECURITY_DEPOSIT_SCOPE_MISMATCH",
      );
      expect(prismaService.tx.deposit.create).not.toHaveBeenCalled();
    });

    it("approves a zero-security rental with an unlinked lifecycle hold", async () => {
      const contract = {
        id: "c-zero-security",
        status: ContractStatus.PENDING_APPROVAL,
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        rentalCycleId: "cycle-zero",
        depositMoney: 0,
        startDate: new Date("2026-10-01"),
      };
      const approved = { ...contract, status: ContractStatus.APPROVED };
      vi.spyOn(service, "getDetail").mockResolvedValue(contract as any);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1", status: RoomStatus.AVAILABLE, rentalType: "WHOLE",
      });
      prismaService.tx.contract.update.mockResolvedValue(approved);
      prismaService.tx.room.update.mockResolvedValue({ id: "r1", status: RoomStatus.RESERVED });
      prismaService.tx.roomHold = {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "zero-hold" }),
      };
      mockLockedContract(contract);

      await expect(service.approveContract(contract.id, "user-1")).resolves.toEqual(approved);

      expect(prismaService.tx.deposit.create).not.toHaveBeenCalled();
      expect(prismaService.tx.roomHold.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ depositId: null }),
      }));
    });

    it("approves a rental that owns the active booking hold and consumes that hold", async () => {
      const contract = {
        id: "rental-contract-1",
        code: "HD-THUE-001",
        status: ContractStatus.PENDING_APPROVAL,
        tenantId: "tenant-1",
        roomId: "room-1",
        customerId: "customer-1",
        rentalCycleId: "cycle-1",
        depositMoney: 5_000_000,
        startDate: new Date("2026-10-01T00:00:00.000Z"),
      };
      const approved = { ...contract, status: ContractStatus.APPROVED };
      vi.spyOn(service, "getDetail").mockResolvedValue(contract as any);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "room-1",
        code: "P101",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.room.update.mockResolvedValue({ id: "room-1", status: RoomStatus.RESERVED });
      prismaService.tx.contract.update.mockResolvedValue(approved);
      prismaService.tx.deposit.findFirst.mockResolvedValue({
        id: "security-deposit-1",
        tenantId: "tenant-1",
        contractId: contract.id,
        roomId: contract.roomId,
        customerId: contract.customerId,
        rentalCycleId: contract.rentalCycleId,
        amount: contract.depositMoney,
        status: DepositStatus.PAID,
      });
      prismaService.tx.roomHold = {
        findFirst: vi.fn().mockResolvedValue({ id: "own-hold-1" }),
        count: vi.fn().mockResolvedValue(1),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      };
      mockLockedContract(contract);

      await expect(service.approveContract(contract.id, "user-1")).resolves.toEqual(approved);

      expect(prismaService.tx.roomHold.updateMany).toHaveBeenCalledWith({
        where: {
          id: "own-hold-1",
          tenantId: "tenant-1",
          status: "ACTIVE",
        },
        data: expect.objectContaining({
          status: "CONVERTED",
          activeResourceKey: null,
          releaseReason: `CONVERTED_TO_CONTRACT:${contract.id}`,
        }),
      });
    });

    it("creates an approval hold for a renewal cycle that has no booking hold", async () => {
      const contract = {
        id: "renewal-contract-1",
        code: "RN-001",
        status: ContractStatus.PENDING_APPROVAL,
        tenantId: "tenant-1",
        roomId: "room-1",
        customerId: "customer-1",
        rentalCycleId: "renewal-cycle-1",
        depositMoney: 5_000_000,
        startDate: new Date("2026-10-01T00:00:00.000Z"),
        endDate: new Date("2027-10-01T00:00:00.000Z"),
        termsSnapshot: { renewal: { sourceContractId: "source-contract-1" } },
      };
      const approved = { ...contract, status: ContractStatus.APPROVED };
      vi.spyOn(service, "getDetail").mockResolvedValue(contract as any);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "room-1",
        code: "P101",
        status: RoomStatus.AVAILABLE,
        rentalType: "WHOLE",
      });
      prismaService.tx.room.update.mockResolvedValue({ id: "room-1", status: RoomStatus.RESERVED });
      prismaService.tx.contract.update.mockResolvedValue(approved);
      prismaService.tx.deposit.create.mockResolvedValue({
        id: "renewal-deposit-1",
        amount: contract.depositMoney,
      });
      prismaService.tx.roomHold = {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "renewal-hold-1" }),
      };
      mockLockedContract(contract);

      await expect(service.approveContract(contract.id, "user-1")).resolves.toEqual(approved);

      expect(prismaService.tx.roomHold.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          rentalCycleId: "renewal-cycle-1",
          depositId: "renewal-deposit-1",
          roomId: "room-1",
          kind: "WHOLE",
          status: "ACTIVE",
          idempotencyKey: "CONTRACT_APPROVAL:renewal-contract-1",
        }),
      });
    });

    it("should throw BadRequestException if contract is not PENDING_APPROVAL", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        status: ContractStatus.DRAFT,
      } as any);

      await expect(service.approveContract("c1", "user1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw ConflictException if room is not AVAILABLE", async () => {
      const mockContract = {
        id: "c1",
        status: ContractStatus.PENDING_APPROVAL,
        roomId: "r1",
      };
      const mockRoom = { id: "r1", status: RoomStatus.OCCUPIED };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);

      prismaService.tx.occupancy.count.mockResolvedValue(1);
      mockLockedContract(mockContract);

      await expect(service.approveContract("c1", "user1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("should approve when OCCUPIED is stale and no blocking room resources exist", async () => {
      const mockContract = {
        id: "c1",
        status: ContractStatus.PENDING_APPROVAL,
        roomId: "r1",
        depositMoney: 1000,
        tenantId: "t1",
        customerId: "cu1",
      };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.APPROVED,
      };
      const mockRoom = { id: "r1", code: "PN 32-06", status: RoomStatus.OCCUPIED };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({
        ...mockRoom,
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.deposit.create.mockResolvedValue({
        id: "d1",
        amount: 1000,
      });
      mockLockedContract(mockContract);

      const result = await service.approveContract("c1", "user1");

      expect(result).toEqual(updatedContract);
      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { status: RoomStatus.RESERVED },
      });
    });
  });

  describe("activateContract", () => {
    const activationReadyFields = () => ({
      signedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    it("blocks activation of a booking-hold source even when it is approved", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "booking-source-1",
        tenantId: "t1",
        status: ContractStatus.APPROVED,
        code: "HD-COC-001",
        purpose: "Cọc giữ phòng",
      } as any);

      await expect(
        service.activateContract(
          "booking-source-1",
          "user1",
          "t1",
          "activate-booking-source",
        ),
      ).rejects.toThrow("BOOKING_HOLD_REQUIRES_RENTAL_CONVERSION");
      expect(prismaService.tx.contract.updateMany).not.toHaveBeenCalled();
    });

    it("blocks converted-rental activation while the entry invoice is unpaid", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "rental-1",
        tenantId: "t1",
        status: ContractStatus.APPROVED,
        code: "HD-THUE-P101-1",
        purpose: "Hợp đồng thuê từ HD-COC-001",
        roomId: "r1",
        customerId: "cu1",
        depositMoney: 1000,
        monthlyRent: 5000,
        termsSnapshot: {
          convertedFromBookingHold: { sourceContractId: "booking-source-1" },
        },
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.room.findFirst.mockResolvedValue({
        id: "r1",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.deposit.findFirst.mockResolvedValue({
        id: "security-1",
        status: DepositStatus.PAID,
      });
      prismaService.tx.depositLedgerEntry.aggregate.mockResolvedValue({
        _sum: { balanceEffect: 1000 },
      });
      prismaService.tx.invoice.findFirst.mockResolvedValue({
        id: "entry-1",
        status: "ISSUED",
        total: 5000,
        paidAmount: 0,
        creditAmount: 0,
      });
      mockLockedContract(mockContract);

      await expect(
        service.activateContract("rental-1", "user1", "t1", "activate-unpaid-entry"),
      ).rejects.toThrow("CONTRACT_ENTRY_INVOICE_UNPAID");
      expect(prismaService.tx.contract.updateMany).not.toHaveBeenCalled();
      expect(prismaService.tx.room.update).not.toHaveBeenCalled();
    });

    it("activates a converted rental paid with cash and credit without duplicating its entry invoice", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        status: ContractStatus.APPROVED,
        roomId: "r1",
        depositMoney: 1000,
        tenantId: "t1",
        customerId: "cu1",
        monthlyRent: 5000,
        termsSnapshot: {
          convertedFromBookingHold: { sourceContractId: "booking-source-1" },
        },
      };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.ACTIVE,
      };
      const mockRoom = { id: "r1", status: RoomStatus.RESERVED };
      const mockDeposit = { id: "d1", status: "PAID" };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);
      prismaService.tx.room.findFirst.mockResolvedValue(mockRoom);
      prismaService.tx.deposit.findFirst = vi
        .fn()
        .mockResolvedValue(mockDeposit);
      prismaService.tx.depositLedgerEntry = {
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 1000 } }),
      };

      prismaService.tx.contract.findFirst.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({
        ...mockRoom,
        status: RoomStatus.OCCUPIED,
      });
      prismaService.tx.deposit.update = vi
        .fn()
        .mockResolvedValue({ ...mockDeposit, status: "CONVERTED_TO_CONTRACT" });
      prismaService.tx.invoice.findFirst
        .mockResolvedValueOnce({
          id: "inv1",
          contractId: "c1",
          customerId: "cu1",
          rentalCycleId: undefined,
          billingKind: "ENTRY",
          status: "PAID",
          total: 5000,
          paidAmount: 3000,
          creditAmount: 2000,
        })
        .mockResolvedValueOnce({
          id: "inv1",
          contractId: "c1",
          customerId: "cu1",
          rentalCycleId: undefined,
          billingKind: "ENTRY",
          status: "PAID",
          total: 5000,
          paidAmount: 3000,
          creditAmount: 2000,
        })
        .mockResolvedValueOnce({
          id: "inv1",
          contractId: "c1",
          customerId: "cu1",
          rentalCycleId: undefined,
          billingKind: "ENTRY",
          status: "PAID",
          total: 5000,
          paidAmount: 3000,
          creditAmount: 2000,
        });
      mockLockedContract(mockContract);

      const result = await service.activateContract(
        "c1",
        "user1",
        "t1",
        "activate-c1-success",
      );

      expect(prismaService.tx.room.findUnique).toHaveBeenCalledWith({
        where: { id: "r1" },
      });
      expect(prismaService.tx.deposit.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: "t1",
          contractId: "c1",
          roomId: "r1",
          customerId: "cu1",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(prismaService.tx.$transaction).toHaveBeenCalled();
      expect(prismaService.tx.$queryRaw).toHaveBeenCalledTimes(3);
      expect(
        prismaService.tx.deposit.findFirst.mock.invocationCallOrder[0],
      ).toBeLessThan(
        prismaService.tx.room.findFirst.mock.invocationCallOrder[0],
      );

      expect(prismaService.tx.contract.updateMany).toHaveBeenCalledWith({
        where: { id: "c1", tenantId: "t1", status: ContractStatus.APPROVED },
        data: expect.objectContaining({
          status: ContractStatus.ACTIVE,
          moveInSnapshot: expect.objectContaining({
            roomId: "r1",
            policyVersion: "MOVE_IN_V1",
          }),
          activatedAt: expect.any(Date),
          activationIdempotencyKey: "activate-c1-success",
        }),
      });
      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { status: RoomStatus.OCCUPIED },
      });
      expect(prismaService.tx.deposit.update).toHaveBeenCalledWith({
        where: { id: "d1" },
        data: expect.objectContaining({ status: "CONVERTED_TO_CONTRACT" }),
      });
      expect(prismaService.tx.invoice.create).not.toHaveBeenCalled();

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE",
          entityId: "c1",
          before: mockContract,
          after: updatedContract,
        }),
      );
      expect(result).toMatchObject({ ...updatedContract, entryInvoice: { id: "inv1" } });
    });

    it("activates a zero-security rental without creating or converting a deposit", async () => {
      const contract = {
        ...activationReadyFields(),
        id: "c-zero-security",
        tenantId: "t1",
        status: ContractStatus.APPROVED,
        roomId: "r1",
        customerId: "cu1",
        rentalCycleId: "cycle-zero",
        monthlyRent: 5000,
        depositMoney: 0,
      };
      const active = { ...contract, status: ContractStatus.ACTIVE };
      vi.spyOn(service, "getDetail").mockResolvedValue(contract as any);
      prismaService.tx.contract.findUnique.mockResolvedValue(null);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.room.findFirst.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.contract.updateMany.mockResolvedValue({ count: 1 });
      prismaService.tx.contract.findFirst.mockResolvedValue(active);
      prismaService.tx.room.update.mockResolvedValue({ id: "r1", status: RoomStatus.OCCUPIED });
      prismaService.tx.roomHold = {
        findFirst: vi.fn().mockResolvedValue({ id: "zero-hold" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      };
      prismaService.tx.invoice.findFirst.mockResolvedValue({
        id: "entry-zero",
        contractId: contract.id,
        customerId: contract.customerId,
        rentalCycleId: contract.rentalCycleId,
        billingKind: "ENTRY",
        status: InvoiceStatus.PAID,
        total: 5000,
        paidAmount: 5000,
        creditAmount: 0,
        items: [],
      });
      mockLockedContract(contract);

      await expect(
        service.activateContract(contract.id, "user-1", "t1", "activate-zero-security"),
      ).resolves.toMatchObject({ id: contract.id, status: ContractStatus.ACTIVE });

      expect(prismaService.tx.deposit.findFirst).not.toHaveBeenCalled();
      expect(prismaService.tx.depositLedgerEntry.aggregate).not.toHaveBeenCalled();
      expect(prismaService.tx.deposit.update).not.toHaveBeenCalled();
      expect(prismaService.tx.invoice.create).not.toHaveBeenCalled();
      expect(prismaService.tx.roomHold.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ depositId: null }),
      }));
      expect(prismaService.tx.roomHold.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ depositId: null }),
      }));
    });

    it("should throw BadRequestException if contract is not APPROVED", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        status: ContractStatus.PENDING_APPROVAL,
      } as any);
      await expect(
        service.activateContract(
          "c1",
          "user1",
          undefined,
          "activate-invalid-status",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an immediate rental when its canonical ENTRY invoice is unpaid", async () => {
      const contract = {
        ...activationReadyFields(),
        id: "c-immediate-unpaid",
        tenantId: "t1",
        customerId: "cu1",
        roomId: "r1",
        status: ContractStatus.APPROVED,
        monthlyRent: 5000,
        depositMoney: 0,
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(contract as any);
      prismaService.tx.contract.findUnique.mockResolvedValue(null);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1", status: RoomStatus.RESERVED,
      });
      prismaService.tx.room.findFirst.mockResolvedValue({
        id: "r1", status: RoomStatus.RESERVED,
      });
      prismaService.tx.invoice.findFirst.mockResolvedValue({
        id: "entry-unpaid",
        status: InvoiceStatus.ISSUED,
        total: 5000,
        paidAmount: 0,
        creditAmount: 0,
      });
      mockLockedContract(contract);

      await expect(
        service.activateContract(contract.id, "user-1", "t1", "activate-immediate-unpaid"),
      ).rejects.toThrow("CONTRACT_ENTRY_INVOICE_UNPAID");
      expect(prismaService.tx.contract.updateMany).not.toHaveBeenCalled();
      expect(prismaService.tx.room.update).not.toHaveBeenCalled();
    });

    it("hides a contract that does not belong to the authenticated tenant", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        tenantId: "tenant-b",
        status: ContractStatus.APPROVED,
      } as any);

      await expect(
        service.activateContract(
          "c1",
          "user1",
          "tenant-a",
          "activate-wrong-tenant",
        ),
      ).rejects.toThrow("not found");
      expect(prismaService.tx.room.findUnique).not.toHaveBeenCalled();
    });

    it("should throw ConflictException if room is not RESERVED", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        status: ContractStatus.APPROVED,
        roomId: "r1",
        depositMoney: 1000,
      };
      const mockRoom = { id: "r1", status: RoomStatus.AVAILABLE };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);

      await expect(
        service.activateContract(
          "c1",
          "user1",
          undefined,
          "activate-room-invalid",
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw BadRequestException if deposit is missing", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        status: ContractStatus.APPROVED,
        roomId: "r1",
        depositMoney: 1000,
      };
      const mockRoom = { id: "r1", status: RoomStatus.RESERVED };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);
      prismaService.tx.deposit.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.activateContract(
          "c1",
          "user1",
          undefined,
          "activate-deposit-missing",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if deposit is not PAID", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        status: ContractStatus.APPROVED,
        roomId: "r1",
        depositMoney: 1000,
      };
      const mockRoom = { id: "r1", status: RoomStatus.RESERVED };
      const mockDeposit = { id: "d1", status: "PENDING" };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);
      prismaService.tx.deposit.findFirst = vi
        .fn()
        .mockResolvedValue(mockDeposit);

      await expect(
        service.activateContract(
          "c1",
          "user1",
          undefined,
          "activate-deposit-invalid",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects activation when the immutable deposit ledger is below the required security deposit", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        rentalCycleId: "cycle-1",
        status: ContractStatus.APPROVED,
        depositMoney: 1000,
        monthlyRent: 5000,
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.room.findFirst.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.deposit.findFirst = vi
        .fn()
        .mockResolvedValue({ id: "d1", status: "PAID" });
      prismaService.tx.depositLedgerEntry = {
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 999 } }),
      };
      mockLockedContract(mockContract);

      await expect(
        service.activateContract(
          "c1",
          "user1",
          "t1",
          "activate-ledger-insufficient",
        ),
      ).rejects.toThrow("CONTRACT_SECURITY_DEPOSIT_BALANCE_INSUFFICIENT");
      expect(prismaService.tx.contract.update).not.toHaveBeenCalled();
    });

    it("rejects activation when the rental cycle no longer owns an active hold", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        rentalCycleId: "cycle-1",
        status: ContractStatus.APPROVED,
        depositMoney: 1000,
        monthlyRent: 5000,
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.room.findFirst.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.deposit.findFirst = vi
        .fn()
        .mockResolvedValue({ id: "d1", status: "PAID" });
      prismaService.tx.depositLedgerEntry = {
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 1000 } }),
      };
      prismaService.tx.roomHold = {
        findFirst: vi.fn().mockResolvedValue(null),
      };
      mockLockedContract(mockContract);

      await expect(
        service.activateContract("c1", "user1", "t1", "activate-hold-missing"),
      ).rejects.toThrow("CONTRACT_ACTIVE_HOLD_REQUIRED");
      expect(prismaService.tx.contract.update).not.toHaveBeenCalled();
    });

    it("rejects a shared-room activation that would exceed open occupancy capacity", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        rentalCycleId: "cycle-1",
        status: ContractStatus.APPROVED,
        depositMoney: 1000,
        monthlyRent: 5000,
        memberCount: 2,
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.OCCUPIED,
        rentalType: "SHARED",
        capacity: 3,
      });
      prismaService.tx.room.findFirst.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.OCCUPIED,
        rentalType: "SHARED",
        capacity: 3,
      });
      prismaService.tx.deposit.findFirst = vi
        .fn()
        .mockResolvedValue({ id: "d1", status: "PAID" });
      prismaService.tx.depositLedgerEntry = {
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 1000 } }),
      };
      prismaService.tx.roomHold = {
        findFirst: vi.fn().mockResolvedValue({ id: "hold-1" }),
      };
      prismaService.tx.occupancy.count = vi.fn().mockResolvedValue(2);
      mockLockedContract(mockContract);

      await expect(
        service.activateContract(
          "c1",
          "user1",
          "t1",
          "activate-capacity-exceeded",
        ),
      ).rejects.toThrow("ROOM_SHARED_CAPACITY_EXCEEDED");
      expect(prismaService.tx.contract.updateMany).not.toHaveBeenCalled();
      expect(
        prismaService.tx.$queryRaw.mock.invocationCallOrder[0],
      ).toBeLessThan(
        prismaService.tx.occupancy.count.mock.invocationCallOrder[0],
      );
    });

    it("returns the existing ACTIVE contract when the same activation key is retried", async () => {
      const activeContract = {
        id: "c1",
        tenantId: "t1",
        status: ContractStatus.ACTIVE,
        activationIdempotencyKey: "activate-c1-retry",
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(activeContract as any);

      await expect(
        service.activateContract("c1", "user1", "t1", "activate-c1-retry"),
      ).resolves.toEqual(activeContract);
      expect(prismaService.tx.room.findUnique).not.toHaveBeenCalled();
      expect(prismaService.tx.$transaction).not.toHaveBeenCalled();
    });

    it("rejects an activation key that already belongs to another contract", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        tenantId: "t1",
        status: ContractStatus.APPROVED,
      } as any);
      prismaService.tx.contract.findUnique.mockResolvedValue({ id: "c-other" });

      await expect(
        service.activateContract("c1", "user1", "t1", "activate-key-reused"),
      ).rejects.toThrow("CONTRACT_ACTIVATION_IDEMPOTENCY_KEY_REUSED");
      expect(prismaService.tx.room.findUnique).not.toHaveBeenCalled();
    });

    it("rejects activation if the locked contract left APPROVED before the claim", async () => {
      const snapshot = {
        ...activationReadyFields(),
        id: "c-stale",
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        status: ContractStatus.APPROVED,
        depositMoney: 0,
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(snapshot as any);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1",
        status: RoomStatus.RESERVED,
      });
      mockLockedContract({ ...snapshot, status: ContractStatus.CANCELLED });

      await expect(
        service.activateContract(snapshot.id, "user-1", "t1", "activate-stale-state"),
      ).rejects.toThrow("CONTRACT_ACTIVATION_STATE_CHANGED");
      expect(prismaService.tx.room.update).not.toHaveBeenCalled();
      expect(prismaService.tx.invoice.create).not.toHaveBeenCalled();
    });

    it("allows only one activation claim when another request changed the state first", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        rentalCycleId: undefined,
        status: ContractStatus.APPROVED,
        depositMoney: 1000,
        monthlyRent: 5000,
      };
      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.room.findFirst.mockResolvedValue({
        id: "r1",
        code: "101",
        status: RoomStatus.RESERVED,
      });
      prismaService.tx.deposit.findFirst.mockResolvedValue({
        id: "d1",
        status: "PAID",
      });
      prismaService.tx.depositLedgerEntry = {
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 1000 } }),
      };
      prismaService.tx.invoice.findFirst.mockResolvedValue({
        id: "entry-competing",
        contractId: mockContract.id,
        customerId: mockContract.customerId,
        rentalCycleId: mockContract.rentalCycleId,
        billingKind: "ENTRY",
        status: InvoiceStatus.PAID,
        total: 5000,
        paidAmount: 5000,
        creditAmount: 0,
        items: [],
      });
      prismaService.tx.contract.updateMany.mockResolvedValue({ count: 0 });
      prismaService.tx.contract.findFirst.mockResolvedValue({
        ...mockContract,
        status: ContractStatus.ACTIVE,
        activationIdempotencyKey: "another-request-key",
      });
      mockLockedContract(mockContract);

      await expect(
        service.activateContract("c1", "user1", "t1", "activate-c1-competing"),
      ).rejects.toThrow("CONTRACT_ACTIVATION_CONCURRENT_CONFLICT");
      expect(prismaService.tx.room.update).not.toHaveBeenCalled();
      expect(prismaService.tx.invoice.create).not.toHaveBeenCalled();
    });

    it("rejects activation until the contract has a valid signature timestamp", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        tenantId: "t1",
        status: ContractStatus.APPROVED,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      } as any);

      await expect(
        service.activateContract("c1", "user1", "t1", "activate-unsigned"),
      ).rejects.toThrow("CONTRACT_SIGNATURE_REQUIRED");
      expect(prismaService.tx.room.findUnique).not.toHaveBeenCalled();
    });

    it("rejects activation before the contract start date", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        tenantId: "t1",
        status: ContractStatus.APPROVED,
        signedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      } as any);

      await expect(
        service.activateContract("c1", "user1", "t1", "activate-too-early"),
      ).rejects.toThrow("CONTRACT_START_DATE_IN_FUTURE");
      expect(prismaService.tx.room.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("first billing period", () => {
    it("prorates the remaining calendar days for a mid-month or leap-year move-in", () => {
      expect(
        calculateFirstBillingPeriod(2900000, "2028-02-15T00:00:00.000Z"),
      ).toMatchObject({
        amount: 1500000,
        billableDays: 15,
        daysInMonth: 29,
        period: "2028-02",
        policyVersion: "ACTUAL_DAYS_V1",
      });
    });
  });

  describe("prepareImmediateEntryBilling", () => {
    const approvedContract = {
      id: "immediate-1",
      tenantId: "tenant-1",
      customerId: "customer-1",
      roomId: "room-1",
      rentalCycleId: "cycle-1",
      code: "HD-THUE-IMMEDIATE",
      status: ContractStatus.APPROVED,
      monthlyRent: 4_000_000,
      startDate: new Date("2026-09-29T00:00:00.000Z"),
      firstPaymentDate: new Date("2026-09-29T00:00:00.000Z"),
      termsSnapshot: {},
    };

    it("issues one prorated canonical ENTRY invoice and provisions its payment request", async () => {
      prismaService.tx.contract.findFirst.mockResolvedValue(approvedContract);
      prismaService.tx.invoice.findFirst.mockResolvedValue(null);
      const invoice = {
        id: "entry-immediate-1",
        contractId: approvedContract.id,
        customerId: approvedContract.customerId,
        rentalCycleId: approvedContract.rentalCycleId,
        billingKind: "ENTRY",
        status: InvoiceStatus.ISSUED,
        total: 266667,
        paidAmount: 0,
        creditAmount: 0,
      };
      prismaService.tx.invoice.create.mockResolvedValue(invoice);
      const createInvoiceRequest = vi.fn().mockResolvedValue({
        id: "payment-request-1",
        sourceId: invoice.id,
      });
      (service as any).paymentsService = { createInvoiceRequest };

      const result = await service.prepareImmediateEntryBilling(
        approvedContract.id,
        "user-1",
        approvedContract.tenantId,
      );

      expect(prismaService.tx.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: InvoiceStatus.ISSUED,
          billingKind: "ENTRY",
          baseInvoiceKey: "ENTRY:immediate-1:2026-09",
          total: 266667,
          items: {
            create: [
              expect.objectContaining({
                type: "RENT",
                amount: 266667,
                unitPrice: 266667,
                servicePeriod: "2026-09",
              }),
            ],
          },
        }),
      });
      expect(createInvoiceRequest).toHaveBeenCalledWith(invoice.id, "user-1");
      expect(result).toMatchObject({
        entryInvoice: invoice,
        entryPaymentRequest: { id: "payment-request-1" },
      });
    });

    it("combines first rent and security into one immediate-entry payment", async () => {
      const contract = {
        ...approvedContract,
        id: "immediate-combined",
        code: "HD-THUE-IMMEDIATE-COMBINED",
        depositMoney: 8_000_000,
      };
      const securityDeposit = {
        id: "security-immediate",
        tenantId: contract.tenantId,
        contractId: contract.id,
        customerId: contract.customerId,
        roomId: contract.roomId,
        rentalCycleId: contract.rentalCycleId,
        type: DepositType.SECURITY,
        amount: 8_000_000,
        status: DepositStatus.PENDING,
      };
      prismaService.tx.contract.findFirst.mockResolvedValue(contract);
      prismaService.tx.deposit.findFirst.mockResolvedValue(securityDeposit);
      prismaService.tx.invoice.findFirst.mockResolvedValue(null);
      const invoice = {
        id: "entry-immediate-combined",
        code: "INV-ENTRY-HD-THUE-IMMEDIATE-COMBINED",
        contractId: contract.id,
        customerId: contract.customerId,
        rentalCycleId: contract.rentalCycleId,
        billingKind: "ENTRY",
        status: InvoiceStatus.ISSUED,
        dueDate: contract.firstPaymentDate,
        total: 8_266_667,
        paidAmount: 0,
        creditAmount: 0,
      };
      prismaService.tx.invoice.create.mockResolvedValue(invoice);
      const createInvoiceRequest = vi.fn().mockResolvedValue({ id: "payment-request-combined" });
      (service as any).paymentsService = { createInvoiceRequest };

      const result = await service.prepareImmediateEntryBilling(contract.id, "user-1", contract.tenantId);

      expect(prismaService.tx.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          total: 8_266_667,
          subtotal: 8_266_667,
          items: {
            create: [
              expect.objectContaining({ type: "RENT", amount: 266_667 }),
              expect.objectContaining({
                type: "OTHER",
                amount: 8_000_000,
                servicePeriod: "ENTRY_SECURITY:security-immediate",
              }),
            ],
          },
        }),
      });
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: contract.id, tenantId: contract.tenantId },
        data: {
          termsSnapshot: expect.objectContaining({
            initialEntryInvoice: expect.objectContaining({
              invoiceId: invoice.id,
              amount: 8_266_667,
              rentAmount: 266_667,
              securityRequired: 8_000_000,
              additionalCashRequired: 8_000_000,
              paymentPolicyVersion: COMBINED_ENTRY_POLICY,
            }),
          }),
        },
      }));
      expect(createInvoiceRequest).toHaveBeenCalledWith(invoice.id, "user-1");
      expect(result).toMatchObject({ paymentRequestId: "payment-request-combined" });
    });

    it("does not issue a combined entry that would collect an already-funded security deposit twice", async () => {
      const contract = {
        ...approvedContract,
        id: "immediate-funded-security",
        depositMoney: 8_000_000,
      };
      prismaService.tx.contract.findFirst.mockResolvedValue(contract);
      prismaService.tx.deposit.findFirst.mockResolvedValue({
        id: "security-funded",
        tenantId: contract.tenantId,
        contractId: contract.id,
        customerId: contract.customerId,
        roomId: contract.roomId,
        rentalCycleId: contract.rentalCycleId,
        type: DepositType.SECURITY,
        amount: 8_000_000,
      });
      prismaService.tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 8_000_000 } });

      await expect(service.prepareImmediateEntryBilling(contract.id, "user-1", contract.tenantId))
        .rejects.toThrow("IMMEDIATE_ENTRY_SECURITY_ALREADY_FUNDED");
      expect(prismaService.tx.invoice.create).not.toHaveBeenCalled();
    });

    it("allows a DRAFT immediate rental to create once and reuse the same ENTRY on retry", async () => {
      const draft = { ...approvedContract, status: ContractStatus.DRAFT };
      const invoice = {
        id: "entry-immediate-draft",
        contractId: draft.id,
        customerId: draft.customerId,
        rentalCycleId: draft.rentalCycleId,
        billingKind: "ENTRY",
        baseInvoiceKey: "ENTRY:immediate-1:2026-09",
        status: InvoiceStatus.ISSUED,
        total: 4_000_000,
        paidAmount: 0,
        creditAmount: 0,
        items: [],
      };
      prismaService.tx.contract.findFirst.mockResolvedValue(draft);
      prismaService.tx.invoice.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(invoice);
      prismaService.tx.invoice.create.mockResolvedValue(invoice);
      const createInvoiceRequest = vi.fn().mockResolvedValue({
        id: "payment-request-draft",
      });
      (service as any).paymentsService = { createInvoiceRequest };

      await service.prepareImmediateEntryBilling(draft.id, "user-1", draft.tenantId);
      await service.prepareImmediateEntryBilling(draft.id, "user-1", draft.tenantId);

      expect(prismaService.tx.invoice.create).toHaveBeenCalledTimes(1);
      expect(createInvoiceRequest).toHaveBeenCalledTimes(2);
      expect(prismaService.tx.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: InvoiceStatus.ISSUED,
          baseInvoiceKey: "ENTRY:immediate-1:2026-09",
        }),
      });
    });

    it("reuses the existing canonical ENTRY invoice on a retry", async () => {
      const invoice = {
        id: "entry-immediate-1",
        contractId: approvedContract.id,
        customerId: approvedContract.customerId,
        rentalCycleId: approvedContract.rentalCycleId,
        billingKind: "ENTRY",
        baseInvoiceKey: "ENTRY:immediate-1:2026-09",
        status: InvoiceStatus.ISSUED,
        total: 4_000_000,
        paidAmount: 0,
        creditAmount: 0,
        items: [],
      };
      prismaService.tx.contract.findFirst.mockResolvedValue(approvedContract);
      prismaService.tx.invoice.findFirst.mockResolvedValue(invoice);
      const createInvoiceRequest = vi.fn().mockResolvedValue({ id: "payment-request-1" });
      (service as any).paymentsService = { createInvoiceRequest };

      await expect(
        service.prepareImmediateEntryBilling(
          approvedContract.id,
          "user-1",
          approvedContract.tenantId,
        ),
      ).resolves.toMatchObject({ entryInvoice: { id: invoice.id } });

      expect(prismaService.tx.invoice.create).not.toHaveBeenCalled();
      expect(createInvoiceRequest).toHaveBeenCalledWith(invoice.id, "user-1");
    });
  });

  describe("terminateContract", () => {
    it("should terminate an ACTIVE contract without creating a zero-value settlement invoice", async () => {
      const mockContract = {
        id: "c1",
        code: "C-001",
        status: ContractStatus.ACTIVE,
        roomId: "r1",
        tenantId: "t1",
        customerId: "cu1",
        coRepresentativeIds: ["cu2"],
        monthlyRent: 9000,
      };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.TERMINATED,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);

      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.AVAILABLE,
      });
      prismaService.tx.invoice.create = vi.fn();

      const result = await service.terminateContract("c1", "user1");

      expect(prismaService.tx.$transaction).toHaveBeenCalled();

      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: expect.objectContaining({
          status: ContractStatus.TERMINATED,
          actualMoveOutAt: expect.any(Date),
          customerSnapshot: expect.objectContaining({ id: "cu1" }),
          roomSnapshot: expect.objectContaining({ id: "r1" }),
          termsSnapshot: expect.objectContaining({ code: "C-001" }),
        }),
      });
      expect(prismaService.tx.customer.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: "t1",
          id: { in: ["cu1", "cu2"] },
          roomId: "r1",
          AND: expect.any(Array),
        }),
        data: { roomId: null },
      });
      expect(prismaService.tx.occupancy.updateMany).toHaveBeenCalledWith({
        where: { tenantId: "t1", roomId: "r1", contractId: "c1", leftAt: null },
        data: {
          leftAt: expect.any(Date),
          leaveReason: "Trả phòng và quyết toán hợp đồng",
        },
      });
      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { status: RoomStatus.AVAILABLE },
      });
      expect(prismaService.tx.invoice.create).not.toHaveBeenCalled();
      expect(prismaService.tx.contractSettlement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId: "c1" },
          create: expect.objectContaining({
            tenantId: "t1",
            contractId: "c1",
            chargeTotal: 0,
            creditTotal: 0,
          }),
        }),
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE",
          entityId: "c1",
          after: expect.objectContaining({
            ...updatedContract,
            settlement: expect.objectContaining({
              totals: expect.objectContaining({
                chargeTotal: 0,
                creditTotal: 0,
              }),
            }),
          }),
        }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "contract.settlement.completed",
        expect.objectContaining({
          sourceId: "c1",
          sourceType: "CONTRACT",
          amount: 0,
        }),
      );
      expect(result).toEqual(updatedContract);
    });

    it("should keep the room occupied and only detach the finalized contract party when another active-like contract remains", async () => {
      const mockContract = {
        id: "c1",
        code: "C-SHARED-1",
        status: ContractStatus.ACTIVE,
        roomId: "r1",
        tenantId: "t1",
        customerId: "cu1",
        coRepresentativeIds: [],
        monthlyRent: 3500,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.contract.count.mockResolvedValue(1);
      prismaService.tx.contract.update.mockResolvedValue({
        ...mockContract,
        status: ContractStatus.TERMINATED,
      });
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.OCCUPIED,
      });
      prismaService.tx.invoice.create = vi.fn();

      await service.terminateContract("c1", "user1");

      expect(prismaService.tx.customer.updateMany).toHaveBeenCalledTimes(1);
      expect(prismaService.tx.customer.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: "t1",
          id: { in: ["cu1"] },
          roomId: "r1",
          AND: expect.any(Array),
        }),
        data: { roomId: null },
      });
      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { status: RoomStatus.OCCUPIED },
      });
    });

    it("should create itemized settlement invoice when termination input is provided", async () => {
      const mockContract = {
        id: "c1",
        code: "C-002",
        status: ContractStatus.ACTIVE,
        roomId: "r1",
        tenantId: "t1",
        customerId: "cu1",
        monthlyRent: 9000,
        depositMoney: 500,
      };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.TERMINATED,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.CLEANING,
      });
      prismaService.tx.invoice.create = vi
        .fn()
        .mockResolvedValue({ id: "inv2" });
      prismaService.tx.receipt.create.mockResolvedValue({
        id: "rcpt-1",
        code: "RCT-C-002-1",
        amount: 500,
        status: "COMPLETED",
      });

      await service.terminateContract("c1", "user1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 10,
        electricityAmount: 250,
        waterAmount: 100,
        depositToRefund: 500,
      });

      expect(prismaService.tx.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractId: "c1",
            status: "ISSUED",
            subtotal: 3350,
            total: 3350,
            creditAmount: 500,
            items: {
              create: [
                expect.objectContaining({
                  type: "RENT",
                  amount: 3000,
                  description: "Tiền thuê phát sinh (10 ngày)",
                }),
                expect.objectContaining({
                  type: "UTILITY_ELECTRICITY",
                  amount: 250,
                }),
                expect.objectContaining({
                  type: "UTILITY_WATER",
                  amount: 100,
                }),
              ],
            },
          }),
        }),
      );
      expect(prismaService.tx.receipt.create).not.toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "contract.settlement.completed",
        expect.objectContaining({
          sourceId: "c1",
          sourceType: "CONTRACT",
          amount: 2850,
        }),
      );
      expect(eventPublisher.publish).not.toHaveBeenCalledWith(
        "contract.settlement.refunded",
        expect.anything(),
      );
    });

    it("should not create an invoice when settlement charges are fully covered by credits", async () => {
      const mockContract = {
        id: "c1",
        code: "C-FULL-CREDIT",
        status: ContractStatus.ACTIVE,
        roomId: "r1",
        tenantId: "t1",
        customerId: "cu1",
        monthlyRent: 9000,
        depositMoney: 1000,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue({
        ...mockContract,
        status: ContractStatus.TERMINATED,
      });
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.CLEANING,
      });
      prismaService.tx.invoice.create = vi.fn();

      await service.terminateContract("c1", "user1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 1,
        depositToDeduct: 300,
      });

      expect(prismaService.tx.invoice.create).not.toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "deposit.deducted",
        expect.objectContaining({
          amount: 300,
          metadata: expect.objectContaining({ invoiceId: null }),
        }),
      );
    });

    it("should publish an accounting adjustment when deposit is applied to settlement debt", async () => {
      const mockContract = {
        id: "c1",
        code: "C-DEPOSIT-APPLIED",
        status: ContractStatus.ACTIVE,
        roomId: "r1",
        tenantId: "t1",
        customerId: "cu1",
        monthlyRent: 9000,
        depositMoney: 1000,
        customer: { fullName: "Khach A", phone: "0909000001" },
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue({
        ...mockContract,
        status: ContractStatus.TERMINATED,
      });
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.CLEANING,
      });
      prismaService.tx.invoice.create.mockResolvedValue({
        id: "inv-settlement-1",
      });

      await service.terminateContract("c1", "user1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 2,
        depositToDeduct: 300,
      });

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "deposit.deducted",
        expect.objectContaining({
          sourceId: "c1",
          sourceType: "ADJUSTMENT",
          amount: 300,
          metadata: expect.objectContaining({
            adjustmentType: "DEPOSIT_SETTLEMENT_APPLICATION",
            contractId: "c1",
            invoiceId: "inv-settlement-1",
          }),
        }),
      );
    });

    it("should create a completed refund receipt when settlement credits exceed charges", async () => {
      const mockContract = {
        id: "c1",
        code: "C-REFUND",
        status: ContractStatus.ACTIVE,
        roomId: "r1",
        tenantId: "t1",
        customerId: "cu1",
        customer: { fullName: "Khach A", phone: "0901" },
        monthlyRent: 9000,
        depositMoney: 800,
      };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.TERMINATED,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.CLEANING,
      });
      prismaService.tx.invoice.create = vi
        .fn()
        .mockResolvedValue({ id: "inv3" });
      prismaService.tx.receipt.create.mockResolvedValue({
        id: "rcpt-1",
        code: "RCT-C-REFUND-1",
        amount: 500,
        status: "COMPLETED",
      });

      await service.terminateContract("c1", "user1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 1,
        depositToRefund: 800,
      });

      expect(prismaService.tx.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: "t1",
            amount: 500,
            status: "COMPLETED",
            description: "Contract settlement refund for C-REFUND",
          }),
        }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "contract.settlement.refunded",
        expect.objectContaining({
          amount: 500,
          sourceId: "c1",
          sourceType: "REFUND",
          metadata: expect.objectContaining({
            accountingBreakdown: expect.objectContaining({
              depositRefundAmount: 500,
              revenueRefundAmount: 0,
            }),
          }),
        }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "contract.settlement.completed",
        expect.objectContaining({
          sourceId: "c1",
          sourceType: "CONTRACT",
          amount: 0,
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CREATE",
          entity: "Receipt",
          entityId: "rcpt-1",
        }),
      );
    });

    it("should create a pending refund receipt and follow-up task when refund is not confirmed yet", async () => {
      const mockContract = {
        id: "c1",
        code: "C-REFUND-PENDING",
        status: ContractStatus.ACTIVE,
        roomId: "r1",
        tenantId: "t1",
        customerId: "cu1",
        customer: { fullName: "Khach A", phone: "0901" },
        monthlyRent: 9000,
        depositMoney: 800,
      };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.TERMINATED,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.CLEANING,
      });
      prismaService.tx.invoice.create = vi
        .fn()
        .mockResolvedValue({ id: "inv4" });
      prismaService.tx.receipt.create.mockResolvedValue({
        id: "rcpt-2",
        code: "RCT-C-REFUND-PENDING-1",
        amount: 500,
        status: "PENDING",
      });
      prismaService.tx.task.create.mockResolvedValue({
        id: "task-1",
        title: "Xu ly hoan tien quyet toan C-REFUND-PENDING",
        status: "TODO",
      });

      await service.terminateContract("c1", "user1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 1,
        depositToRefund: 800,
        refundReceiptStatus: "PENDING",
        refundReason: "Chờ chuyển khoản",
        refundAttachmentUrls: ["https://example.test/refund-proof.pdf"],
      });

      expect(prismaService.tx.receipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "PENDING",
            description:
              "Contract settlement refund for C-REFUND-PENDING - Chờ chuyển khoản",
          }),
        }),
      );
      expect(prismaService.tx.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: "t1",
            status: "TODO",
            priority: "HIGH",
          }),
        }),
      );
      expect(eventPublisher.publish).not.toHaveBeenCalledWith(
        "contract.settlement.refunded",
        expect.anything(),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "contract.settlement.completed",
        expect.objectContaining({
          metadata: expect.objectContaining({
            settlement: expect.objectContaining({
              refund: expect.objectContaining({
                receiptStatus: "PENDING",
                reason: "Chờ chuyển khoản",
                attachmentUrls: ["https://example.test/refund-proof.pdf"],
              }),
            }),
          }),
        }),
      );
    });

    it("should move room to maintenance when settlement indicates maintenance turnover", async () => {
      const mockContract = {
        id: "c1",
        code: "C-MAINT",
        status: ContractStatus.ACTIVE,
        roomId: "r1",
        tenantId: "t1",
        customerId: "cu1",
        monthlyRent: 9000,
      };
      const updatedContract = {
        ...mockContract,
        status: ContractStatus.TERMINATED,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.MAINTENANCE,
      });
      prismaService.tx.invoice.create = vi
        .fn()
        .mockResolvedValue({ id: "inv4" });

      await service.terminateContract("c1", "user1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        roomTurnoverStatus: "MAINTENANCE",
        rentDaysCharged: 0,
      });

      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { status: RoomStatus.MAINTENANCE },
      });
    });

    it("should throw BadRequestException if contract is not ACTIVE or EXPIRING", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        status: ContractStatus.DRAFT,
      } as any);
      await expect(service.terminateContract("c1", "user1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("previewSettlement", () => {
    beforeEach(() => {
      prismaService.tx.invoice.findMany = vi.fn().mockResolvedValue([]);
      prismaService.tx.deposit.findMany = vi.fn().mockResolvedValue([{ id: "dep-preview" }]);
      prismaService.tx.depositLedgerEntry = {
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 1000 } }),
      };
    });
    it("should calculate settlement totals from explicit inputs", async () => {
      const mockContract = {
        id: "c1",
        code: "C-003",
        status: ContractStatus.ACTIVE,
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        monthlyRent: 12000,
        depositMoney: 1000,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);

      prismaService.tx.contract.findFirst.mockResolvedValue({ ...mockContract, rentalCycleId: "cycle-1", customer: {}, room: {} });
      prismaService.tx.rentalCycle.findFirst.mockResolvedValue({ id: "cycle-1" });
      const result = await service.previewSettlement("c1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 5,
        electricityAmount: 300,
        waterAmount: 120,
        serviceAmount: 80,
        roomRefundAmount: 400,
        depositToRefund: 1000,
        note: "preview",
      }, "t1");

      expect(result.assumptions.monthlyRent).toBe(12000);
      expect(result.assumptions.dailyRent).toBe(400);
      expect(result.totals.chargeTotal).toBe(2500);
      expect(result.totals.creditTotal).toBe(1400);
      expect(result.totals.netReceivable).toBe(1100);
      expect(result.totals.refundToCustomer).toBe(0);
      expect(result.accountingBreakdown).toMatchObject({
        operationalCreditTotal: 400,
        depositCreditTotal: 1000,
        depositAppliedAmount: 1000,
        depositRefundAmount: 0,
        revenueRefundAmount: 0,
      });
      expect(result.invoiceItems).toHaveLength(4);
      expect(result.utilitySnapshot).toEqual({
        electricity: null,
        water: expect.objectContaining({
          amount: 120,
          source: "MANUAL_AMOUNT",
        }),
      });
    });

    it("should calculate water from readings and unit price for settlement preview", async () => {
      const mockContract = {
        id: "c1",
        code: "C-WATER",
        status: ContractStatus.ACTIVE,
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        monthlyRent: 12000,
        depositMoney: 1000,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);

      prismaService.tx.contract.findFirst.mockResolvedValue({ ...mockContract, rentalCycleId: "cycle-1", customer: {}, room: {} });
      prismaService.tx.rentalCycle.findFirst.mockResolvedValue({ id: "cycle-1" });
      const result = await service.previewSettlement("c1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 0,
        waterPreviousReading: 120,
        waterCurrentReading: 128,
        waterUnitPrice: 25000,
      }, "t1");

      expect(result.utilitySnapshot.water).toEqual(
        expect.objectContaining({
          previousReading: 120,
          currentReading: 128,
          usage: 8,
          unitPrice: 25000,
          amount: 200000,
          source: "MANUAL_READING",
        }),
      );
      expect(result.invoiceItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "UTILITY_WATER",
            amount: 200000,
          }),
        ]),
      );
    });

    it("should treat deposit deduction as a credit instead of an extra charge", async () => {
      const mockContract = {
        id: "c1",
        code: "C-DEDUCT",
        status: ContractStatus.ACTIVE,
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        monthlyRent: 12000,
        depositMoney: 1000,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);

      prismaService.tx.contract.findFirst.mockResolvedValue({ ...mockContract, rentalCycleId: "cycle-1", customer: {}, room: {} });
      prismaService.tx.rentalCycle.findFirst.mockResolvedValue({ id: "cycle-1" });
      const result = await service.previewSettlement("c1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 1,
        depositToDeduct: 300,
      }, "t1");

      expect(result.totals.chargeTotal).toBe(400);
      expect(result.totals.creditTotal).toBe(300);
      expect(result.totals.netReceivable).toBe(100);
      expect(result.credits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "depositToDeduct",
            amount: 300,
          }),
        ]),
      );
      expect(result.invoiceItems).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            description: "Deposit deduction against debt",
          }),
        ]),
      );
    });

    it("should reject settlement when deposit refund and deduction exceed deposit balance", async () => {
      const mockContract = {
        id: "c1",
        code: "C-DEPOSIT-LIMIT",
        status: ContractStatus.ACTIVE,
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        monthlyRent: 12000,
        depositMoney: 500,
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);

      prismaService.tx.contract.findFirst.mockResolvedValue({ ...mockContract, rentalCycleId: "cycle-1", customer: {}, room: {} });
      prismaService.tx.rentalCycle.findFirst.mockResolvedValue({ id: "cycle-1" });
      prismaService.tx.depositLedgerEntry.aggregate.mockResolvedValue({ _sum: { balanceEffect: 500 } });
      await expect(
        service.previewSettlement("c1", {
          actualMoveOutDate: "2026-08-10T00:00:00.000Z",
          rentDaysCharged: 0,
          depositToRefund: 300,
          depositToDeduct: 300,
        }, "t1"),
      ).rejects.toThrow("SETTLEMENT_DEPOSIT_BALANCE_INSUFFICIENT");
    });

    it("should use Hunonic snapshot electricity amount when operator leaves electricity blank", async () => {
      const mockContract = {
        id: "c1",
        code: "C-004",
        status: ContractStatus.ACTIVE,
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        monthlyRent: 12000,
      };

      prismaService.hunonicMeterMapping.findFirst.mockResolvedValue({
        id: "meter-1",
        providerMeterId: "provider-1",
        displayName: "31-04",
        deviceName: "ĐIỆN 31.04",
        lastStatus: "on",
        lastReadingKwh: 42,
        lastAmountVnd: 147000,
        lastSyncedAt: new Date("2026-08-09T09:00:00.000Z"),
        readings: [
          {
            energyMonthKwh: 42,
            moneyMonthVnd: 147000,
            powerCurrentW: 61,
            currentMonth: "2026-08",
            readingAt: new Date("2026-08-09T09:00:00.000Z"),
          },
        ],
      });
      hunonicService.getRoomElectricityPricing.mockResolvedValue({
        currentMode: "custom",
        customRateVnd: 3500,
        residentialSteps: [],
      });
      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);

      prismaService.tx.contract.findFirst.mockResolvedValue({ ...mockContract, rentalCycleId: "cycle-1", customer: {}, room: {} });
      prismaService.tx.rentalCycle.findFirst.mockResolvedValue({ id: "cycle-1" });
      const result = await service.previewSettlement("c1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 0,
      }, "t1");

      expect(result.utilitySnapshot.electricity).toEqual(
        expect.objectContaining({
          displayName: "31-04",
          monthAmountVnd: 147000,
          calculatedAmountVnd: 147000,
          rateMode: "custom",
          customRateVnd: 3500,
          currentMonth: "2026-08",
        }),
      );
      expect(result.settlementSnapshot).toEqual(
        expect.objectContaining({
          electricity: expect.objectContaining({
            monthAmountVnd: 147000,
            monthKwh: 42,
            calculatedAmountVnd: 147000,
            rateMode: "custom",
            currentMonth: "2026-08",
          }),
        }),
      );
      expect(result.invoiceItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "UTILITY_ELECTRICITY",
            amount: 147000,
          }),
        ]),
      );
    });

    it("should calculate settlement electricity by residential steps when Hunonic meter is in EVN mode", async () => {
      const mockContract = {
        id: "c1",
        code: "C-005",
        status: ContractStatus.ACTIVE,
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        monthlyRent: 12000,
      };

      prismaService.hunonicMeterMapping.findFirst.mockResolvedValue({
        id: "meter-1",
        providerMeterId: "provider-1",
        displayName: "32-01",
        deviceName: "DIEN 32.01",
        lastStatus: "on",
        lastReadingKwh: 80,
        lastAmountVnd: 999999,
        lastSyncedAt: new Date("2026-08-09T09:00:00.000Z"),
        readings: [
          {
            energyMonthKwh: 80,
            moneyMonthVnd: 999999,
            powerCurrentW: 50,
            currentMonth: "2026-08",
            readingAt: new Date("2026-08-09T09:00:00.000Z"),
          },
        ],
      });
      hunonicService.getRoomElectricityPricing.mockResolvedValue({
        currentMode: "residential",
        customRateVnd: null,
        residentialSteps: [
          { minRate: 0, maxRate: 50, price: 1800 },
          { minRate: 50, maxRate: 100, price: 2200 },
        ],
      });
      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);

      prismaService.tx.contract.findFirst.mockResolvedValue({ ...mockContract, rentalCycleId: "cycle-1", customer: {}, room: {} });
      prismaService.tx.rentalCycle.findFirst.mockResolvedValue({ id: "cycle-1" });
      const result = await service.previewSettlement("c1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 0,
      }, "t1");

      expect(result.utilitySnapshot.electricity).toEqual(
        expect.objectContaining({
          monthKwh: 80,
          monthAmountVnd: 999999,
          calculatedAmountVnd: 156000,
          rateMode: "residential",
          calculationSource: "RESIDENTIAL_STEPS",
        }),
      );
      expect(result.invoiceItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "UTILITY_ELECTRICITY",
            amount: 156000,
          }),
        ]),
      );
    });

    it("should use manual move-out electricity closing kwh for settlement snapshot and calculation", async () => {
      const mockContract = {
        id: "c1",
        code: "C-006",
        status: ContractStatus.ACTIVE,
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        monthlyRent: 12000,
      };

      prismaService.hunonicMeterMapping.findFirst.mockResolvedValue({
        id: "meter-1",
        providerMeterId: "provider-1",
        displayName: "32-01",
        deviceName: "DIEN 32.01",
        lastStatus: "on",
        lastReadingKwh: 80,
        lastAmountVnd: 999999,
        lastSyncedAt: new Date("2026-08-09T09:00:00.000Z"),
        readings: [
          {
            energyMonthKwh: 80,
            moneyMonthVnd: 999999,
            powerCurrentW: 50,
            currentMonth: "2026-08",
            readingAt: new Date("2026-08-09T09:00:00.000Z"),
          },
        ],
      });
      hunonicService.getRoomElectricityPricing.mockResolvedValue({
        currentMode: "custom",
        customRateVnd: 3500,
        residentialSteps: [],
      });
      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);

      prismaService.tx.contract.findFirst.mockResolvedValue({ ...mockContract, rentalCycleId: "cycle-1", customer: {}, room: {} });
      prismaService.tx.rentalCycle.findFirst.mockResolvedValue({ id: "cycle-1" });
      const result = await service.previewSettlement("c1", {
        actualMoveOutDate: "2026-08-10T00:00:00.000Z",
        rentDaysCharged: 0,
        electricityClosingKwh: 35,
      }, "t1");

      expect(result.utilitySnapshot.electricity).toEqual(
        expect.objectContaining({
          monthKwh: 35,
          closingKwh: 35,
          calculatedAmountVnd: 122500,
          source: "MANUAL_MOVE_OUT_READING",
        }),
      );
      expect(result.settlementSnapshot).toEqual(
        expect.objectContaining({
          capturedAt: "2026-08-10T00:00:00.000Z",
          electricity: expect.objectContaining({
            monthKwh: 35,
            closingKwh: 35,
            calculatedAmountVnd: 122500,
            source: "MANUAL_MOVE_OUT_READING",
          }),
        }),
      );
      expect(result.invoiceItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "UTILITY_ELECTRICITY",
            amount: 122500,
          }),
        ]),
      );
    });
  });

  describe("expireContract", () => {
    it("should expire an ACTIVE contract", async () => {
      const mockContract = {
        id: "c1",
        status: ContractStatus.ACTIVE,
        roomId: "r1",
        tenantId: "t1",
        customerId: "cu1",
      };
      prismaService.tx.contract.findFirst.mockResolvedValue(mockContract);
      prismaService.tx.contractSettlement.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.expireContract("c1", "user1", "t1"))
        .rejects.toThrow("CONTRACT_EXPIRY_REQUIRES_SETTLEMENT");
    });

    it("should throw BadRequestException if contract is already EXPIRED", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        status: ContractStatus.EXPIRED,
      } as any);
      await expect(service.expireContract("c1", "user1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("moveOutOccupant", () => {
    it("settles an active primary contract instead of deleting the customer or contract", async () => {
      const customer = {
        id: "cu1",
        tenantId: "t1",
        roomId: "r1",
        fullName: "Khách A",
      };
      const contract = {
        id: "c1",
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        status: ContractStatus.ACTIVE,
        coRepresentativeIds: [],
      };
      prismaService.tx.customer.findUnique.mockResolvedValue(customer);
      prismaService.tx.customer.findMany.mockResolvedValue([{ id: "cu1" }]);
      prismaService.tx.contract.findFirst.mockResolvedValue(contract);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1",
        status: RoomStatus.CLEANING,
      });
      const finalizeSpy = vi
        .spyOn(service as any, "finalizeContract")
        .mockResolvedValue({
          ...contract,
          status: ContractStatus.TERMINATED,
        });

      const result = await service.moveOutOccupant(
        {
          roomId: "r1",
          customerId: "cu1",
          contractId: "c1",
          actualMoveOutDate: "2026-09-05",
          roomTurnoverStatus: "CLEANING",
          reason: "Khách trả phòng",
        },
        "user1",
      );

      expect(finalizeSpy).toHaveBeenCalledWith(
        "c1",
        "user1",
        ContractStatus.TERMINATED,
        expect.objectContaining({
          roomTurnoverStatus: RoomStatus.CLEANING,
          note: "Khách trả phòng",
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          mode: "CONTRACT_SETTLED",
          contractId: "c1",
          contractStatus: ContractStatus.TERMINATED,
          removedCustomerIds: ["cu1"],
        }),
      );
    });

    it("falls back to the current room contract when the UI sends a stale contract id", async () => {
      const customer = {
        id: "cu1",
        tenantId: "t1",
        roomId: "r1",
        fullName: "Khách A",
      };
      const contract = {
        id: "c-current",
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        status: ContractStatus.ACTIVE,
        coRepresentativeIds: [],
      };
      prismaService.tx.customer.findUnique.mockResolvedValue(customer);
      prismaService.tx.customer.findMany.mockResolvedValue([{ id: "cu1" }]);
      prismaService.tx.contract.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(contract);
      prismaService.tx.room.findUnique.mockResolvedValue({
        id: "r1",
        status: RoomStatus.AVAILABLE,
      });
      const finalizeSpy = vi
        .spyOn(service as any, "finalizeContract")
        .mockResolvedValue({
          ...contract,
          status: ContractStatus.TERMINATED,
        });

      const result = await service.moveOutOccupant(
        {
          roomId: "r1",
          customerId: "cu1",
          contractId: "c-stale",
          actualMoveOutDate: "2026-09-05",
        },
        "user1",
      );

      expect(prismaService.tx.contract.findFirst).toHaveBeenCalledTimes(2);
      expect(finalizeSpy).toHaveBeenCalledWith(
        "c-current",
        "user1",
        ContractStatus.TERMINATED,
        expect.objectContaining({ actualMoveOutDate: expect.any(Date) }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          mode: "CONTRACT_SETTLED",
          contractId: "c-current",
        }),
      );
    });

    it("only closes occupancy for a roommate without a contract", async () => {
      const customer = {
        id: "cu2",
        tenantId: "t1",
        roomId: "r1",
        fullName: "Người ở cùng",
      };
      prismaService.tx.customer.findUnique.mockResolvedValue(customer);
      prismaService.tx.contract.findFirst.mockResolvedValue(null);
      prismaService.tx.customer.update.mockResolvedValue({
        ...customer,
        roomId: null,
      });
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.AVAILABLE,
      });

      const result = await service.moveOutOccupant(
        {
          roomId: "r1",
          customerId: "cu2",
          reason: "Chuyển chỗ ở",
        },
        "user1",
      );

      expect(prismaService.tx.occupancy.updateMany).toHaveBeenCalledWith({
        where: { roomId: "r1", customerId: "cu2", leftAt: null },
        data: expect.objectContaining({
          leaveReason: "Chuyển chỗ ở",
          leftAt: expect.any(Date),
        }),
      });
      expect(prismaService.tx.customer.update).toHaveBeenCalledWith({
        where: { id: "cu2" },
        data: { roomId: null },
      });
      expect(result.mode).toBe("ROOMMATE_DETACHED");
    });

    it("detaches a co-representative while keeping the contract active", async () => {
      const customer = {
        id: "cu2",
        tenantId: "t1",
        roomId: "r1",
        fullName: "Đồng đại diện",
      };
      const contract = {
        id: "c1",
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
        status: ContractStatus.ACTIVE,
        coRepresentativeIds: ["cu2", "cu3"],
      };
      prismaService.tx.customer.findUnique.mockResolvedValue(customer);
      prismaService.tx.contract.findFirst.mockResolvedValue(contract);
      prismaService.tx.contract.update.mockResolvedValue({
        ...contract,
        coRepresentativeIds: ["cu3"],
      });
      prismaService.tx.contract.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      prismaService.tx.customer.count.mockResolvedValue(1);
      prismaService.tx.customer.update.mockResolvedValue({
        ...customer,
        roomId: null,
      });
      prismaService.tx.room.update.mockResolvedValue({
        id: "r1",
        status: RoomStatus.OCCUPIED,
      });
      vi.spyOn(service as any, "syncContractHistory").mockResolvedValue(
        undefined,
      );

      const result = await service.moveOutOccupant(
        {
          roomId: "r1",
          customerId: "cu2",
          contractId: "c1",
        },
        "user1",
      );

      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { coRepresentativeIds: ["cu3"] },
      });
      expect(prismaService.tx.contractParty.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: "cu2",
            role: "CO_REPRESENTATIVE",
          }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          mode: "CO_REPRESENTATIVE_DETACHED",
          contractStatus: ContractStatus.ACTIVE,
          roomStatus: RoomStatus.OCCUPIED,
        }),
      );
    });
  });

  describe("softDelete history protection", () => {
    it("blocks deletion once a contract is no longer a history-free draft", async () => {
      prismaService.tx.contract.findUnique.mockResolvedValue({
        id: "c1",
        status: ContractStatus.ACTIVE,
        _count: { invoices: 1, deposits: 1 },
      });

      await expect(service.softDelete("c1", "user1")).rejects.toThrow(
        ConflictException,
      );
      expect((service as any).repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe("completePendingSettlementRefund", () => {
    it("should complete a pending settlement refund and close its follow-up task", async () => {
      const mockContract = {
        id: "c1",
        code: "C-REFUND-PENDING",
        status: ContractStatus.TERMINATED,
        tenantId: "t1",
        customerId: "cu1",
        customer: { fullName: "Khach A", phone: "0901" },
      };

      vi.spyOn(service, "getDetail").mockResolvedValue(mockContract as any);
      prismaService.receipt.findFirst.mockResolvedValue({
        id: "rcpt-1",
        tenantId: "t1",
        code: "RCT-C-REFUND-PENDING-123",
        amount: 500,
        status: "PENDING",
        description: "Contract settlement refund for C-REFUND-PENDING",
        createdAt: new Date("2026-08-10T00:00:00.000Z"),
      });
      prismaService.task.findFirst.mockResolvedValue({
        id: "task-1",
        tenantId: "t1",
        title: "Xu ly hoan tien quyet toan C-REFUND-PENDING",
        description: "Can hoan tien",
        status: "TODO",
        createdAt: new Date("2026-08-10T00:00:00.000Z"),
      });
      prismaService.tx.receipt.update = vi.fn().mockResolvedValue({
        id: "rcpt-1",
        status: "COMPLETED",
        amount: 500,
        description:
          "Contract settlement refund for C-REFUND-PENDING\nCompleted note: Da chuyen khoan",
      });
      prismaService.tx.task.update = vi.fn().mockResolvedValue({
        id: "task-1",
        status: "DONE",
        description: "Can hoan tien\nHoan tat: Da chuyen khoan",
      });
      prismaService.auditLog.findFirst.mockResolvedValue({
        after: {
          settlement: {
            accountingBreakdown: {
              depositRefundAmount: 300,
              revenueRefundAmount: 200,
            },
          },
        },
      });

      await expect(
        service.completePendingSettlementRefund(
          "c1",
          "user1",
          "Da chuyen khoan",
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          success: true,
          receiptId: "rcpt-1",
          taskId: "task-1",
          amount: 500,
        }),
      );

      expect(prismaService.tx.receipt.update).toHaveBeenCalledWith({
        where: { id: "rcpt-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
        }),
      });
      expect(prismaService.tx.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: expect.objectContaining({
          status: "DONE",
        }),
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        "contract.settlement.refunded",
        expect.objectContaining({
          sourceId: "c1",
          amount: 500,
          metadata: expect.objectContaining({
            completedFromPending: true,
            refundCompletionNote: "Da chuyen khoan",
            accountingBreakdown: {
              depositRefundAmount: 300,
              revenueRefundAmount: 200,
            },
          }),
        }),
      );
    });

    it("should throw when no pending settlement refund exists", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        code: "C-NO-PENDING",
        status: ContractStatus.TERMINATED,
        tenantId: "t1",
        customerId: "cu1",
      } as any);
      prismaService.receipt.findFirst.mockResolvedValue(null);

      await expect(
        service.completePendingSettlementRefund("c1", "user1"),
      ).rejects.toThrow("SETTLEMENT_REFUND_PENDING_NOT_FOUND");
    });
  });
});
