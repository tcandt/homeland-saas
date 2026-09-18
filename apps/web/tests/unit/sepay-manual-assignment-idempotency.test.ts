import { describe, expect, it, vi } from "vitest";
import {
  financeApi,
  manualSePayAssignmentIdempotencyKey,
  type ManualSePayAssignment,
} from "../../lib/api/finance.api";
import { apiClient } from "../../lib/api/client";

const assignment: ManualSePayAssignment = {
  logId: "sepay-log-101",
  sourceType: "INVOICE",
  sourceCode: "INV-101",
};

describe("CORE-08 manual SePay assignment idempotency", () => {
  it("reuses one explicit header when a failed logical assignment is retried", async () => {
    const post = vi.spyOn(apiClient, "post")
      .mockRejectedValueOnce(new Error("request completion lost"))
      .mockResolvedValueOnce({ id: "payment-101" } as never);
    const key = manualSePayAssignmentIdempotencyKey(assignment);

    await expect(financeApi.manualAssignSePayTransaction(assignment, key)).rejects.toThrow("request completion lost");
    await financeApi.manualAssignSePayTransaction(assignment, key);

    expect(post).toHaveBeenNthCalledWith(1, "/payments/sepay/manual-assign", assignment, {
      headers: { "Idempotency-Key": key },
    });
    expect(post).toHaveBeenNthCalledWith(2, "/payments/sepay/manual-assign", assignment, {
      headers: { "Idempotency-Key": key },
    });
  });

  it("uses a distinct key for a distinct logical assignment", () => {
    expect(manualSePayAssignmentIdempotencyKey({ ...assignment, sourceCode: "INV-102" }))
      .not.toBe(manualSePayAssignmentIdempotencyKey(assignment));
    expect(manualSePayAssignmentIdempotencyKey({ ...assignment, sourceType: "DEPOSIT" }))
      .not.toBe(manualSePayAssignmentIdempotencyKey(assignment));
  });
});
