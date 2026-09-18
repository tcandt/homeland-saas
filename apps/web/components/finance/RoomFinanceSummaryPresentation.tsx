"use client";

import type { RoomFinanceSummary } from "@/lib/types/finance-summary";

const vnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

export type FinanceSourceTarget = {
  rentalCycleId: string;
  customerId: string | null;
  contractId: string | null;
  source: { entity: string; id: string | null; code: string | null };
};

/** Preserve the authoritative cycle identity when opening any aggregated source. */
export function createFinanceSourceTarget(
  context: Omit<FinanceSourceTarget, "source">,
  source: FinanceSourceTarget["source"],
): FinanceSourceTarget {
  return { ...context, source };
}

function SourceList({
  sources,
  context,
  onOpenSource,
}: {
  sources?: Array<{
    source: { entity: string; id: string | null; code: string | null };
    contractId?: string | null;
  }>;
  context: Omit<FinanceSourceTarget, "source">;
  onOpenSource?: (target: FinanceSourceTarget) => void;
}) {
  if (!sources?.length) return <span className="text-muted">Chưa có chứng từ nguồn</span>;
  return <ul className="space-y-1">{sources.map(({ source, contractId }, index) => (
    <li key={`${source.entity}:${source.id || index}`}>
      {source.id && onOpenSource ? (
        <button
          type="button"
          data-testid={`finance-source-${source.entity}-${source.id}`}
          onClick={() => onOpenSource(createFinanceSourceTarget({ ...context, contractId: contractId || context.contractId }, source))}
          className="font-mono text-[11px] text-primary underline underline-offset-2"
        >
          {source.entity}: {source.code || source.id}
        </button>
      ) : (
        <span className="font-mono text-[11px] text-muted">{source.entity}: {source.code || source.id || "không có mã"}</span>
      )}
    </li>
  ))}</ul>;
}

export function RoomFinanceSummaryPresentation({
  summary,
  isLoading,
  error,
  onRetry,
  onSelectCycle,
  onOpenSource,
}: {
  summary?: RoomFinanceSummary | null;
  isLoading: boolean;
  error?: unknown;
  onRetry: () => void;
  onSelectCycle: (rentalCycleId: string) => void;
  onOpenSource?: (target: FinanceSourceTarget) => void;
}) {
  if (isLoading) return <div role="status" className="p-8 rounded-2xl border border-border/60 bg-card text-sm text-muted">Đang tải số liệu tài chính tổng phòng…</div>;
  if (error) return <div role="alert" className="p-5 rounded-2xl border border-rose-300 bg-rose-50 text-rose-800"><p className="font-bold">Không thể tải số liệu tài chính tổng phòng.</p><button type="button" onClick={onRetry} className="mt-2 text-xs font-bold underline">Tải lại</button></div>;
  if (!summary) return <div className="p-8 rounded-2xl border-2 border-dashed border-border/60 text-center text-sm text-muted">Chưa có dữ liệu tài chính cho phòng này.</div>;

  const cards = [
    ["Tổng phải thu", summary.totals.invoiceTotal],
    ["Đã thu", summary.totals.cashReceived],
    ["Đang nợ", summary.totals.outstanding],
    ["Số dư cọc", summary.totals.depositBalance],
  ];
  return <div data-testid="room-finance-total" className="flex flex-col gap-4">
    <p className="text-xs text-muted">Tổng phòng do máy chủ tổng hợp từ các kỳ thuê độc lập. Không dùng tổng này để lập hóa đơn.</p>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{cards.map(([label, value]) => <div key={String(label)} className="p-4 rounded-2xl border border-border/60 bg-card"><p className="text-[11px] font-bold uppercase text-muted">{label}</p><p className="mt-1 font-black text-lg">{vnd(Number(value))}</p></div>)}</div>
    <div className="rounded-2xl border border-border/60 overflow-hidden bg-card">
      <div className="px-4 py-3 border-b border-border/50 font-bold text-sm">Kỳ thuê và chứng từ nguồn ({summary.totals.rentalCycles})</div>
      {summary.rentalCycles.length === 0 ? <p className="p-5 text-sm text-muted">Phòng chưa có kỳ thuê.</p> : <div className="divide-y divide-border/40">{summary.rentalCycles.map((cycle) => <div key={cycle.rentalCycleId} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="font-bold">{cycle.customer?.fullName || "Khách chưa xác định"}</p><p className="font-mono text-[11px] text-muted">RentalCycle: {cycle.rentalCycleId}</p><SourceList sources={[...(cycle.depositLedger.sourceEntities || []).map((source) => ({ source, contractId: cycle.depositLedger.entries?.find((entry) => entry.id === source.id)?.contractId || null })), ...((cycle.invoices.families || []).flatMap((family) => (family.sourceEntities || []).map((source) => ({ source, contractId: family.contractId }))))]} context={{ rentalCycleId: cycle.rentalCycleId, customerId: cycle.customer?.id || null, contractId: null }} onOpenSource={onOpenSource} /></div>
        <div className="text-sm sm:text-right"><p>Nợ: <b>{vnd(cycle.invoices.outstanding)}</b></p><p>Cọc: <b>{vnd(cycle.depositLedger.balance)}</b></p><button type="button" onClick={() => onSelectCycle(cycle.rentalCycleId)} className="mt-2 text-xs font-bold text-primary underline">Xem kỳ thuê</button></div>
      </div>)}</div>}
    </div>
  </div>;
}
