"use client";

import React, { useMemo } from "react";
import dayjs from "dayjs";
import { AlertCircle, CheckCircle2, Clock, FileText, Loader2, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useDashboardQuery } from "@/lib/queries/dashboard.queries";
import { useCashFlowQuery, useLedgerQuery, useOwnerProfitSummaryQuery, useProfitLossQuery } from "@/lib/queries/finance.queries";

function formatMoney(amount: number) {
  if (Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} Tr`;
  }
  return amount.toLocaleString("vi-VN");
}

function getLedgerAmount(row: any) {
  return Number(row.debit || 0) - Number(row.credit || 0);
}

export default function FinanceMobileFlow() {
  const { data: dashboard, isLoading: isDashboardLoading } = useDashboardQuery();
  const { data: cashflow, isLoading: isCashFlowLoading } = useCashFlowQuery();
  const { data: profitLoss, isLoading: isProfitLossLoading } = useProfitLossQuery();
  const { data: ownerRows, isLoading: isOwnerLoading } = useOwnerProfitSummaryQuery();
  const { data: ledgerRows, isLoading: isLedgerLoading, isError } = useLedgerQuery();

  const isLoading = isDashboardLoading || isCashFlowLoading || isProfitLossLoading || isLedgerLoading || isOwnerLoading;
  const rows = ledgerRows || [];
  const owners = Array.isArray(ownerRows) ? ownerRows : [];
  const occupancy = (dashboard as any)?.occupancy || {};

  const stats = useMemo(() => {
    const draftCount = rows.filter((row: any) => row.status === "DRAFT").length;
    const postedCount = rows.filter((row: any) => row.status === "POSTED").length;
    const depositCount = rows.filter((row: any) => row.sourceType === "DEPOSIT").length;
    const expenseCount = rows.filter((row: any) => row.sourceType === "EXPENSE").length;

    return {
      inflow: Number((cashflow as any)?.inflow || 0),
      outflow: Number((cashflow as any)?.outflow || 0),
      netCash: Number((cashflow as any)?.net || 0),
      revenue: Number((profitLoss as any)?.revenue || 0),
      expense: Number((profitLoss as any)?.expense || 0),
      profit: Number((profitLoss as any)?.profit || 0),
      margin: Number((profitLoss as any)?.margin || 0),
      draftCount,
      postedCount,
      depositCount,
      expenseCount,
    };
  }, [cashflow, profitLoss, rows]);

  const recentRows = useMemo(() => rows.slice(0, 8), [rows]);

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="finance-mobile-error" className="rounded-[12px] border border-rose-500/20 bg-rose-500/10 p-4 text-[13px] font-bold text-rose-500">
        Không tải được dữ liệu tài chính từ API.
      </div>
    );
  }

  return (
    <div data-testid="finance-mobile-flow" className="flex w-full flex-col gap-[16px] bg-background pb-[100px]">
      <section className="grid grid-cols-2 gap-3">
        <MetricCard label="Tổng thu" value={formatMoney(stats.inflow)} icon={<TrendingUp size={16} />} tone="text-[#4f46e5] bg-[#4f46e5]/10 border-[#4f46e5]/20" />
        <MetricCard label="Tổng chi" value={formatMoney(stats.outflow)} icon={<TrendingDown size={16} />} tone="text-rose-500 bg-rose-500/10 border-rose-500/20" />
        <MetricCard
          label="Lợi nhuận"
          value={formatMoney(stats.profit)}
          icon={<Wallet size={16} />}
          tone={stats.profit >= 0 ? "text-[#16a34a] bg-[#16a34a]/10 border-[#16a34a]/20" : "text-rose-500 bg-rose-500/10 border-rose-500/20"}
        />
        <MetricCard
          label="Lấp đầy"
          value={`${Number(occupancy.rate || 0).toFixed(0)}%`}
          icon={<CheckCircle2 size={16} />}
          tone="text-[#0ea5e9] bg-[#0ea5e9]/10 border-[#0ea5e9]/20"
        />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <SmallStat label="Biên LN" value={`${stats.margin.toFixed(1)}%`} />
        <SmallStat label="Nháp" value={stats.draftCount.toString()} />
        <SmallStat label="Đã ghi sổ" value={stats.postedCount.toString()} />
      </section>

      <section className="rounded-[12px] border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-black text-text">Đối soát từ dữ liệu ghi sổ</h3>
          <AlertCircle size={16} className="text-muted" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px] font-bold">
          <div className="rounded-[8px] bg-orange-500/10 p-3 text-orange-500">{stats.draftCount} bút toán nháp</div>
          <div className="rounded-[8px] bg-blue-500/10 p-3 text-blue-500">{stats.depositCount} nguồn tiền cọc</div>
          <div className="rounded-[8px] bg-rose-500/10 p-3 text-rose-500">{stats.expenseCount} nguồn chi phí</div>
          <div className="rounded-[8px] bg-[#16a34a]/10 p-3 text-[#16a34a]">{stats.postedCount} bút toán đã ghi sổ</div>
        </div>
      </section>

      <section className="rounded-[12px] border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-black text-text">Theo chủ sở hữu</h3>
          <span className="text-[11px] font-bold text-muted">{owners.length} chủ</span>
        </div>

        {owners.length === 0 ? (
          <div className="rounded-[10px] bg-surface p-3 text-[12px] font-semibold text-muted">Chưa có dữ liệu owner để hiển thị trên mobile.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {owners.slice(0, 3).map((owner: any) => (
              <div key={owner.owner?.id || owner.owner?.code} className="rounded-[10px] border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-black text-text">{owner.owner?.name || owner.owner?.code || "Chủ sở hữu"}</div>
                    <div className="mt-1 truncate text-[11px] font-semibold text-muted">
                      {(owner.buildings || []).map((building: any) => building.code).join(", ") || "Chưa gắn tòa"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase text-muted">Còn lại</div>
                    <div className="text-[13px] font-black text-[#059669]">{formatMoney(Number(owner.profitAfterAdvance || 0))}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <MiniMetric label="Thu" value={formatMoney(Number(owner.revenue || 0))} tone="text-[#4f46e5]" />
                  <MiniMetric label="Chi" value={formatMoney(Number(owner.expense || 0))} tone="text-rose-500" />
                  <MiniMetric label="Ứng hộ" value={formatMoney(Number(owner.advanceReceivable || 0))} tone="text-[#16a34a]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[12px] border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="text-[14px] font-black text-text">Sổ cái gần nhất</h3>
          <span className="text-[11px] font-bold text-muted">{rows.length} dòng</span>
        </div>

        {recentRows.length === 0 ? (
          <div data-testid="empty-finance-mobile-state" className="p-5 text-center text-[13px] font-medium text-muted">
            Chưa có giao dịch nào trong dữ liệu ghi sổ.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentRows.map((row: any) => {
              const amount = getLedgerAmount(row);
              const isInflow = amount >= 0;
              return (
                <div key={row.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-black/5 dark:bg-white/5">
                    {isInflow ? <Receipt size={16} className="text-[#4f46e5]" /> : <FileText size={16} className="text-rose-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-text">{row.description || row.journalCode}</div>
                    <div className="flex items-center gap-1 text-[10px] font-medium text-muted">
                      <Clock size={10} /> {dayjs(row.date).format("DD/MM/YY HH:mm")} - {row.accountCode || "N/A"}
                    </div>
                  </div>
                  <div className={`shrink-0 text-right text-[12px] font-black ${isInflow ? "text-[#4f46e5]" : "text-rose-500"}`}>
                    {isInflow ? "+" : "-"}
                    {formatMoney(Math.abs(amount))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className={`rounded-[12px] border p-3 shadow-sm ${tone}`}>
      <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase">
        <span>{label}</span>
        {icon}
      </div>
      <div className="truncate text-[22px] font-black leading-none text-text">{value}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3 text-center">
      <div className="text-[18px] font-black text-text">{value}</div>
      <div className="text-[10px] font-bold uppercase text-muted">{label}</div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-[8px] bg-card p-2 text-center">
      <div className="text-[10px] font-black uppercase text-muted">{label}</div>
      <div className={`mt-1 truncate text-[12px] font-black ${tone}`}>{value}</div>
    </div>
  );
}
