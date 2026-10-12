type HistoryValue = { revenue?: unknown; profit?: unknown };

function finiteAmount(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/** Revenue and profit share a signed axis; missing amounts are not fabricated zeros. */
export function buildRevenueChart(history: HistoryValue[]) {
  const amounts = history.map((row) => ({ revenue: finiteAmount(row.revenue), profit: finiteAmount(row.profit) }));
  const known = amounts.flatMap(({ revenue, profit }) => [revenue, profit]).filter((value): value is number => value !== null);
  const minimum = Math.min(0, ...known);
  const maximum = Math.max(0, ...known) || (minimum === 0 ? 1 : 0);
  // Normalize before subtracting to keep the scale finite even for large values.
  const magnitude = Math.max(Math.abs(minimum), Math.abs(maximum), 1);
  const normalizedMinimum = minimum / magnitude;
  const normalizedMaximum = maximum / magnitude;
  const span = normalizedMaximum - normalizedMinimum;
  const y = (amount: number) => 100 * (normalizedMaximum - amount / magnitude) / span;
  const zeroY = y(0);
  const points = amounts.map(({ revenue, profit }, index) => {
    const revenueY = revenue === null ? null : y(revenue);
    return {
      cx: (index + 0.5) * 100 / amounts.length,
      revenue,
      profit,
      revenueTop: revenueY === null ? null : Math.min(zeroY, revenueY),
      revenueHeight: revenueY === null ? null : Math.abs(zeroY - revenueY),
      profitY: profit === null ? null : y(profit),
    };
  });
  const profitSegments: string[] = [];
  let segment: string[] = [];
  for (const point of points) {
    if (point.profitY === null) {
      if (segment.length) profitSegments.push(segment.join(" "));
      segment = [];
    } else segment.push(`${point.cx},${point.profitY}`);
  }
  if (segment.length) profitSegments.push(segment.join(" "));
  return {
    points, profitSegments, zeroY, minimum, maximum,
    ticks: Array.from({ length: 5 }, (_, index) =>
      (normalizedMaximum * (1 - index / 4) + normalizedMinimum * index / 4) * magnitude),
    hasMissingValues: amounts.some(({ revenue, profit }) => revenue === null || profit === null),
  };
}
