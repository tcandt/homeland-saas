import { describe, expect, it } from "vitest";
import {
  advanceTenantSelectionContext,
  createRentalIntentContext,
  isRentalIntentContextCurrent,
  resolveDepositCustomerId,
} from "./rental-intent-context";

describe("rental intent context", () => {
  const context = {
    customerId: "customer-a",
    roomId: "room-a",
    buildingId: "building-a",
    floorId: "floor-1",
    rentalType: "whole",
    generation: 4,
  };

  it("rejects a stale room generation even when the room id is reused", () => {
    expect(isRentalIntentContextCurrent(context, "room-a", 4)).toBe(true);
    expect(isRentalIntentContextCurrent(context, "room-a", 5)).toBe(false);
    expect(isRentalIntentContextCurrent(context, "room-b", 4)).toBe(false);
  });

  it("validates full target context including roomId, buildingId, floorId, and rentalType", () => {
    expect(
      isRentalIntentContextCurrent(context, {
        roomId: "room-a",
        buildingId: "building-a",
        floorId: "floor-1",
        rentalType: "whole",
        generation: 4,
      }),
    ).toBe(true);

    // Mismatched building
    expect(
      isRentalIntentContextCurrent(context, {
        roomId: "room-a",
        buildingId: "building-b",
        floorId: "floor-1",
        rentalType: "whole",
        generation: 4,
      }),
    ).toBe(false);

    // Mismatched floor
    expect(
      isRentalIntentContextCurrent(context, {
        roomId: "room-a",
        buildingId: "building-a",
        floorId: "floor-2",
        rentalType: "whole",
        generation: 4,
      }),
    ).toBe(false);

    // Mismatched rental type
    expect(
      isRentalIntentContextCurrent(context, {
        roomId: "room-a",
        buildingId: "building-a",
        floorId: "floor-1",
        rentalType: "shared",
        generation: 4,
      }),
    ).toBe(false);
  });

  it("invalidates a pending save when the tenant flow is cancelled and restarted", () => {
    const pendingSelection = {
      roomId: "room-a",
      buildingId: "building-a",
      floorId: "floor-1",
      rentalType: "whole",
      generation: 4,
    };
    const restartedSelection = advanceTenantSelectionContext(pendingSelection);

    expect(restartedSelection).toEqual({
      roomId: "room-a",
      buildingId: "building-a",
      floorId: "floor-1",
      rentalType: "whole",
      generation: 5,
    });
    expect(
      isRentalIntentContextCurrent(
        pendingSelection,
        restartedSelection.roomId,
        restartedSelection.generation,
      ),
    ).toBe(false);
  });

  it("preserves or updates buildingId, floorId, rentalType across context advances", () => {
    const initial = {
      roomId: "room-a",
      buildingId: "building-a",
      floorId: "floor-1",
      rentalType: "whole",
      generation: 1,
    };
    const updated = advanceTenantSelectionContext(initial, {
      roomId: "room-b",
      buildingId: "building-b",
      floorId: "floor-2",
      rentalType: "shared",
    });

    expect(updated).toEqual({
      roomId: "room-b",
      buildingId: "building-b",
      floorId: "floor-2",
      rentalType: "shared",
      generation: 2,
    });
  });

  it("creates a canonical rental intent context correctly", () => {
    const intent = createRentalIntentContext({
      customerId: "cust-1",
      roomId: "room-101",
      buildingId: "b-1",
      floorId: "f-1",
      rentalType: "whole",
      generation: 3,
    });

    expect(intent).toEqual({
      customerId: "cust-1",
      roomId: "room-101",
      buildingId: "b-1",
      floorId: "f-1",
      rentalType: "whole",
      generation: 3,
    });
  });

  it("uses an explicit customer selection over a retained retry customer", () => {
    expect(resolveDepositCustomerId("customer-selected", "customer-retained")).toBe(
      "customer-selected",
    );
    expect(resolveDepositCustomerId("", "customer-retained")).toBe(
      "customer-retained",
    );
  });
});

