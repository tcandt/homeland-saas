export function resolveHunonicRateMode(liveMode?: unknown, storedMode?: unknown) {
  if (liveMode === "custom" || liveMode === "residential") return liveMode;
  if (storedMode === "custom" || storedMode === "residential") return storedMode;
  return "residential";
}

export function formatHunonicHistoryValue(
  value: unknown,
  format: (value: number) => string,
) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? format(number) : "—";
}
