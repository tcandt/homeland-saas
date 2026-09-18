import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ContractsService } from "./contracts.service";
import { ContractsRepository } from "./contracts.repository";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../shared/audit/audit.service";
import { DomainEventPublisher } from "../shared/events/domain-event.publisher";
import { ContractStatus, RoomStatus, DepositStatus } from "@prisma/client";
import { HunonicService } from "../hunonic/hunonic.service";

describe("Contracts Workflow Verification", () => {
  let service: ContractsService;
  let prismaService: any;
  let auditService: any;
  let eventPublisher: any;
  let hunonicService: any;

  // In-memory state for the full workflow
  let currentContract: any;
  let currentRoom: any;
  let currentDeposit: any;
  let currentInvoice: any;

  beforeEach(async () => {
    // Reset state
    currentContract = {
      id: "c1",
      status: ContractStatus.DRAFT,
      roomId: "r1",
      tenantId: "t1",
      customerId: "cu1",
      rentalCycleId: "cycle-1",
      monthlyRent: 5000,
      depositMoney: 5000,
      signedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    currentRoom = { id: "r1", status: RoomStatus.AVAILABLE };
    currentDeposit = null;
    currentInvoice = null;

    prismaService = {
      hunonicMeterMapping: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      tx: {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "r1" }]),
        auditLog: { create: vi.fn() },
        outboxEvent: { create: vi.fn() },
        contract: {
          update: vi.fn().mockImplementation(async ({ where, data }) => {
            currentContract = { ...currentContract, ...data };
            return currentContract;
          }),
          updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
            if (
              where.id !== currentContract.id ||
              !(where.status === currentContract.status || where.status?.in?.includes(currentContract.status))
            ) {
              return { count: 0 };
            }
            currentContract = { ...currentContract, ...data };
            return { count: 1 };
          }),
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn().mockImplementation(async () => currentContract),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        room: {
          findUnique: vi.fn().mockImplementation(async ({ where }) => {
            if (where.id === "r1") return currentRoom;
            return null;
          }),
          findFirst: vi.fn().mockImplementation(async ({ where }) => {
            if (where.id === "r1") return currentRoom;
            return null;
          }),
          update: vi.fn().mockImplementation(async ({ where, data }) => {
            currentRoom = { ...currentRoom, ...data };
            return currentRoom;
          }),
        },
        deposit: {
          findFirst: vi.fn().mockImplementation(async () => currentDeposit),
          findMany: vi.fn().mockImplementation(async () => currentDeposit ? [currentDeposit] : []),
          create: vi.fn().mockImplementation(async ({ data }) => {
            currentDeposit = { id: "d1", ...data };
            return currentDeposit;
          }),
          update: vi.fn().mockImplementation(async ({ where, data }) => {
            currentDeposit = { ...currentDeposit, ...data };
            return currentDeposit;
          }),
        },
        depositLedgerEntry: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { balanceEffect: 5000 } }),
        },
        occupancy: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "settlement-1" }),
          upsert: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
          count: vi.fn().mockResolvedValue(0),
        },
        contractParty: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          updateMany: vi.fn(),
        },
        customer: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn(),
        },
        rentalCycle: {
          findFirst: vi.fn().mockResolvedValue({ id: 'cycle-1' }),
          create: vi.fn(),
          updateMany: vi.fn(),
        },
        contractSettlement: {
          findFirst: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ id: "settlement-1" }),
          update: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: "settlement-1" }),
        },
        invoice: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(async ({ data }) => {
            currentInvoice = { id: `inv-${Date.now()}`, ...data };
            return currentInvoice;
          }),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          // Snapshot state before transaction
          const contractSnapshot = { ...currentContract };
          const roomSnapshot = { ...currentRoom };
          const depositSnapshot = currentDeposit ? { ...currentDeposit } : null;
          const invoiceSnapshot = currentInvoice ? { ...currentInvoice } : null;
          try {
            return await callback(prismaService.tx);
          } catch (e) {
            // Rollback on error
            currentContract = contractSnapshot;
            currentRoom = roomSnapshot;
            currentDeposit = depositSnapshot;
            currentInvoice = invoiceSnapshot;
            throw e;
          }
        }),
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

    // Override getDetail to return our in-memory state
    vi.spyOn(service, "getDetail").mockImplementation(
      async () => currentContract,
    );
  });

  it("Path A: DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> TERMINATED", async () => {
    // 1. Submit
    await service.submitContract("c1", "u1");
    expect(currentContract.status).toBe(ContractStatus.PENDING_APPROVAL);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE" }),
    );
    auditService.log.mockClear();

    // 2. Approve
    await service.approveContract("c1", "u1");
    expect(currentContract.status).toBe(ContractStatus.APPROVED);
    expect(currentRoom.status).toBe(RoomStatus.RESERVED);
    expect(currentDeposit).toBeDefined();
    expect(currentDeposit.status).toBe("DRAFT");
    expect(auditService.log).toHaveBeenCalled();
    auditService.log.mockClear();

    // Simulate deposit paid by Finance
    currentDeposit.status = "PAID";

    // 3. Activate
    await service.activateContract("c1", "u1", "t1", "workflow-path-a");
    expect(currentContract.status).toBe(ContractStatus.ACTIVE);
    expect(currentRoom.status).toBe(RoomStatus.OCCUPIED);
    expect(currentDeposit.status).toBe("CONVERTED_TO_CONTRACT");
    expect(currentInvoice).toBeDefined();
    expect(currentInvoice.status).toBe("ISSUED");
    expect(auditService.log).toHaveBeenCalled();
    auditService.log.mockClear();

    // 4. Terminate
    await service.terminateContract(
      "c1",
      "u1",
      {
        actualMoveOutDate: new Date("2026-08-31T00:00:00.000Z"),
        roomTurnoverStatus: RoomStatus.AVAILABLE,
        rentDaysCharged: 0,
      },
      "t1",
      "workflow-path-a-settlement",
    );
    expect(currentContract.status).toBe(ContractStatus.TERMINATED);
    expect(currentRoom.status).toBe(RoomStatus.AVAILABLE);
    expect(currentInvoice.status).toBe("ISSUED"); // Zero-value settlement does not replace the issued invoice.
    expect(prismaService.tx.auditLog.create).toHaveBeenCalled();
  });

  it("Path B: DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> EXPIRED", async () => {
    await service.submitContract("c1", "u1");
    await service.approveContract("c1", "u1");
    currentDeposit.status = "PAID";
    await service.activateContract("c1", "u1", "t1", "workflow-path-b");

    prismaService.tx.contractSettlement.findFirst.mockResolvedValue({ id: "settlement-1" });
    await expect(service.expireContract("c1", "u1", "t1"))
      .rejects.toThrow("CONTRACT_EXPIRY_SETTLEMENT_STATE_MISMATCH");
  });

  it("should rollback transaction if a side effect fails", async () => {
    await service.submitContract("c1", "u1");
    expect(currentContract.status).toBe(ContractStatus.PENDING_APPROVAL);

    // Attempt Approve, but mock room update to throw
    prismaService.tx.room.update.mockRejectedValueOnce(new Error("DB Error"));

    try {
      await service.approveContract("c1", "u1");
    } catch (e) {
      expect(e.message).toBe("DB Error");
    }

    // Verify rollback
    expect(currentContract.status).toBe(ContractStatus.PENDING_APPROVAL); // Contract remained PENDING_APPROVAL
    expect(currentRoom.status).toBe(RoomStatus.AVAILABLE); // Room remained AVAILABLE
    expect(currentDeposit).toBeNull(); // Deposit wasn't created (or was rolled back)
  });

  it("rolls activation back when invoice creation fails after room and deposit updates", async () => {
    await service.submitContract("c1", "u1");
    await service.approveContract("c1", "u1");
    currentDeposit.status = "PAID";
    prismaService.tx.invoice.create.mockRejectedValueOnce(
      new Error("INVOICE_WRITE_FAILED"),
    );

    await expect(
      service.activateContract(
        "c1",
        "u1",
        "t1",
        "workflow-activation-rollback",
      ),
    ).rejects.toThrow("INVOICE_WRITE_FAILED");

    expect(currentContract.status).toBe(ContractStatus.APPROVED);
    expect(currentContract.activationIdempotencyKey).toBeUndefined();
    expect(currentRoom.status).toBe(RoomStatus.RESERVED);
    expect(currentDeposit.status).toBe("PAID");
    expect(currentInvoice).toBeNull();
  });

  describe("Failure Matrix", () => {
    it("should fail submit from non-DRAFT", async () => {
      currentContract.status = ContractStatus.ACTIVE;
      await expect(service.submitContract("c1", "u1")).rejects.toThrow();
    });

    it("should fail approve from non-PENDING_APPROVAL", async () => {
      currentContract.status = ContractStatus.DRAFT;
      await expect(service.approveContract("c1", "u1")).rejects.toThrow();
    });

    it("should fail approve occupied room", async () => {
      currentContract.status = ContractStatus.PENDING_APPROVAL;
      currentRoom.status = RoomStatus.OCCUPIED;
      await expect(service.approveContract("c1", "u1")).rejects.toThrow();
    });

    it("should fail activate without deposit", async () => {
      currentContract.status = ContractStatus.APPROVED;
      currentRoom.status = RoomStatus.RESERVED;
      currentDeposit = null;
      await expect(
        service.activateContract("c1", "u1", "t1", "failure-no-deposit"),
      ).rejects.toThrow();
    });

    it("should fail activate deposit not PAID", async () => {
      currentContract.status = ContractStatus.APPROVED;
      currentRoom.status = RoomStatus.RESERVED;
      currentDeposit = { id: "d1", status: "DRAFT" };
      await expect(
        service.activateContract("c1", "u1", "t1", "failure-unpaid-deposit"),
      ).rejects.toThrow();
    });

    it("should fail activate room not RESERVED", async () => {
      currentContract.status = ContractStatus.APPROVED;
      currentRoom.status = RoomStatus.AVAILABLE;
      currentDeposit = { id: "d1", status: "PAID" };
      await expect(
        service.activateContract("c1", "u1", "t1", "failure-room-status"),
      ).rejects.toThrow();
    });

    it("should fail terminate non-ACTIVE", async () => {
      currentContract.status = ContractStatus.APPROVED;
      await expect(service.terminateContract("c1", "u1")).rejects.toThrow();
    });

    it("should fail expire non-ACTIVE", async () => {
      currentContract.status = ContractStatus.DRAFT;
      await expect(service.expireContract("c1", "u1")).rejects.toThrow();
    });

    it("terminal state transition rejected (TERMINATED)", async () => {
      currentContract.status = ContractStatus.TERMINATED;
      await expect(service.terminateContract("c1", "u1")).rejects.toThrow();
      await expect(service.expireContract("c1", "u1")).rejects.toThrow();
      await expect(
        service.activateContract(
          "c1",
          "u1",
          "t1",
          "failure-terminal-terminated",
        ),
      ).rejects.toThrow();
    });

    it("terminal state transition rejected (EXPIRED)", async () => {
      currentContract.status = ContractStatus.EXPIRED;
      await expect(service.terminateContract("c1", "u1")).rejects.toThrow();
      await expect(service.expireContract("c1", "u1")).rejects.toThrow();
      await expect(
        service.activateContract("c1", "u1", "t1", "failure-terminal-expired"),
      ).rejects.toThrow();
    });
  });
});
