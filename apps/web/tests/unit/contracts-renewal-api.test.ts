import { beforeEach, describe, expect, it, vi } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../../lib/api/client", () => ({
  apiClient: { post },
}));

import { contractsApi } from "../../lib/api/contracts.api";

describe("contractsApi.renew", () => {
  beforeEach(() => {
    post.mockReset();
  });

  it("sends the renewal payload with one validated idempotency key in body and header", async () => {
    await contractsApi.renew(
      "contract-1",
      {
        startDate: "2026-10-01",
        endDate: "2027-09-30",
        rentAmount: 2_000_000,
        depositAmount: 2_000_000,
        memberCount: 2,
        firstPaymentDate: "2026-10-01",
      },
      "renewal-command-123",
    );

    expect(post).toHaveBeenCalledWith(
      "/contracts/contract-1/renew",
      expect.objectContaining({ idempotencyKey: "renewal-command-123" }),
      { headers: { "Idempotency-Key": "renewal-command-123" } },
    );
  });

  it("fails before issuing a request when the idempotency key is invalid", () => {
    expect(() =>
      contractsApi.renew(
        "contract-1",
        { startDate: "2026-10-01", endDate: "2027-09-30" },
        "short",
      ),
    ).toThrow("IDEMPOTENCY_KEY_REQUIRED");
    expect(post).not.toHaveBeenCalled();
  });
});
