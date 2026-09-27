import { describe, expect, it } from "vitest";
import { getWholeRoomOccupantCommandPreflightError } from "./whole-room-occupant-guard";

describe("whole-room secondary occupant preflight", () => {
  it("blocks an active whole-room contract without its canonical rental cycle", () => {
    expect(
      getWholeRoomOccupantCommandPreflightError({
        requiresCommand: true,
        contractStatus: "ACTIVE",
        rentalCycleId: null,
      }),
    ).toBe("WHOLE_OCCUPANT_RENTAL_CYCLE_REQUIRED");
  });

  it("allows an active whole-room contract with a canonical rental cycle", () => {
    expect(
      getWholeRoomOccupantCommandPreflightError({
        requiresCommand: true,
        contractStatus: "EXPIRING",
        rentalCycleId: "cycle-current",
      }),
    ).toBeNull();
  });

  it("does not impose the active-cycle requirement before the contract is active", () => {
    expect(
      getWholeRoomOccupantCommandPreflightError({
        requiresCommand: true,
        contractStatus: "DRAFT",
        rentalCycleId: null,
      }),
    ).toBeNull();
  });
});
