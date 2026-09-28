"use client";

import type { RoomFinanceSummary } from "@/lib/types/finance-summary";

const vnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const FINANCE_SOURCE_LABELS: Record<string, string> = {
  Contract: "Hợp đồng",
  Deposit: "Phiếu cọc",
  DepositLedgerEntry: "Bút toán tiền cọc",
  DepositOperation: "Nghiệp vụ tiền cọc",
  Invoice: "Hóa đơn",
  Payment: "Thanh toán",
};

function financeSourceLabel(entity: string) {
  return FINANCE_SOURCE_LABELS[entity] || "Chứng từ";
}

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
  return <ul className="mt-2 flex flex-wrap gap-1.5">{sources.map(({ source, contractId }, index) => {
    const label = financeSourceLabel(source.entity);
    const visibleCode = source.code || "Xem chi tiết";
    const accessibleLabel = source.code ? `${label}: ${source.code}` : `${label}: chưa có mã nghiệp vụ`;
    return (
    <li key={`${source.entity}:${source.id || index}`} className="min-w-0">
      {source.id && onOpenSource ? (
        <button
          type="button"
          data-testid={`finance-source-${source.entity}-${source.id}`}
          onClick={() => onOpenSource(createFinanceSourceTarget({ ...context, contractId: contractId || context.contractId }, source))}
          aria-label={accessibleLabel}
          title={accessibleLabel}
          className="inline-flex max-w-full items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="shrink-0">{label}:</span>
          <span className="truncate font-mono tabular-nums">{visibleCode}</span>
        </button>
      ) : (
        <span title={accessibleLabel} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border/60 bg-surface/50 px-2 py-1 text-[11px] text-muted">
          <span className="shrink-0 font-semibold">{label}:</span>
          <span className="truncate font-mono tabular-nums">{source.code || "Chưa có mã"}</span>
        </span>
      )}
    </li>
  );
  })}</ul>;
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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="min-w-0 rounded-2xl border border-border/60 bg-card p-3 sm:p-4"><p className="text-[11px] font-bold uppercase text-muted">{label}</p><p className="mt-1 break-words text-base font-black tabular-nums text-text sm:text-lg">{vnd(Number(value))}</p></div>)}</div>
    <div className="rounded-2xl border border-border/60 overflow-hidden bg-card">
      <div className="px-4 py-3 border-b border-border/50 font-bold text-sm">Kỳ thuê và chứng từ nguồn ({summary.totals.rentalCycles})</div>
      {summary.rentalCycles.length === 0 ? <p className="p-5 text-sm text-muted">Phòng chưa có kỳ thuê.</p> : <div className="divide-y divide-border/40">{summary.rentalCycles.map((cycle) => {
        const contractCodes = cycle.contracts.map((contract) => contract.code).filter(Boolean);
        return <div key={cycle.rentalCycleId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1"><p className="truncate font-bold text-text" title={cycle.customer?.fullName || "Khách chưa xác định"}>{cycle.customer?.fullName || "Khách chưa xác định"}</p><p className="mt-0.5 truncate text-[11px] font-semibold text-muted" title={contractCodes.length ? `Hợp đồng: ${contractCodes.join(", ")}` : "Kỳ thuê chưa liên kết hợp đồng"}>{contractCodes.length ? `Hợp đồng: ${contractCodes.join(", ")}` : "Kỳ thuê chưa liên kết hợp đồng"}</p><SourceList sources={[...(cycle.depositLedger.sourceEntities || []).map((source) => ({ source, contractId: cycle.depositLedger.entries?.find((entry) => entry.id === source.id)?.contractId || null })), ...((cycle.invoices.families || []).flatMap((family) => (family.sourceEntities || []).map((source) => ({ source, contractId: family.contractId }))))]} context={{ rentalCycleId: cycle.rentalCycleId, customerId: cycle.customer?.id || null, contractId: null }} onOpenSource={onOpenSource} /></div>
        <div className="shrink-0 text-sm sm:text-right"><p>Nợ: <b className="tabular-nums">{vnd(cycle.invoices.outstanding)}</b></p><p>Cọc: <b className="tabular-nums">{vnd(cycle.depositLedger.balance)}</b></p><button type="button" onClick={() => onSelectCycle(cycle.rentalCycleId)} className="mt-2 rounded-lg px-1 py-1 text-xs font-bold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Xem kỳ thuê</button></div>
      </div>;
      })}</div>}
    </div>
  </div>;
}
