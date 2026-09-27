import { ContractStatus, RoomStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ContractsService } from "./contracts.service";

describe("P8 whole-room occupant command", () => {
  it("creates one replay-safe secondary occupancy without creating a new payer contract", async () => {
    const tenantId = "tenant-p8";
    const contractId = "contract-p8";
    const customerId = "occupant-p8";
    const commandKey = "whole-occupant-command-p8";
    const contract: any = {
      id: contractId,
      tenantId,
      roomId: "room-p8",
      rentalCycleId: "cycle-p8",
      customerId: "payer-p8",
      coRepresentativeIds: [],
      status: ContractStatus.ACTIVE,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-09-01T00:00:00.000Z"),
      signedAt: new Date("2026-08-31T00:00:00.000Z"),
    };
    const room = {
      id: contract.roomId,
      tenantId,
      rentalType: "WHOLE",
      capacity: 2,
      status: RoomStatus.OCCUPIED,
    };
    const customer = {
      id: customerId,
      tenantId,
      fullName: "Secondary P8",
      phone: "0900000000",
      email: null,
      identityNo: null,
      roomId: null,
    };
    let occupancy: any = null;
    let party: any = null;
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "locked" }]),
      contract: {
        findFirst: vi.fn().mockImplementation(async () => contract),
        update: vi.fn().mockImplementation(async ({ data }: any) => {
          contract.coRepresentativeIds = data.coRepresentativeIds;
          return { ...contract };
        }),
        count: vi.fn().mockResolvedValue(1),
      },
      room: {
        findFirst: vi.fn().mockResolvedValue(room),
        update: vi.fn().mockResolvedValue(room),
      },
      customer: {
        findFirst: vi.fn().mockResolvedValue(customer),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      occupancy: {
        findUnique: vi.fn().mockImplementation(async () => occupancy),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          occupancy = { ...data, leftAt: null };
          return occupancy;
        }),
      },
      roomHold: { count: vi.fn().mockResolvedValue(0) },
      billingSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
      contractParty: {
        findFirst: vi.fn().mockImplementation(async () => party),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          party = { id: "party-p8", ...data };
          return party;
        }),
      },
      auditLog: { create: vi.fn() },
    };
    const service = new ContractsService(
      {} as any,
      { log: vi.fn() } as any,
      { tx: { $transaction: vi.fn((callback: any) => callback(tx)) } } as any,
      { publish: vi.fn() } as any,
      {} as any,
    );
    const payload = {
      customerId,
      moveInAt: "2026-09-15T00:00:00.000Z",
      relationship: "Người ở cùng",
    };

    const first = await service.addWholeRoomOccupant(
      contractId,
      payload,
      "user-p8",
      tenantId,
      commandKey,
    );
    const replay = await service.addWholeRoomOccupant(
      contractId,
      payload,
      "user-p8",
      tenantId,
      commandKey,
    );

    expect(first).toMatchObject({
      mode: "WHOLE_ROOM_OCCUPANT_ATTACHED",
      contractId,
      customerId,
      replayed: false,
    });
    expect(replay).toMatchObject({ ...first, replayed: true });
    expect(contract.coRepresentativeIds).toEqual([customerId]);
    expect(tx.contract.update).toHaveBeenCalledTimes(1);
    expect(tx.contractParty.create).toHaveBeenCalledTimes(1);
    expect(tx.occupancy.create).toHaveBeenCalledTimes(1);
    expect(tx.customer.updateMany).toHaveBeenCalledWith({
      where: { id: customerId, tenantId },
      data: { roomId: room.id },
    });
    expect(occupancy).toMatchObject({
      tenantId,
      roomId: room.id,
      contractId,
      rentalCycleId: contract.rentalCycleId,
      customerId,
      role: "CO_REPRESENTATIVE",
      joinedAt: new Date(payload.moveInAt),
    });
  });

  it("rejects a backdated occupant when a locked usage period would make historical billing inconsistent", async () => {
    const tenantId = "tenant-p8";
    const contract: any = {
      id: "contract-p8",
      tenantId,
      roomId: "room-p8",
      rentalCycleId: "cycle-p8",
      customerId: "payer-p8",
      coRepresentativeIds: [],
      status: ContractStatus.ACTIVE,
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2027-08-01T00:00:00.000Z"),
    };
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "locked" }]),
      contract: { findFirst: vi.fn().mockResolvedValue(contract) },
      room: {
        findFirst: vi.fn().mockResolvedValue({
          id: contract.roomId,
          tenantId,
          rentalType: "WHOLE",
          status: RoomStatus.OCCUPIED,
        }),
      },
      billingSnapshot: {
        findFirst: vi.fn().mockResolvedValue({
          id: "snapshot-august",
          usagePeriod: "2026-08",
        }),
      },
    };
    const service = new ContractsService(
      {} as any,
      { log: vi.fn() } as any,
      { tx: { $transaction: vi.fn((callback: any) => callback(tx)) } } as any,
      { publish: vi.fn() } as any,
      {} as any,
    );

    await expect(
      service.addWholeRoomOccupant(
        contract.id,
        {
          customerId: "occupant-p8",
          moveInAt: "2026-08-15T00:00:00.000Z",
        },
        "user-p8",
        tenantId,
        "whole-occupant-locked-period",
      ),
    ).rejects.toMatchObject({
      message: "WHOLE_OCCUPANT_LOCKED_BILLING_PERIOD",
    });
    expect(tx.contract.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.billingSnapshot.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId,
        roomId: contract.roomId,
        status: "LOCKED",
        usagePeriod: { gte: "2026-08" },
      }),
      select: { id: true, usagePeriod: true },
      orderBy: { usagePeriod: "asc" },
    });
  });
});
