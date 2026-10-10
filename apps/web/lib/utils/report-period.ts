export type ReportMonth = { year: number; month: number };
export type ReportMonthRange = {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
};

export function getVietnamCurrentMonth(now = new Date()): ReportMonth {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

function assertMonth(period: ReportMonth) {
  if (!Number.isInteger(period.year) || period.year < 100 || period.year > 9998 ||
      !Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    throw new RangeError("Kỳ báo cáo không hợp lệ");
  }
}

export function shiftReportMonth(period: ReportMonth, offset: number): ReportMonth {
  assertMonth(period);
  if (!Number.isInteger(offset)) throw new RangeError("Khoảng tháng không hợp lệ");
  const shifted = new Date(Date.UTC(period.year, period.month - 1 + offset, 1));
  const result = { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
  assertMonth(result);
  return result;
}

export function getVietnamMonthRange(months = 1, now = new Date()): ReportMonthRange {
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new RangeError("Khoảng tháng không hợp lệ");
  }
  const end = getVietnamCurrentMonth(now);
  const start = shiftReportMonth(end, 1 - months);
  return { startYear: start.year, startMonth: start.month, endYear: end.year, endMonth: end.month };
}

/** endDate is exclusive. Inclusive legacy APIs must subtract one millisecond. */
export function getVietnamMonthRangeBounds(range: ReportMonthRange) {
  const start = { year: range.startYear, month: range.startMonth };
  const end = { year: range.endYear, month: range.endMonth };
  assertMonth(start);
  assertMonth(end);
  if (start.year * 12 + start.month > end.year * 12 + end.month) {
    throw new RangeError("Ngày bắt đầu phải trước ngày kết thúc");
  }
  const offset = 7 * 60 * 60 * 1000;
  return {
    startDate: new Date(Date.UTC(start.year, start.month - 1, 1) - offset).toISOString(),
    endDate: new Date(Date.UTC(end.year, end.month, 1) - offset).toISOString(),
  };
}

export function getVietnamMonthBounds(period: ReportMonth) {
  return getVietnamMonthRangeBounds({
    startYear: period.year, startMonth: period.month,
    endYear: period.year, endMonth: period.month,
  });
}

export function getVietnamCurrentPeriod(now = new Date()) {
  const { year, month } = getVietnamCurrentMonth(now);
  return `${year}-${String(month).padStart(2, "0")}`;
}
