"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Landmark,
  QrCode,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Select } from "@/components/ui/Select";
import { useBankCashFlowQuery } from "@/lib/queries/finance.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} ₫`;

function formatMillions(val: number) {
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) {
    return `${(val / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${(val / 1_000).toFixed(0)}K`;
  }
  return String(val);
}

function maskAccountNumber(value?: string) {
  if (!value) return "-";
  if (value.length <= 4) return value;
  return `•••• ${value.slice(-4)}`;
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

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => {
        const value = String(currentYear - index);
        return { value, label: value };
      }),
    [currentYear],
  );

  const monthOptions = [
    { value: "", label: "Cả năm" },
    ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Tháng ${index + 1}` })),
  ];

  // Prepare chart data with distinct bank account labels
  const bankChartData = useMemo(() => {
    return rows.map((r: any) => {
      const bankName = r.bankAccount.bankName || "Ngân hàng";
      const accNum = r.bankAccount.accountNumber || "";
      const last4 = accNum.slice(-4);
      const label = last4 ? `${bankName} (${last4})` : bankName;

      return {
        id: r.bankAccount.id,
        name: label,
        fullName: `${bankName} - ${r.bankAccount.accountName || ""}`,
        accountNumber: r.bankAccount.accountNumber,
        confirmed: Number(r.confirmedAmount || 0),
        pending: Number(r.pendingAmount || 0),
        requestCount: Number(r.requestCount || 0),
      };
    });
  }, [rows]);

  return (
    <section
      data-testid="bank-cashflow-summary"
      className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs transition-all duration-200 hover:border-border hover:shadow-card"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border/50 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <Landmark size={13} />
            </span>
            Dòng tiền tự động SePay
          </div>
          <h2 className="mt-1 text-base font-black tracking-tight text-text md:text-lg">
            Dòng tiền theo tài khoản ngân hàng
          </h2>
          <p className="mt-0.5 text-xs text-muted max-w-[700px]">
            Tổng hợp QR động đã tạo, tiền đã xác nhận và tiền đang chờ đối soát theo từng tài khoản chủ sở hữu.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:min-w-[260px]">
          <Select
            data-testid="bank-cashflow-year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            options={yearOptions}
          />
          <Select
            data-testid="bank-cashflow-month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            options={monthOptions}
          />
        </div>
      </div>

      {/* KPI Stats + Integrated Recharts Visual Grid */}
      <div className="border-b border-border/50 p-5 md:p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
          {/* Left: 4 Stat Cards in 2x2 grid */}
          <div
            data-testid="bank-cashflow-kpis"
            className="grid grid-cols-2 gap-3"
          >
            <MetricCard
              icon={<WalletCards size={15} className="text-primary" />}
              label="Tài khoản ngân hàng"
              value={String(data?.summary?.bankCount || 0)}
              detail="Đang kết nối SePay"
            />
            <MetricCard
              icon={<QrCode size={15} className="text-sky-600" />}
              label="QR đã tạo"
              value={String(data?.summary?.requestCount || 0)}
              detail="Lượt quét thanh toán"
            />
            <MetricCard
              icon={<CheckCircle2 size={15} className="text-emerald-600" />}
              label="Đã xác nhận"
              value={formatVnd(data?.summary?.confirmedAmount || 0)}
              tone="income"
              detail="Đã ghi nhận tiền vào"
            />
            <MetricCard
              icon={<Clock size={15} className="text-amber-600" />}
              label="Đang chờ"
              value={formatVnd(data?.summary?.pendingAmount || 0)}
              tone="warning"
              detail="Chờ thanh toán / duyệt"
            />
          </div>

          {/* Right: Recharts Bank Cash Flow Comparison */}
          <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-surface/30 p-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-text flex items-center gap-1.5">
                <TrendingUp size={13} className="text-primary" /> So sánh tiền vào theo tài khoản
              </span>
              <div className="flex items-center gap-3 text-[10px] font-semibold text-muted">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-xs bg-emerald-500" /> Đã xác nhận
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-xs bg-amber-500" /> Đang chờ
                </span>
              </div>
            </div>

            <div className="h-[140px] w-full pt-2">
              {bankChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted">
                  Chưa có dữ liệu giao dịch trong kỳ
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bankChartData}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    barGap={4}
                  >
                    <defs>
                      <linearGradient id="confirmedBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.9} />
                      </linearGradient>
                      <linearGradient id="pendingBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.35} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 11, fontWeight: 600 }}
                      dy={4}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 600 }}
                      tickFormatter={formatMillions}
                    />
                    <Tooltip content={<BankChartTooltip />} />
                    <Bar
                      dataKey="confirmed"
                      name="Đã xác nhận"
                      fill="url(#confirmedBarGrad)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                    <Bar
                      dataKey="pending"
                      name="Đang chờ"
                      fill="url(#pendingBarGrad)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div data-testid="bank-cashflow-loading" className="p-8 text-center text-xs font-semibold text-muted">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Đang tải dòng tiền ngân hàng...
        </div>
      )}

      {isError && (
        <div data-testid="bank-cashflow-error" className="p-8 text-center text-xs font-semibold text-rose-500">
          Không tải được báo cáo dòng tiền ngân hàng.
        </div>
      )}

      {!isLoading && !isError && (
        <div data-testid="bank-cashflow-table-wrap" className="overflow-x-auto">
          <table data-testid="bank-cashflow-table" className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border/50 bg-surface/50 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-black">Ngân hàng & Số tài khoản</th>
                <th className="px-5 py-3 font-black">Chủ sở hữu</th>
                <th className="px-5 py-3 text-center font-black">Lượt QR</th>
                <th className="px-5 py-3 text-right font-black">Đã xác nhận</th>
                <th className="px-5 py-3 text-right font-black">Đang chờ</th>
                <th className="px-5 py-3 text-center font-black">Trạng thái</th>
                <th className="px-5 py-3 font-black">Thanh toán gần nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.length === 0 && (
                <tr>
                  <td
                    data-testid="bank-cashflow-empty"
                    colSpan={7}
                    className="px-4 py-12 text-center text-xs font-semibold text-muted"
                  >
                    Chưa có tài khoản ngân hàng hoặc payment request trong kỳ.
                  </td>
                </tr>
              )}
              {rows.map((row: any) => (
                <tr
                  key={row.bankAccount.id}
                  data-testid={`bank-cashflow-row-${row.bankAccount.id}`}
                  className="transition hover:bg-surface/40"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface border border-border/60 text-xs font-black text-text shadow-2xs">
                        {row.bankAccount.bankName?.slice(0, 3)?.toUpperCase() || "NH"}
                      </div>
                      <div>
                        <div className="font-bold text-text text-sm">{row.bankAccount.bankName}</div>
                        <div className="text-[11px] text-muted font-medium">
                          {row.bankAccount.accountName} · <span className="font-mono">{maskAccountNumber(row.bankAccount.accountNumber)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-text">{row.owner?.name || "Chưa gắn"}</div>
                    <div className="text-[11px] text-muted">{row.owner?.code || "-"}</div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="font-mono font-bold text-text">{row.requestCount}</div>
                    <div className="text-[10px] text-muted">
                      {row.confirmedCount} khớp · {row.pendingCount} chờ
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {formatVnd(row.confirmedAmount)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                    {formatVnd(row.pendingAmount)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        row.bankAccount.isActive
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          : "bg-surface text-muted border border-border/60"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${row.bankAccount.isActive ? "bg-emerald-500" : "bg-muted"}`} />
                      {row.bankAccount.isActive ? "Đang bật" : "Đã tắt"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[11px] text-muted">
                    {formatDateTime(row.latestPaidAt || row.latestRequestAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
  detail,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "income" | "warning";
  detail?: string;
}) {
  const valueClass =
    tone === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-text";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-card p-3.5 shadow-2xs">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`mt-2 font-mono text-lg font-black ${valueClass}`}>{value}</div>
      {detail && <div className="mt-0.5 text-[10px] text-muted truncate">{detail}</div>}
    </div>
  );
}

function BankChartTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;

  return (
    <div className="z-50 min-w-[200px] rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md">
      <div className="border-b border-border/60 pb-1.5">
        <div className="text-xs font-black text-text">{d.fullName}</div>
        <div className="text-[10px] text-muted font-mono">{d.accountNumber}</div>
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted">Đã xác nhận:</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {formatVnd(d.confirmed)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Đang chờ:</span>
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
            {formatVnd(d.pending)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Tổng QR:</span>
          <span className="font-mono font-bold text-text">{d.requestCount}</span>
        </div>
      </div>
    </div>
  );
}
