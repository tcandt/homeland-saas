import { describe, expect, it } from "vitest";
import { buildRevenueChart } from "./revenue-chart";

describe("signed revenue chart scale", () => {
  it("shows losses when revenue is zero without drawing outside the chart", () => {
    const chart = buildRevenueChart([{ revenue: 0, profit: 0 }, { revenue: 0, profit: -1_500_000 }]);
    expect(chart.minimum).toBe(-1_500_000);
    expect(chart.maximum).toBe(0);
    expect(chart.zeroY).toBe(0);
    expect(chart.points.map((point) => point.profitY)).toEqual([0, 100]);
    expect(chart.ticks).toEqual([0, -375_000, -750_000, -1_125_000, -1_500_000]);
  });

  it("uses both series for a common signed domain rather than a fixed 500M axis", () => {
    const chart = buildRevenueChart([{ revenue: 5_000_000, profit: 8_000_000 }, { revenue: -2_000_000, profit: -4_000_000 }]);
    expect(chart.minimum).toBe(-4_000_000);
    expect(chart.maximum).toBe(8_000_000);
    expect(chart.points[0].profitY).toBe(0);
    expect(chart.points[1].profitY).toBe(100);
    expect(chart.points[1].revenueTop).toBe(chart.zeroY);
    for (const point of chart.points) {
      for (const coordinate of [point.cx, point.profitY, point.revenueTop, point.revenueHeight]) {
        expect(coordinate).toBeGreaterThanOrEqual(0);
        expect(coordinate).toBeLessThanOrEqual(100);
      }
    }
  });

  it("keeps an all-zero history finite", () => {
    const chart = buildRevenueChart([{ revenue: 0, profit: 0 }]);
    expect(chart.zeroY).toBe(100);
    expect(chart.points[0]).toMatchObject({ revenueTop: 100, revenueHeight: 0, profitY: 100 });
    expect(chart.hasMissingValues).toBe(false);
  });

  it("does not fabricate zeros or connect the profit line across unknown periods", () => {
    const chart = buildRevenueChart([
      { revenue: "100", profit: "50" },
      { revenue: null, profit: undefined },
      { revenue: "", profit: Number.NaN },
      { revenue: Infinity, profit: -25 },
    ]);
    expect(chart.hasMissingValues).toBe(true);
    expect(chart.points[1]).toMatchObject({ revenueTop: null, revenueHeight: null, profitY: null });
    expect(chart.points[2]).toMatchObject({ revenueTop: null, profitY: null });
    expect(chart.points[3].revenueTop).toBeNull();
    expect(chart.profitSegments).toHaveLength(2);
    expect(chart.profitSegments[0]).not.toContain("87.5");
  });

  it("keeps opposite extreme amounts finite", () => {
    const chart = buildRevenueChart([{ revenue: Number.MAX_VALUE, profit: -Number.MAX_VALUE }]);
    expect(chart.zeroY).toBe(50);
    expect(chart.ticks.every(Number.isFinite)).toBe(true);
    expect(chart.points[0]).toMatchObject({ revenueTop: 0, revenueHeight: 50, profitY: 100 });
  });

  it("handles an empty history without fake values", () => {
    expect(buildRevenueChart([]).points).toEqual([]);
    expect(buildRevenueChart([]).profitSegments).toEqual([]);
  });
});
