import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("./client", () => ({ apiClient: { post: mocks.post } }));

import { contractsApi } from "./contracts.api";

describe("contractsApi.createBookingHold", () => {
  beforeEach(() => mocks.post.mockReset());

  it("uses the same validated command key in body and Idempotency-Key header", () => {
    contractsApi.createBookingHold({
      idempotencyKey: "booking-hold-command-1",
      customerId: "customer-1",
      roomId: "room-1",
      startDate: "2026-10-10",
      endDate: "2027-10-10",
      rentAmount: 4_000_000,
      contractDepositAmount: 8_000_000,
      bookingAmount: 1_000_000,
      memberCount: 1,
    });
    expect(mocks.post).toHaveBeenCalledWith(
      "/contracts/booking-hold",
      expect.objectContaining({ idempotencyKey: "booking-hold-command-1" }),
      { headers: { "Idempotency-Key": "booking-hold-command-1" } },
    );
  });
});
