import { describe, expect, it } from "vitest";
import { getOperationsContractKpiSummary } from "../../lib/contracts/operations-contract-kpi";

describe("operations contract KPI summary", () => {
  it("keeps approved contracts out of active and in the pending-review count", () => {
    const summary = getOperationsContractKpiSummary(
      [
        { status: "ACTIVE", endDate: "2027-01-01T00:00:00.000Z" },
        { status: "APPROVED" },
        { status: "PENDING_APPROVAL" },
        { status: "EXPIRING" },
      ],
      new Date("2026-09-26T00:00:00.000Z"),
    );

    expect(summary).toEqual({
      total: 4,
      active: 1,
      expiring: 1,
      pending: 2,
      debt: 0,
    });
  });

  it("counts an active contract ending within 30 days as expiring without changing active count", () => {
    const summary = getOperationsContractKpiSummary(
      [{ status: "ACTIVE", endDate: "2026-10-10T00:00:00.000Z" }],
      new Date("2026-09-26T00:00:00.000Z"),
    );

    expect(summary).toEqual({
      total: 1,
      active: 1,
      expiring: 1,
      pending: 0,
      debt: 0,
    });
  });
});
