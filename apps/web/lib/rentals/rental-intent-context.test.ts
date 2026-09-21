import { describe, expect, it } from "vitest";
import {
  isRentalIntentContextCurrent,
  resolveDepositCustomerId,
} from "./rental-intent-context";

describe("rental intent context", () => {
  const context = {
    customerId: "customer-a",
    roomId: "room-a",
    buildingId: "building-a",
    generation: 4,
  };

  it("rejects a stale room generation even when the room id is reused", () => {
    expect(isRentalIntentContextCurrent(context, "room-a", 4)).toBe(true);
    expect(isRentalIntentContextCurrent(context, "room-a", 5)).toBe(false);
    expect(isRentalIntentContextCurrent(context, "room-b", 4)).toBe(false);
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
