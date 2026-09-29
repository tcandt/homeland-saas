import React from "react";
import dayjs from "dayjs";

const money = (amount: number) => `${amount.toLocaleString("vi-VN", { maximumFractionDigits: 0 })} đ`;

export function BookingConversionPaymentSummary({
  rentAmount,
  securityAmount,
  paidDepositAmount,
  totalDue,
  startDate,
  totalTestId,
}: {
  rentAmount: number;
  securityAmount: number;
  paidDepositAmount: number;
  totalDue: number;
  startDate?: string;
  totalTestId: string;
}) {
  const start = startDate ? dayjs(startDate) : null;
  const rentPeriod = start?.isValid()
    ? `${start.format("DD/MM")} - ${start.endOf("month").format("DD/MM/YYYY")}`
    : null;

  return (
    <dl className="w-full border-t border-border text-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-3">
        <dt className="min-w-0 text-text">
          Tiền phòng kỳ đầu
          {rentPeriod && <span className="mt-0.5 block text-xs text-muted">{rentPeriod}</span>}
        </dt>
        <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-text">{money(rentAmount)}</dd>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-3">
        <dt className="min-w-0 text-text">Cọc hợp đồng</dt>
        <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-text">{money(securityAmount)}</dd>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-3">
        <dt className="min-w-0 text-muted">Trừ cọc đã thanh toán</dt>
        <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-success">- {money(paidDepositAmount)}</dd>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-t border-border py-3">
        <dt className="min-w-0 font-bold text-text">Cần thanh toán thêm</dt>
        <dd data-testid={totalTestId} className="whitespace-nowrap text-right text-base font-bold tabular-nums text-primary">{money(totalDue)}</dd>
      </div>
    </dl>
  );
}
