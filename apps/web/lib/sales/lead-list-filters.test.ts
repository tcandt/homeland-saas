import { describe, expect, it } from "vitest";
import { toSalesLeadListFilters } from "./lead-list-filters";

describe("sales lead list filters", () => {
  it("keeps only supported filters before they reach the lead list query", () => {
    expect(toSalesLeadListFilters(new URLSearchParams({
      search: "  Lan  ",
      status: "proposal",
      sort: "updatedAt",
      order: "asc",
    }))).toEqual({
      search: "Lan",
      status: "PROPOSAL",
      sort: "updatedAt",
      order: "asc",
    });
  });

  it("drops placeholder filter values that do not have an API contract", () => {
    expect(toSalesLeadListFilters(new URLSearchParams({
      status: "hot",
      sort: "source",
      order: "random",
    }))).toEqual({});
  });
});
