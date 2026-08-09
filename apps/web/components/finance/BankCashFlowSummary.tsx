"use client";

import React, { useMemo, useState } from "react";
import { Landmark, QrCode, WalletCards } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useBankCashFlowQuery } from "@/lib/queries/finance.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

function maskAccountNumber(value?: string) {
  if (!value) return "-";
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

export default function BankCashFlowSummary() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const params = useMemo(() => ({ year, ...(month ? { month } : {}) }), [month, year]);
  const { data, isLoading, isError } = useBankCashFlowQuery(params);
  const rows = Array.isArray(data?.rows) ? data.rows : [];

  const yearOptions = useMemo(() => (
    Array.from({ length: 5 }, (_, index) => {
      const value = String(currentYear - index);
      return { value, label: value };
    })
  ), [currentYear]);

  const monthOptions = [
    { value: "", label: "Cả năm" },
    ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Tháng ${index + 1}` })),
  ];

  return (
    <section className="overflow-hidden rounded-[16px] border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border p-[16px] md:flex-row md:items-start md:justify-between md:p-[20px]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#16a34a]">
            <Landmark size={14} /> SePay bank cashflow
          </div>
          <h2 className="mt-2 text-[16px] font-black text-text md:text-[18px]">Dòng tiền theo tài khoản bank</h2>
          <p className="mt-1 max-w-[720px] text-[12px] leading-5 text-muted md:text-[13px]">
            Tổng hợp QR đã tạo, tiền đã xác nhận và tiền đang chờ theo từng bank của owner. Dùng để đối soát tiền vào đúng chủ/tòa.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-[310px]">
          <Select value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
          <Select value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-border p-[16px] md:grid-cols-4 md:p-[20px]">
        <Metric icon={<WalletCards size={15} />} label="Tài khoản bank" value={data?.summary?.bankCount || 0} />
        <Metric icon={<QrCode size={15} />} label="QR đã tạo" value={data?.summary?.requestCount || 0} />
        <Metric label="Đã xác nhận" value={formatVnd(data?.summary?.confirmedAmount || 0)} tone="income" />
        <Metric label="Đang chờ" value={formatVnd(data?.summary?.pendingAmount || 0)} tone="warning" />
      </div>

      {isLoading && <div className="p-8 text-center text-[13px] font-semibold text-muted">Đang tải dòng tiền theo bank...</div>}
      {isError && <div className="p-8 text-center text-[13px] font-semibold text-rose-500">Không tải được báo cáo bank.</div>}

      {!isLoading && !isError && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-surface text-[11px] uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-black">Bank</th>
                <th className="px-4 py-3 font-black">Owner</th>
                <th className="px-4 py-3 font-black text-center">QR</th>
                <th className="px-4 py-3 font-black text-right">Đã xác nhận</th>
                <th className="px-4 py-3 font-black text-right">Đang chờ</th>
                <th className="px-4 py-3 font-black text-center">Trạng thái</th>
                <th className="px-4 py-3 font-black">Lần trả gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[13px] font-semibold text-muted">
                    Chưa có tài khoản bank hoặc payment request trong kỳ.
                  </td>
                </tr>
              )}
              {rows.map((row: any) => (
                <tr key={row.bankAccount.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-black text-text">{row.bankAccount.bankName}</div>
                    <div className="mt-1 text-[12px] font-semibold text-muted">
                      {row.bankAccount.accountName} · {maskAccountNumber(row.bankAccount.accountNumber)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-text">{row.owner?.name || "Chưa gắn owner"}</div>
                    <div className="text-[12px] text-muted">{row.owner?.code || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="font-black text-text">{row.requestCount}</div>
                    <div className="text-[11px] font-semibold text-muted">
                      {row.confirmedCount} xác nhận · {row.pendingCount} chờ
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-[#059669]">{formatVnd(row.confirmedAmount)}</td>
                  <td className="px-4 py-3 text-right font-black text-[#f97316]">{formatVnd(row.pendingAmount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${row.bankAccount.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {row.bankAccount.isActive ? "Đang bật" : "Đã tắt"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-muted">{formatDateTime(row.latestPaidAt || row.latestRequestAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ icon, label, value, tone }: { icon?: React.ReactNode; label: string; value: React.ReactNode; tone?: "income" | "warning" }) {
  const valueClass = tone === "income" ? "text-[#059669]" : tone === "warning" ? "text-[#f97316]" : "text-text";
  return (
    <div className="rounded-[14px] border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-[16px] font-black ${valueClass}`}>{value}</div>
    </div>
  );
}
