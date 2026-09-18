import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../lib/api/client";
import { depositsApi } from "../../lib/api/deposits.api";
import { contractsApi } from "../../lib/api/contracts.api";
import { buildCancelDepositPayload } from "../../lib/mutations/deposits.mutations";

describe("CORE-04/05: deposit command contracts and money invariants", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("cancel allocation conservation", () => {
    it("builds the production payload when allocations equal the ledger balance", () => {
      expect(
        buildCancelDepositPayload({
          reason: "Khách hủy và hoàn một phần",
          availableBalance: 5_000_000,
          refundAmount: 2_000_000,
          keepAmount: 2_500_000,
          deductAmount: 500_000,
          receiptStatus: "PENDING",
        }),
      ).toEqual({
        reason: "Khách hủy và hoàn một phần",
        refundAmount: 2_000_000,
        keepAmount: 2_500_000,
        deductAmount: 500_000,
        refundStatus: "PENDING",
      });
    });

    it.each([
      {
        name: "under-allocation",
        availableBalance: 5_000_000,
        refundAmount: 2_000_000,
        keepAmount: 0,
        deductAmount: 0,
      },
      {
        name: "over-allocation",
        availableBalance: 5_000_000,
        refundAmount: 5_000_001,
        keepAmount: 0,
        deductAmount: 0,
      },
      {
        name: "negative allocation",
        availableBalance: 5_000_000,
        refundAmount: -1,
        keepAmount: 5_000_001,
        deductAmount: 0,
      },
    ])("rejects $name before sending a command", (allocation) => {
      expect(() =>
        buildCancelDepositPayload({
          ...allocation,
          reason: "Phân bổ không hợp lệ",
          receiptStatus: "PENDING",
        }),
      ).toThrow();
    });

    it("sends only the ledger cancel endpoint with a mandatory idempotency key", async () => {
      const postSpy = vi
        .spyOn(apiClient, "post")
        .mockResolvedValue({ data: { success: true } } as any);
      const payload = buildCancelDepositPayload({
        reason: "Khách thay đổi kế hoạch",
        availableBalance: 5_000_000,
        refundAmount: 3_000_000,
        keepAmount: 2_000_000,
        deductAmount: 0,
        receiptStatus: "COMPLETED",
      });

      await depositsApi.cancel("dep-101", payload, "cancel-command-101");

      expect(postSpy).toHaveBeenCalledWith(
        "/deposits/dep-101/commands/cancel",
        { ...payload, idempotencyKey: "cancel-command-101" },
        { headers: { "Idempotency-Key": "cancel-command-101" } },
      );
    });
  });

  describe("conversion matrix B < C, B = C, B > C", () => {
    it.each([
      {
        name: "B < C: collect shortfall",
        depositId: "dep-shortfall",
        securityRequired: 7_000_000,
        excessAction: undefined,
      },
      {
        name: "B = C: transfer exact balance",
        depositId: "dep-exact",
        securityRequired: 5_000_000,
        excessAction: undefined,
      },
      {
        name: "B > C: create customer credit",
        depositId: "dep-excess-credit",
        securityRequired: 3_000_000,
        excessAction: "CREDIT" as const,
      },
      {
        name: "B > C: create pending refund",
        depositId: "dep-excess-refund",
        securityRequired: 3_000_000,
        excessAction: "REFUND" as const,
      },
    ])("$name", async ({ depositId, securityRequired, excessAction }) => {
      const postSpy = vi
        .spyOn(apiClient, "post")
        .mockResolvedValue({ data: { success: true } } as any);
      const idempotencyKey = `convert-${depositId}`;

      await depositsApi.convertToContract(
        depositId,
        {
          securityRequired,
          contractId: "contract-1",
          excessAction,
          refundStatus: excessAction === "REFUND" ? "PENDING" : undefined,
        },
        idempotencyKey,
      );

      expect(postSpy).toHaveBeenCalledWith(
        `/deposits/${depositId}/convert-contract`,
        expect.objectContaining({
          securityRequired,
          contractId: "contract-1",
          excessAction,
          idempotencyKey,
        }),
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
    });
  });

  it("fails locally when a financial command has no valid idempotency key", () => {
    expect(() =>
      depositsApi.cancel(
        "dep-1",
        {
          reason: "Không có khóa",
          refundAmount: 0,
          keepAmount: 1,
          deductAmount: 0,
        },
        "",
      ),
    ).toThrow("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("completes a pending refund by operationId only", async () => {
    const postSpy = vi
      .spyOn(apiClient, "post")
      .mockResolvedValue({ data: { success: true } } as any);

    await depositsApi.completePendingRefund(
      "operation-pending-555",
      "Đã đối soát ngân hàng",
      "complete-refund-555",
    );

    expect(postSpy).toHaveBeenCalledWith(
      "/deposits/operations/operation-pending-555/refund/complete",
      {
        note: "Đã đối soát ngân hàng",
        idempotencyKey: "complete-refund-555",
      },
      { headers: { "Idempotency-Key": "complete-refund-555" } },
    );
  });

  describe("CORE-06: contract activation command", () => {
    it("sends the activation idempotency key from UI adapter to API", async () => {
      const postSpy = vi
        .spyOn(apiClient, "post")
        .mockResolvedValue({ data: { success: true } } as any);

      await contractsApi.activate("contract-101", "activate-contract-101");

      expect(postSpy).toHaveBeenCalledWith(
        "/contracts/contract-101/activate",
        {},
        { headers: { "Idempotency-Key": "activate-contract-101" } },
      );
    });

    it("rejects activation locally when the command key is missing", () => {
      expect(() => contractsApi.activate("contract-101", "")).toThrow(
        "IDEMPOTENCY_KEY_REQUIRED",
      );
    });
  });
});
