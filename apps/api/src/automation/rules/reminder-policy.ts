export type NotificationReminderDays = {
  invoiceDueSoonDays: number;
  invoiceOverdueDays: number;
  contractExpiringDays: number;
};

export const DEFAULT_REMINDER_DAYS: NotificationReminderDays = Object.freeze({
  invoiceDueSoonDays: 3,
  invoiceOverdueDays: 3,
  contractExpiringDays: 30,
});

export function normalizeReminderDays(value: unknown): NotificationReminderDays {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    invoiceDueSoonDays: normalizeDay(source.invoiceDueSoonDays, DEFAULT_REMINDER_DAYS.invoiceDueSoonDays, 0, 60),
    invoiceOverdueDays: normalizeDay(source.invoiceOverdueDays, DEFAULT_REMINDER_DAYS.invoiceOverdueDays, 0, 365),
    contractExpiringDays: normalizeDay(source.contractExpiringDays, DEFAULT_REMINDER_DAYS.contractExpiringDays, 0, 365),
  };
}

function normalizeDay(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}
