import { describe, expect, it, vi } from "vitest";
import { ContractStatus, RoomStatus } from "@prisma/client";
import { ContractsService } from "./contracts.service";

const contract = {
  id: "contract-a",
  tenantId: "tenant-a",
  roomId: "room-shared",
  customerId: "customer-a",
  rentalCycleId: "cycle-a",
  coRepresentativeIds: [],
  status: ContractStatus.ACTIVE,
};

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "room-shared" }]),
    occupancy: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    contractParty: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    customer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    contract: { count: vi.fn().mockResolvedValue(0) },
    roomHold: { count: vi.fn().mockResolvedValue(0) },
    room: {
      findFirst: vi.fn().mockResolvedValue({ status: RoomStatus.OCCUPIED }),
      update: vi.fn().mockImplementation(async ({ data }) => ({
        id: "room-shared",
        ...data,
      })),
    },
    ...overrides,
  } as any;
}

function makeService() {
  return new ContractsService(
    {} as any,
    { log: vi.fn() } as any,
    {} as any,
    { publish: vi.fn() } as any,
    { getRoomElectricityPricing: vi.fn() } as any,
  );
}

function makeLegacyFinalizeService() {
  const tx = makeTx({
    contract: {
      findFirst: vi.fn(async ({ where }) =>
        where.tenantId === contract.tenantId
          ? { ...contract, status: ContractStatus.TERMINATED }
          : null,
      ),
      count: vi.fn().mockResolvedValue(0),
    },
    contractSettlement: {
      findFirst: vi.fn().mockResolvedValue({ id: "settlement-a" }),
    },
  });
  const service = new ContractsService(
    {} as any,
    { log: vi.fn() } as any,
    { tx } as any,
    { publish: vi.fn() } as any,
    { getRoomElectricityPricing: vi.fn() } as any,
  );
  return { service, tx };
}

describe("CORE-09.02 canonical post-move-out lifecycle", () => {
  it("WHOLE: closes only the target contract cycle and releases an empty room", async () => {
    const tx = makeTx();

    const room = await (makeService() as any).applyCanonicalMoveOutLifecycle(
      tx,
      contract,
      {
        actualMoveOutAt: new Date("2026-09-13T10:00:00.000Z"),
        reason: "move out",
        requestedRoomStatus: RoomStatus.AVAILABLE,
      },
    );

    expect(tx.occupancy.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: "tenant-a",
        roomId: "room-shared",
        contractId: "contract-a",
        rentalCycleId: "cycle-a",
        leftAt: null,
      }),
      data: expect.objectContaining({ leaveReason: "move out" }),
    });
    expect(tx.contractParty.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          contractId: "contract-a",
          leftAt: null,
        }),
      }),
    );
    expect(room.status).toBe(RoomStatus.AVAILABLE);
  });

  it("SHARED: preserves a roommate occupancy and keeps the room occupied", async () => {
    const tx = makeTx({
      occupancy: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(1),
      },
      contract: { count: vi.fn().mockResolvedValue(1) },
    });

    const room = await (makeService() as any).applyCanonicalMoveOutLifecycle(
      tx,
      contract,
      {
        actualMoveOutAt: new Date("2026-09-13T10:00:00.000Z"),
        reason: "move out",
        requestedRoomStatus: RoomStatus.CLEANING,
      },
    );

    expect(tx.occupancy.updateMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        roomId: "room-shared",
        contractId: "contract-a",
        rentalCycleId: "cycle-a",
        leftAt: null,
      }),
    );
    expect(tx.customer.updateMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ id: { in: ["customer-a"] } }),
    );
    expect(room.status).toBe(RoomStatus.OCCUPIED);
  });

  it("retry/concurrency: each transition is protected by a room row lock and remains scoped", async () => {
    const tx = makeTx({
      occupancy: {
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
    });
    const service = makeService();
    const input = {
      actualMoveOutAt: new Date("2026-09-13T10:00:00.000Z"),
      reason: "move out",
      requestedRoomStatus: RoomStatus.AVAILABLE,
    };

    await Promise.all([
      (service as any).applyCanonicalMoveOutLifecycle(tx, contract, input),
      (service as any).applyCanonicalMoveOutLifecycle(tx, contract, input),
    ]);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(String(tx.$queryRaw.mock.calls[0][0].strings?.join(" "))).toContain(
      "FOR UPDATE",
    );
    expect(tx.occupancy.updateMany.mock.calls).toHaveLength(2);
    for (const call of tx.occupancy.updateMany.mock.calls) {
      expect(call[0].where).toEqual(
        expect.objectContaining({
          tenantId: "tenant-a",
          contractId: "contract-a",
          rentalCycleId: "cycle-a",
          leftAt: null,
        }),
      );
    }
  });

  it("keeps a valid hold reserved and never lets another tenant update the room", async () => {
    const tx = makeTx({
      roomHold: { count: vi.fn().mockResolvedValue(1) },
    });
    const room = await (makeService() as any).applyCanonicalMoveOutLifecycle(
      tx,
      contract,
      {
        actualMoveOutAt: new Date("2026-09-13T10:00:00.000Z"),
        reason: "move out",
        requestedRoomStatus: RoomStatus.AVAILABLE,
      },
    );

    expect(tx.$queryRaw).toHaveBeenCalledWith(
      expect.objectContaining({ values: expect.arrayContaining(["tenant-a"]) }),
    );
    expect(room.status).toBe(RoomStatus.RESERVED);
  });

  it("expire fails closed before settlement and replays without a second lifecycle after settlement", async () => {
    const { service, tx } = makeLegacyFinalizeService();
    const lifecycle = vi.spyOn(service as any, "applyCanonicalMoveOutLifecycle");
    tx.contractSettlement.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.expireContract("contract-a", "user-a", "tenant-a"),
    ).rejects.toThrow("CONTRACT_EXPIRY_REQUIRES_SETTLEMENT");
    await expect(
      service.expireContract("contract-a", "user-a", "tenant-a"),
    ).resolves.toMatchObject({ status: ContractStatus.TERMINATED });
    await expect(
      service.expireContract("contract-a", "user-a", "tenant-a"),
    ).resolves.toMatchObject({ status: ContractStatus.TERMINATED });

    expect(lifecycle).not.toHaveBeenCalled();
    expect(tx.occupancy.updateMany).not.toHaveBeenCalled();
    expect(tx.room.update).not.toHaveBeenCalled();
    await expect(
      service.expireContract("contract-a", "user-a", "tenant-b"),
    ).rejects.toThrow("Contract with ID contract-a not found");
  });
});
