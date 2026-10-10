import { describe, expect, it, vi } from "vitest";
import {
  getOrCreateBookingHoldIntent,
  markBookingHoldIntentAccepted,
} from "./booking-hold-intent";

const scope = { tenantId: "tenant-1", userId: "user-1", roomId: "room-1", customerId: "customer-1" };
const payload = {
  customerId: scope.customerId,
  roomId: scope.roomId,
  startDate: "2026-10-10",
  endDate: "2027-10-10",
  firstPaymentDate: "2026-10-10T00:00:00.000Z",
  rentAmount: 4_000_000,
  contractDepositAmount: 8_000_000,
  bookingAmount: 1_000_000,
  memberCount: 1,
  purpose: "booking hold",
  expiredAt: "2026-10-10T23:59:59.000Z",
  note: "hold",
};

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

describe("booking hold intent", () => {
  it("reuses immutable command across reload and rejects payload mutation", async () => {
    vi.stubGlobal("navigator", { locks: { request: (_key: string, _options: unknown, fn: () => unknown) => fn() } });
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-command-id" });
    const durable = storage();
    const first = await getOrCreateBookingHoldIntent(scope, payload, durable);
    const replay = await getOrCreateBookingHoldIntent(scope, payload, durable);
    expect(replay.command.idempotencyKey).toBe(first.command.idempotencyKey);
    await expect(
      getOrCreateBookingHoldIntent(scope, { ...payload, bookingAmount: 2_000_000 }, durable),
    ).rejects.toThrow("BOOKING_INTENT_PAYLOAD_CONFLICT");
  });

  it("separates users and fails closed without coordination", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-command-id" });
    await expect(getOrCreateBookingHoldIntent(scope, payload, storage())).rejects.toThrow(
      "BOOKING_INTENT_COORDINATION_UNAVAILABLE",
    );
  });

  it("keeps independent tenant/user scopes on independent command ids", async () => {
    vi.stubGlobal("navigator", { locks: { request: (_key: string, _options: unknown, fn: () => unknown) => fn() } });
    let sequence = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `command-${++sequence}-uuid` });
    const durable = storage();
    const first = await getOrCreateBookingHoldIntent(scope, payload, durable);
    const second = await getOrCreateBookingHoldIntent({ ...scope, userId: "user-2" }, payload, durable);
    expect(second.command.idempotencyKey).not.toBe(first.command.idempotencyKey);
  });

  it("rejects corrupted durable state and storage failures before dispatch", async () => {
    vi.stubGlobal("navigator", { locks: { request: (_key: string, _options: unknown, fn: () => unknown) => fn() } });
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-command-id" });
    const corrupted = { getItem: () => "{bad", setItem: () => { throw new Error("read-only"); } };
    await expect(getOrCreateBookingHoldIntent(scope, payload, corrupted)).rejects.toThrow("BOOKING_INTENT_CORRUPT");
    const unavailable = { getItem: () => null, setItem: () => { throw new Error("read-only"); } };
    await expect(getOrCreateBookingHoldIntent(scope, payload, unavailable)).rejects.toThrow("BOOKING_INTENT_STORAGE_UNAVAILABLE");
  });

  it("serializes two same-scope calls through Web Locks", async () => {
    let active = 0;
    let maxActive = 0;
    let queue = Promise.resolve();
    vi.stubGlobal("navigator", { locks: { request: (_key: string, _options: unknown, fn: () => unknown) => { const run = queue.then(async () => { active += 1; maxActive = Math.max(maxActive, active); const result = await fn(); active -= 1; return result; }); queue = run.then(() => undefined); return run; } } });
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-command-id" });
    const durable = storage();
    await Promise.all([getOrCreateBookingHoldIntent(scope, payload, durable), getOrCreateBookingHoldIntent(scope, payload, durable)]);
    expect(maxActive).toBe(1);
  });

  it("keeps accepted intent after payment request failure", async () => {
    vi.stubGlobal("navigator", { locks: { request: (_key: string, _options: unknown, fn: () => unknown) => fn() } });
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-command-id" });
    const durable = storage();
    const intent = await getOrCreateBookingHoldIntent(scope, payload, durable);
    markBookingHoldIntentAccepted(scope, intent.command, durable);
    const replay = await getOrCreateBookingHoldIntent(scope, payload, durable);
    expect(replay.state).toBe("ACCEPTED");
  });
});
