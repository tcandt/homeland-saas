import { describe, it, expect, beforeEach, vi } from "vitest";
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
  RoomStatus,
} from "@prisma/client";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { HunonicService } from "../hunonic/hunonic.service";

describe("ContractsService", () => {
  let service: ContractsService;
  let prismaService: any;
  let auditService: any;
  let eventPublisher: any;
  let hunonicService: any;

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
        invoice: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        {
          provide: ContractsRepository,
          useValue: {
            findById: vi.fn(),
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
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

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
      expect(created.rentalCycleId).toBe("cycle-1");
    });

    it("rejects creating a contract directly as ACTIVE", async () => {
      await expect(
        service.create({ status: ContractStatus.ACTIVE } as any),
      ).rejects.toThrow("CONTRACT_CREATE_REQUIRES_DRAFT");
    });

    it("rejects changing status through the generic update command", async () => {
      vi.spyOn(service, "getDetail").mockResolvedValue({
        id: "c1",
        status: ContractStatus.DRAFT,
      } as any);

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

      const result = await service.approveContract("c1", "user1");

      expect(prismaService.tx.room.findUnique).toHaveBeenCalledWith({
        where: { id: "r1" },
      });
      expect(prismaService.tx.$transaction).toHaveBeenCalled();
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

    it("should reuse an existing contract deposit instead of creating another one", async () => {
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
        contractId: "c1",
        type: DepositType.SECURITY,
        status: DepositStatus.PAID,
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

      const result = await service.approveContract("c1", "user1");

      expect(result).toEqual(updatedContract);
      expect(prismaService.tx.deposit.create).not.toHaveBeenCalled();
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

    it("should activate an APPROVED contract with a PAID deposit and create invoice", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        status: ContractStatus.APPROVED,
        roomId: "r1",
        depositMoney: 1000,
        tenantId: "t1",
        customerId: "cu1",
        monthlyRent: 5000,
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
      prismaService.tx.invoice = {
        create: vi.fn().mockResolvedValue({ id: "inv1" }),
      };

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
      expect(prismaService.tx.$queryRaw).toHaveBeenCalledTimes(1);

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
      expect(prismaService.tx.invoice.create).toHaveBeenCalled();
      expect(prismaService.tx.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          billingKind: "ENTRY",
          baseInvoiceKey: `ENTRY:c1:${calculateFirstBillingPeriod(5000, mockContract.startDate).period}`,
        }),
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

    it("allows only one activation claim when another request changed the state first", async () => {
      const mockContract = {
        ...activationReadyFields(),
        id: "c1",
        tenantId: "t1",
        roomId: "r1",
        customerId: "cu1",
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
      prismaService.tx.contract.updateMany.mockResolvedValue({ count: 0 });
      prismaService.tx.contract.findFirst.mockResolvedValue({
        ...mockContract,
        status: ContractStatus.ACTIVE,
        activationIdempotencyKey: "another-request-key",
      });

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
    it("charges a full month for move-in on day 1", () => {
      expect(
        calculateFirstBillingPeriod(3100000, "2026-01-01T00:00:00.000Z"),
      ).toMatchObject({
        amount: 3100000,
        billableDays: 31,
        daysInMonth: 31,
        period: "2026-01",
      });
    });

    it("prorates by actual calendar days for mid-month and leap-year move-in", () => {
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
