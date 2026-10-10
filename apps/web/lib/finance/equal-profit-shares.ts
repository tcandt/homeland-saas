// Keep the first owner's existing rounding rule; assign the residual to the
// second owner so the two shares always conserve the reported profit/loss.
export function splitEqualProfit(total: number): [number, number] {
  if (!Number.isFinite(total)) throw new RangeError("Profit must be finite");
  const first = Math.round(total / 2);
  return [first, total - first];
}
