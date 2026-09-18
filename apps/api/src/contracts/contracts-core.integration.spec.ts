import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ContractsService } from "./contracts.service";

const dbDescribe =
  process.env.RUN_CONTRACT_CORE_DB_TESTS === "1" ? describe : describe.skip;

dbDescribe("ContractsService CORE-06 PostgreSQL concurrency", () => {
  const prisma = new PrismaClient();
  const tenantId = "tenant-core06-integration";
  const buildingId = "building-core06-integration";
  const floorId = "floor-core06-integration";
  const roomId = "room-core06-integration";
  const customerId = "customer-core06-integration";
  const rentalCycleId = "cycle-core06-integration";
  const contractId = "contract-core06-integration";
  const depositId = "deposit-core06-integration";

  const service = new ContractsService(
    {} as any,
    { log: vi.fn().mockResolvedValue(undefined) } as any,
    { tx: prisma } as any,
    { publish: vi.fn().mockResolvedValue(undefined) } as any,
    { getRoomElectricityPricing: vi.fn().mockResolvedValue(null) } as any,
  );

  beforeAll(async () => {
    await prisma.tenantOrg.create({
      data: {
        id: tenantId,
        name: "CORE 06 Integration",
        code: "CORE06-INTEGRATION",
      },
    });
    await prisma.building.create({
      data: {
        id: buildingId,
        tenantId,
        code: "B-CORE06",
        name: "Tòa CORE06",
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
        code: "R-CORE06",
        name: "Phòng CORE06",
        capacity: 1,
        monthlyPrice: 5_000_000,
        rentalType: "WHOLE",
        status: "RESERVED",
      },
    });
    await prisma.customer.create({
      data: {
        id: customerId,
        tenantId,
        fullName: "Khách CORE06",
        phone: "0900060606",
      },
    });
    await prisma.rentalCycle.create({
      data: {
        id: rentalCycleId,
        tenantId,
        customerId,
        roomId,
        status: "RESERVED",
        expectedMoveInAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    await prisma.contract.create({
      data: {
        id: contractId,
        tenantId,
        roomId,
        customerId,
        rentalCycleId,
        code: "HD-CORE06",
        status: "APPROVED",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        signedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        monthlyRent: 5_000_000,
        depositMoney: 5_000_000,
      },
    });
    await prisma.deposit.create({
      data: {
        id: depositId,
        tenantId,
        code: "DEP-CORE06",
        type: "SECURITY",
        roomId,
        customerId,
        contractId,
        rentalCycleId,
        amount: 5_000_000,
        status: "PAID",
      },
    });
    const operation = await prisma.depositOperation.create({
      data: {
        tenantId,
        rentalCycleId,
        sourceDepositId: depositId,
        contractId,
        type: "COLLECT",
        status: "COMPLETED",
        idempotencyKey: "core06-seed-collect",
        requestHash: "core06-seed",
        completedAt: new Date(),
      },
    });
    await prisma.depositLedgerEntry.create({
      data: {
        tenantId,
        rentalCycleId,
        depositId,
        contractId,
        operationId: operation.id,
        type: "CASH_IN",
        amount: 5_000_000,
        balanceEffect: 5_000_000,
        idempotencyKey: "core06-seed-cash-in",
        sourceType: "INTEGRATION_TEST",
        sourceId: depositId,
      },
    });
    await prisma.roomHold.create({
      data: {
        tenantId,
        rentalCycleId,
        depositId,
        roomId,
        kind: "WHOLE",
        resourceKey: `${tenantId}:${roomId}:WHOLE`,
        activeResourceKey: `${tenantId}:${roomId}:WHOLE`,
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idempotencyKey: "core06-seed-hold",
      },
    });

    vi.spyOn(service, "getDetail").mockImplementation(async (id: string) =>
      prisma.contract.findUniqueOrThrow({ where: { id } }),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows one winner when two activation commands race", async () => {
    const results = await Promise.allSettled([
      service.activateContract(
        contractId,
        "user-core06-a",
        tenantId,
        "core06-activation-a",
      ),
      service.activateContract(
        contractId,
        "user-core06-b",
        tenantId,
        "core06-activation-b",
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      await prisma.invoice.count({ where: { tenantId, contractId } }),
    ).toBe(1);
    expect(
      await prisma.occupancy.count({
        where: { tenantId, contractId, leftAt: null },
      }),
    ).toBe(1);
    expect(
      await prisma.contractParty.count({ where: { tenantId, contractId } }),
    ).toBe(1);
    expect(
      await prisma.contract.findUniqueOrThrow({ where: { id: contractId } }),
    ).toMatchObject({ status: "ACTIVE" });
    expect(
      await prisma.room.findUniqueOrThrow({ where: { id: roomId } }),
    ).toMatchObject({
      status: "OCCUPIED",
    });
  }, 20_000);

  it("replays the winning activation key without duplicating side effects", async () => {
    const contract = await prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
    });
    const winningKey = contract.activationIdempotencyKey as string;

    await expect(
      service.activateContract(
        contractId,
        "user-core06-retry",
        tenantId,
        winningKey,
      ),
    ).resolves.toMatchObject({ id: contractId, status: "ACTIVE" });
    expect(
      await prisma.invoice.count({ where: { tenantId, contractId } }),
    ).toBe(1);
    expect(
      await prisma.occupancy.count({
        where: { tenantId, contractId, leftAt: null },
      }),
    ).toBe(1);
  });

  it("serializes different contracts competing for the final shared-room slot", async () => {
    const sharedRoomId = "room-core06-shared";
    await prisma.room.create({
      data: {
        id: sharedRoomId,
        tenantId,
        buildingId,
        floorId,
        code: "R-CORE06-SHARED",
        name: "Phòng ghép CORE06",
        capacity: 2,
        monthlyPrice: 2_000_000,
        rentalType: "SHARED",
        status: "OCCUPIED",
      },
    });
    const resident = await prisma.customer.create({
      data: {
        id: "customer-core06-shared-resident",
        tenantId,
        fullName: "Khách đang ở CORE06",
        phone: "0900060610",
      },
    });
    const residentCycle = await prisma.rentalCycle.create({
      data: {
        id: "cycle-core06-shared-resident",
        tenantId,
        customerId: resident.id,
        roomId: sharedRoomId,
        status: "ACTIVE",
      },
    });
    await prisma.occupancy.create({
      data: {
        tenantId,
        roomId: sharedRoomId,
        customerId: resident.id,
        rentalCycleId: residentCycle.id,
        role: "PRIMARY",
      },
    });

    const competingContractIds: string[] = [];
    for (const suffix of ["a", "b"]) {
      const competingCustomerId = `customer-core06-shared-${suffix}`;
      const competingCycleId = `cycle-core06-shared-${suffix}`;
      const competingContractId = `contract-core06-shared-${suffix}`;
      const competingDepositId = `deposit-core06-shared-${suffix}`;
      await prisma.customer.create({
        data: {
          id: competingCustomerId,
          tenantId,
          fullName: `Khách tranh chỗ ${suffix}`,
          phone: suffix === "a" ? "0900060611" : "0900060612",
        },
      });
      await prisma.rentalCycle.create({
        data: {
          id: competingCycleId,
          tenantId,
          customerId: competingCustomerId,
          roomId: sharedRoomId,
          status: "RESERVED",
        },
      });
      await prisma.contract.create({
        data: {
          id: competingContractId,
          tenantId,
          roomId: sharedRoomId,
          customerId: competingCustomerId,
          rentalCycleId: competingCycleId,
          code: `HD-CORE06-SHARED-${suffix.toUpperCase()}`,
          status: "APPROVED",
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          signedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          monthlyRent: 2_000_000,
          depositMoney: 2_000_000,
          memberCount: 1,
        },
      });
      await prisma.deposit.create({
        data: {
          id: competingDepositId,
          tenantId,
          code: `DEP-CORE06-SHARED-${suffix.toUpperCase()}`,
          type: "SECURITY",
          roomId: sharedRoomId,
          customerId: competingCustomerId,
          contractId: competingContractId,
          rentalCycleId: competingCycleId,
          amount: 2_000_000,
          status: "PAID",
        },
      });
      const operation = await prisma.depositOperation.create({
        data: {
          tenantId,
          rentalCycleId: competingCycleId,
          sourceDepositId: competingDepositId,
          contractId: competingContractId,
          type: "COLLECT",
          status: "COMPLETED",
          idempotencyKey: `core06-shared-${suffix}-collect`,
          requestHash: `core06-shared-${suffix}`,
          completedAt: new Date(),
        },
      });
      await prisma.depositLedgerEntry.create({
        data: {
          tenantId,
          rentalCycleId: competingCycleId,
          depositId: competingDepositId,
          contractId: competingContractId,
          operationId: operation.id,
          type: "CASH_IN",
          amount: 2_000_000,
          balanceEffect: 2_000_000,
          idempotencyKey: `core06-shared-${suffix}-cash-in`,
          sourceType: "INTEGRATION_TEST",
          sourceId: competingDepositId,
        },
      });
      await prisma.roomHold.create({
        data: {
          tenantId,
          rentalCycleId: competingCycleId,
          depositId: competingDepositId,
          roomId: sharedRoomId,
          kind: "SHARED_SLOT",
          resourceKey: `${tenantId}:${sharedRoomId}:SHARED_SLOT:${suffix}`,
          activeResourceKey: `${tenantId}:${sharedRoomId}:SHARED_SLOT:${suffix}`,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          idempotencyKey: `core06-shared-${suffix}-hold`,
        },
      });
      competingContractIds.push(competingContractId);
    }

    const results = await Promise.allSettled(
      competingContractIds.map((candidateId, index) =>
        service.activateContract(
          candidateId,
          `user-core06-shared-${index}`,
          tenantId,
          `core06-shared-activation-${index}`,
        ),
      ),
    );

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      await prisma.occupancy.count({
        where: { tenantId, roomId: sharedRoomId, leftAt: null },
      }),
    ).toBe(2);
    expect(
      await prisma.contract.count({
        where: {
          tenantId,
          id: { in: competingContractIds },
          status: "ACTIVE",
        },
      }),
    ).toBe(1);
    expect(
      await prisma.invoice.count({
        where: { tenantId, contractId: { in: competingContractIds } },
      }),
    ).toBe(1);
  }, 20_000);
});
