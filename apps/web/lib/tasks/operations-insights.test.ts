import { describe, expect, it } from "vitest";
import { getOperationsInsights } from "./operations-insights";

describe("getOperationsInsights", () => {
  it("returns zeroes for an empty task list", () => {
    expect(getOperationsInsights([], { now: new Date("2026-09-23T12:00:00.000Z") })).toEqual({
      kind: "ready",
      metrics: { open: 0, overdue: 0, urgent: 0, review: 0 },
    });
  });

  it("does not calculate metrics while task data is loading", () => {
    expect(getOperationsInsights(undefined, { isLoading: true })).toEqual({ kind: "loading" });
  });

  it("reports a query error instead of presenting unavailable metrics", () => {
    expect(getOperationsInsights(undefined, { isError: true })).toEqual({ kind: "error" });
  });

  it("counts only active task statuses and valid overdue due dates", () => {
    expect(getOperationsInsights([
      { status: "TODO", priority: "URGENT", dueDate: "2026-09-22T12:00:00.000Z" },
      { status: "IN_PROGRESS", priority: "HIGH", dueDate: "2026-09-24T12:00:00.000Z" },
      { status: "REVIEW", priority: "URGENT", dueDate: "2026-09-20T12:00:00.000Z" },
      { status: "DONE", priority: "URGENT", dueDate: "2026-09-18T12:00:00.000Z" },
      { status: "CANCELLED", priority: "URGENT", dueDate: "invalid" },
    ], { now: new Date("2026-09-23T12:00:00.000Z") })).toEqual({
      kind: "ready",
      metrics: { open: 3, overdue: 2, urgent: 2, review: 1 },
    });
  });
});
