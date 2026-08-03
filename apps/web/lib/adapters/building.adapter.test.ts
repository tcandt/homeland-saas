import { describe, expect, it } from "vitest";
import { adaptRoom } from "./building.adapter";

function apiRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: "room-01",
    name: "PN 31-01",
    code: "PN 31-01",
    status: "AVAILABLE",
    monthlyPrice: 6_500_000,
    contracts: [],
    roommates: [],
    ...overrides,
  };
}

describe("adaptRoom optional numeric fields", () => {
  it("normalizes API null values so controlled number inputs never receive null", () => {
    const room = adaptRoom(apiRoom({ area: null, capacity: null, bedCount: null }));

    expect(room.area).toBeUndefined();
    expect(room.capacity).toBeUndefined();
    expect(room.bedCount).toBeUndefined();
  });

  it("keeps valid numeric values returned as strings", () => {
    const room = adaptRoom(apiRoom({ area: "25.5", capacity: "2", bedCount: "1" }));

    expect(room.area).toBe(25.5);
    expect(room.capacity).toBe(2);
    expect(room.bedCount).toBe(1);
  });
});
