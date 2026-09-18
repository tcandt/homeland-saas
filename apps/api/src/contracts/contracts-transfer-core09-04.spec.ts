import { describe, expect, it, vi } from "vitest";
import { ContractStatus, RentalCycleStatus, RoomStatus } from "@prisma/client";
import { ContractsService } from "./contracts.service";

const tenantId = "tenant-a";
const source = {
  id: "contract-source", tenantId, roomId: "room-source", rentalCycleId: "cycle-source",
  customerId: "primary", coRepresentativeIds: ["member-a", "member-b"],
  status: ContractStatus.ACTIVE, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"),
  monthlyRent: 2_000_000, depositMoney: 2_000_000, firstPaymentDate: null, purpose: null,
  termsSnapshot: { original: true },
};

function serviceWith(tx: any) {
  const prisma: any = { tx: { ...tx, $transaction: vi.fn((fn: any) => fn(tx)) } };
  return new ContractsService({} as any, { log: vi.fn() } as any, prisma, { publish: vi.fn() } as any, {} as any);
}

describe("CORE-09.04 shared lifecycle", () => {
  it("leaves only A in a shared room and replays without another write", async () => {
    const current = { ...source };
    const occupancy = { id: "occ-a", tenantId, roomId: source.roomId, customerId: "member-a", contractId: source.id, rentalCycleId: source.rentalCycleId, leftAt: null as Date | null };
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: source.roomId }]),
      customer: { findFirst: vi.fn().mockResolvedValue({ id: "member-a", tenantId, roomId: source.roomId }), updateMany: vi.fn() },
      contract: {
        findFirst: vi.fn(async ({ where }: any) => where.id ? current : null),
        updateMany: vi.fn(async () => { current.coRepresentativeIds = ["member-b"]; return { count: 1 }; }),
        count: vi.fn().mockResolvedValue(1),
      },
      occupancy: {
        findFirst: vi.fn(async ({ where }: any) => {
          if (where.leftAt === null) return occupancy.leftAt ? null : occupancy;
          return occupancy.leftAt && where.leaveReason?.startsWith("MOVE_OUT:") ? occupancy : null;
        }),
        update: vi.fn(async ({ data }: any) => { occupancy.leftAt = data.leftAt; }),
        count: vi.fn().mockResolvedValue(1),
      },
      contractParty: { updateMany: vi.fn() },
      room: {
        findFirst: vi.fn().mockResolvedValue({ id: source.roomId, tenantId, status: RoomStatus.OCCUPIED }),
        update: vi.fn(async ({ data }: any) => ({ status: data.status })),
      },
      roomHold: { count: vi.fn().mockResolvedValue(0) },
      auditLog: { create: vi.fn() },
    };
    const service = serviceWith(tx);
    const input: any = { roomId: source.roomId, customerId: "member-a", contractId: source.id, actualMoveOutDate: "2026-06-01", reason: "move" };
    await service.moveOutOccupant(input, "user", tenantId, "leave-key-1");
    await service.moveOutOccupant(input, "user", tenantId, "leave-key-1");

    expect(current.coRepresentativeIds).toEqual(["member-b"]);
    expect(tx.occupancy.update).toHaveBeenCalledTimes(1);
    expect(tx.contractParty.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ customerId: "member-a" }) }));
    expect(tx.room.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { status: RoomStatus.OCCUPIED } }));
  });

  it("rejects whole-room occupancy and shared last-slot contention", async () => {
    const service = serviceWith({});
    const wholeTx: any = {
      occupancy: { count: vi.fn().mockResolvedValue(1) }, roomHold: { count: vi.fn().mockResolvedValue(0) }, contract: { count: vi.fn().mockResolvedValue(0) },
    };
    await expect((service as any).assertTransferTargetCapacity(wholeTx, tenantId, { id: "whole", status: RoomStatus.AVAILABLE, rentalType: "WHOLE", capacity: 1 }))
      .rejects.toThrow("TRANSFER_TARGET_WHOLE_ROOM_UNAVAILABLE");
    const sharedTx: any = {
      occupancy: { count: vi.fn().mockResolvedValue(1) }, roomHold: { count: vi.fn().mockResolvedValue(0) }, contract: { count: vi.fn().mockResolvedValue(1) },
    };
    await expect((service as any).assertTransferTargetCapacity(sharedTx, tenantId, { id: "shared", status: RoomStatus.OCCUPIED, rentalType: "SHARED", capacity: 1 }))
      .rejects.toThrow("TRANSFER_TARGET_SHARED_CAPACITY_EXCEEDED");
  });

  it("transfers A shared-to-shared once, leaving B and financial history untouched", async () => {
    const current: any = { ...source };
    let created: any = null;
    const oldFinancial = Object.freeze({ invoices: [{ id: "invoice-old" }], payments: [{ id: "payment-old" }], deposits: [{ id: "deposit-old" }], settlements: [{ id: "settlement-old" }] });
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "locked" }]),
      customer: { findFirst: vi.fn().mockResolvedValue({ id: "member-a", tenantId, fullName: "A", phone: "1" }), updateMany: vi.fn() },
      contract: {
        findFirst: vi.fn(async ({ where }: any) => where.code ? created : current),
        updateMany: vi.fn(async () => { current.coRepresentativeIds = ["member-b"]; return { count: 1 }; }),
        create: vi.fn(async ({ data }: any) => (created = { id: "contract-transfer", ...data })),
        count: vi.fn().mockResolvedValue(1),
      },
      rentalCycle: { create: vi.fn(async ({ data }: any) => ({ id: "cycle-transfer", ...data })) },
      occupancy: {
        findFirst: vi.fn().mockResolvedValue({ id: "occ-source" }),
        update: vi.fn(), create: vi.fn(), count: vi.fn().mockResolvedValue(1),
      },
      room: {
        findFirst: vi.fn(async ({ where }: any) => ({ id: where.id, tenantId, code: where.id, name: where.id, rentalType: "SHARED", capacity: 2, status: RoomStatus.OCCUPIED })),
        update: vi.fn(),
      },
      roomHold: { count: vi.fn().mockResolvedValue(0) },
      contractParty: { findFirst: vi.fn().mockResolvedValue({ identitySnapshot: { id: "member-a" } }), create: vi.fn(), updateMany: vi.fn() },
      invoice: { create: vi.fn(), update: vi.fn() }, payment: { create: vi.fn(), update: vi.fn() }, deposit: { create: vi.fn(), update: vi.fn() }, contractSettlement: { create: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    const service = serviceWith(tx);
    const input = { contractId: source.id, rentalCycleId: source.rentalCycleId, customerId: "member-a", sourceRoomId: source.roomId, targetRoomId: "room-target", transferAt: "2026-06-01" };
    const first: any = await service.transferOccupant(input, "user", tenantId, "transfer-key-3");
    const retry: any = await service.transferOccupant(input, "user", tenantId, "transfer-key-3");

    expect(first.id).toBe(retry.id);
    expect(tx.rentalCycle.create).toHaveBeenCalledTimes(1);
    expect(tx.contract.create).toHaveBeenCalledTimes(1);
    expect(tx.occupancy.create).toHaveBeenCalledTimes(1);
    expect(current.coRepresentativeIds).toEqual(["member-b"]);
    expect(tx.occupancy.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "occ-source" } }));
    expect(oldFinancial).toEqual({ invoices: [{ id: "invoice-old" }], payments: [{ id: "payment-old" }], deposits: [{ id: "deposit-old" }], settlements: [{ id: "settlement-old" }] });
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.deposit.create).not.toHaveBeenCalled();
    expect(tx.contractSettlement.create).not.toHaveBeenCalled();
  });

  it("serializes two last-slot transfers: one canonical claim wins and roommates stay", async () => {
    const sourceA: any = { ...source, id: "contract-a", roomId: "room-source-a", rentalCycleId: "cycle-a", coRepresentativeIds: ["member-a", "roommate-a"] };
    const sourceB: any = { ...source, id: "contract-b", roomId: "room-source-b", rentalCycleId: "cycle-b", coRepresentativeIds: ["member-b", "roommate-b"] };
    const sources: Record<string, any> = { [sourceA.id]: sourceA, [sourceB.id]: sourceB };
    const created: any[] = [];
    let claimedTargetSlots = 0;
    const roomLocks: string[] = [];
    let mutex = Promise.resolve();
    const tx: any = {
      $queryRaw: vi.fn(async (query: any) => {
        const id = query?.values?.[0];
        if (typeof id === "string" && id.startsWith("room-")) roomLocks.push(id);
        return [{ id }];
      }),
      customer: {
        findFirst: vi.fn(async ({ where }: any) => ({ id: where.id, tenantId, fullName: where.id, phone: where.id })),
        updateMany: vi.fn(),
      },
      contract: {
        findFirst: vi.fn(async ({ where }: any) => {
          if (where.code) return created.find((item) => item.code === where.code) || null;
          return sources[where.id] || null;
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          sources[where.id].coRepresentativeIds = data.coRepresentativeIds;
          return { count: 1 };
        }),
        create: vi.fn(async ({ data }: any) => {
          const row = { id: `transfer-${created.length + 1}`, ...data };
          created.push(row);
          return row;
        }),
        count: vi.fn().mockResolvedValue(1),
      },
      rentalCycle: { create: vi.fn(async ({ data }: any) => ({ id: `cycle-transfer-${created.length + 1}`, ...data })) },
      occupancy: {
        findFirst: vi.fn(async ({ where }: any) => ({ id: `occ-${where.customerId}` })),
        update: vi.fn(),
        create: vi.fn(async () => { claimedTargetSlots += 1; }),
        count: vi.fn(async ({ where }: any) => where.roomId === "room-target" ? claimedTargetSlots : 1),
      },
      room: {
        findFirst: vi.fn(async ({ where }: any) => ({
          id: where.id, tenantId, code: where.id, name: where.id,
          rentalType: "SHARED", capacity: 1, status: RoomStatus.OCCUPIED,
        })),
        update: vi.fn(),
      },
      roomHold: { count: vi.fn().mockResolvedValue(0) },
      contractParty: { findFirst: vi.fn().mockResolvedValue({ identitySnapshot: {} }), create: vi.fn(), updateMany: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    const prisma: any = {
      tx: {
        ...tx,
        $transaction: vi.fn(async (callback: any) => {
          let unlock!: () => void;
          const next = new Promise<void>((resolve) => { unlock = resolve; });
          const previous = mutex;
          mutex = next;
          await previous;
          try { return await callback(tx); } finally { unlock(); }
        }),
      },
    };
    const service = new ContractsService({} as any, { log: vi.fn() } as any, prisma, { publish: vi.fn() } as any, {} as any);
    const outcomes = await Promise.allSettled([
      service.transferOccupant({ contractId: sourceA.id, rentalCycleId: sourceA.rentalCycleId, customerId: "member-a", sourceRoomId: sourceA.roomId, targetRoomId: "room-target", transferAt: "2026-06-01" }, "user", tenantId, "contention-key-a"),
      service.transferOccupant({ contractId: sourceB.id, rentalCycleId: sourceB.rentalCycleId, customerId: "member-b", sourceRoomId: sourceB.roomId, targetRoomId: "room-target", transferAt: "2026-06-01" }, "user", tenantId, "contention-key-b"),
    ]);

    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(created).toHaveLength(1);
    expect(tx.rentalCycle.create).toHaveBeenCalledTimes(1);
    expect(tx.occupancy.create).toHaveBeenCalledTimes(1);
    expect(claimedTargetSlots).toBe(1);
    expect(sourceA.coRepresentativeIds).toContain("roommate-a");
    expect(sourceB.coRepresentativeIds).toContain("roommate-b");
    expect(tx.contractParty.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ customerId: "roommate-a" }) }));
    expect(roomLocks).toEqual(["room-source-a", "room-target", "room-source-b", "room-target"]);
  });

  it("rejects a primary transfer and a cross-tenant source before any financial write", async () => {
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: source.id }]),
      contract: { findFirst: vi.fn(async ({ where }: any) => where.code ? null : ({ ...source, coRepresentativeIds: [] })) },
      invoice: { create: vi.fn() }, payment: { create: vi.fn() }, deposit: { create: vi.fn() }, contractSettlement: { create: vi.fn() },
    };
    const service = serviceWith(tx);
    await expect(service.transferOccupant({ contractId: source.id, rentalCycleId: source.rentalCycleId, customerId: "primary", sourceRoomId: source.roomId, targetRoomId: "room-target", transferAt: "2026-06-01" }, "user", tenantId, "transfer-key-1"))
      .rejects.toThrow("TRANSFER_PRIMARY_REQUIRES_SETTLEMENT");
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.deposit.create).not.toHaveBeenCalled();

    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.transferOccupant({ contractId: source.id, rentalCycleId: source.rentalCycleId, customerId: "member-a", sourceRoomId: source.roomId, targetRoomId: "room-target", transferAt: "2026-06-01" }, "user", "tenant-b", "transfer-key-2"))
      .rejects.toThrow();
  });
});
