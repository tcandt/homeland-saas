export function remainingContractDays(endDate: string, now = new Date()): number {
  const today = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const end = String(endDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return 0;
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}
