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

  it("does not expose API monthlyPrice as rent for vacant rooms", () => {
    const room = adaptRoom(apiRoom({ monthlyPrice: 6_500_000, contracts: [] }));

    expect(room.price).toBe(0);
    expect(room.monthlyPrice).toBe(0);
  });

  it("uses active contract rent as room price", () => {
    const room = adaptRoom(apiRoom({
      contracts: [{
        id: "contract-01",
        code: "HD-001",
        status: "ACTIVE",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        monthlyRent: 7_300_000,
        depositMoney: 14_600_000,
        customer: { id: "customer-01", fullName: "Nguyen Van A", phone: "0900000000" },
      }],
    }));

    expect(room.price).toBe(7_300_000);
    expect(room.monthlyPrice).toBe(7_300_000);
    expect(room.contract?.rentPrice).toBe(7_300_000);
  });

  it("maps API rentalType to UI rentalType", () => {
    expect(adaptRoom(apiRoom({ rentalType: "SHARED" })).rentalType).toBe("shared");
    expect(adaptRoom(apiRoom({ rentalType: "WHOLE" })).rentalType).toBe("whole");
    expect(adaptRoom(apiRoom({ rentalType: undefined })).rentalType).toBe("whole");
  });
});
