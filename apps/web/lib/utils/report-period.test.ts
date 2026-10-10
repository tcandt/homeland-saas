import { describe, expect, it } from "vitest";
import { getVietnamCurrentMonth, getVietnamCurrentPeriod, getVietnamMonthBounds, getVietnamMonthRange, getVietnamMonthRangeBounds, shiftReportMonth } from "./report-period";

describe("GMT+7 reporting periods", () => {
  it("changes month and year at Vietnam midnight, independent of host timezone", () => {
    expect(getVietnamCurrentMonth(new Date("2026-12-31T16:59:59Z"))).toEqual({ year: 2026, month: 12 });
    expect(getVietnamCurrentMonth(new Date("2026-12-31T17:00:00Z"))).toEqual({ year: 2027, month: 1 });
    expect(getVietnamCurrentPeriod(new Date("2026-09-30T17:00:00Z"))).toBe("2026-10");
  });
  it("uses half-open Vietnam bounds, including leap February and December", () => {
    expect(getVietnamMonthBounds({ year: 2028, month: 2 })).toEqual({ startDate: "2028-01-31T17:00:00.000Z", endDate: "2028-02-29T17:00:00.000Z" });
    expect(getVietnamMonthBounds({ year: 2026, month: 12 }).endDate).toBe("2026-12-31T17:00:00.000Z");
  });
  it("ends recent-month presets in the current month and rolls the year", () => {
    const now = new Date("2027-01-01T00:00:00Z");
    expect(getVietnamMonthRange(1, now)).toEqual({ startYear: 2027, startMonth: 1, endYear: 2027, endMonth: 1 });
    expect(getVietnamMonthRange(3, now).startMonth).toBe(11);
    expect(getVietnamMonthRange(6, now).startMonth).toBe(8);
    expect(getVietnamMonthRange(12, now)).toEqual({ startYear: 2026, startMonth: 2, endYear: 2027, endMonth: 1 });
  });
  it("rejects invalid months, counts and reversed ranges", () => {
    expect(() => getVietnamMonthBounds({ year: 2026, month: 13 })).toThrow();
    expect(() => shiftReportMonth({ year: 2026, month: 1 }, 0.5)).toThrow();
    expect(() => getVietnamMonthRange(0)).toThrow();
    expect(() => getVietnamMonthRangeBounds({ startYear: 2026, startMonth: 10, endYear: 2026, endMonth: 9 })).toThrow();
  });
});
