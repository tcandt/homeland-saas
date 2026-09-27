import { ContractStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ContractsRepository } from "./contracts.repository";
import { ContractsService } from "./contracts.service";

describe("P8 active contract occupant guard", () => {
  it("rejects a direct co-representative edit before it can rewrite occupancy history", async () => {
    const repository = {
      findById: vi.fn(),
      update: vi.fn(),
    } as unknown as ContractsRepository;
    const service = new ContractsService(
      repository,
      { log: vi.fn() } as any,
      { tx: {} } as any,
      { publish: vi.fn() } as any,
      {} as any,
    );
    vi.spyOn(service, "getDetail").mockResolvedValue({
      id: "contract-active",
      status: ContractStatus.ACTIVE,
      coRepresentativeIds: ["occupant-existing"],
    } as any);

    await expect(
      service.update("contract-active", {
        coRepresentativeIds: ["occupant-new"],
      }),
    ).rejects.toMatchObject({
      message: "ACTIVE_CONTRACT_OCCUPANT_CHANGE_REQUIRES_LIFECYCLE_COMMAND",
    });
    expect((repository as any).update).not.toHaveBeenCalled();
  });

  it("rejects duplicate secondary occupants instead of persisting an invalid active membership", async () => {
    const repository = {
      findById: vi.fn(),
      update: vi.fn(),
    } as unknown as ContractsRepository;
    const service = new ContractsService(
      repository,
      { log: vi.fn() } as any,
      { tx: {} } as any,
      { publish: vi.fn() } as any,
      {} as any,
    );
    vi.spyOn(service, "getDetail").mockResolvedValue({
      id: "contract-active",
      status: ContractStatus.ACTIVE,
      coRepresentativeIds: ["occupant-existing"],
    } as any);

    await expect(
      service.update("contract-active", {
        coRepresentativeIds: ["occupant-existing", "occupant-existing"],
      }),
    ).rejects.toMatchObject({
      message: "ACTIVE_CONTRACT_OCCUPANT_CHANGE_REQUIRES_LIFECYCLE_COMMAND",
    });
    expect((repository as any).update).not.toHaveBeenCalled();
  });
});
