"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpenCheck, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useReconciliationQuery } from "@/lib/queries/finance.queries";

type ReconciliationLine = {
  journalLineId: string;
  journalEntryId: string;
  journalEntryCode: string;
  journalEntryStatus: string;
  entryDate: string;
  sourceType: string;
  debit: number;
  credit: number;
  account?: { code?: string; name?: string; type?: string };
  source?: { kind?: string; code?: string | null; path?: string };
  dimensions?: Record<string, string | null>;
};

type UnifiedEntry = {
  id: string;
  code: string;
  status: string;
  date: string;
  sourceType: string;
  source?: ReconciliationLine["source"];
  dimensions?: ReconciliationLine["dimensions"];
  debit: number;
  credit: number;
  cashIn: number;
  cashOut: number;
  lineCount: number;
};

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const isCashAccount = (line: ReconciliationLine) => {
  const code = String(line.account?.code || "");
  const name = String(line.account?.name || "");
  return line.account?.type === "ASSET" && (["1000", "1100"].includes(code) || /cash|bank|tiền mặt|ngân hàng/i.test(name));
};

const formatMoney = (value: number) => `${Math.abs(value).toLocaleString("vi-VN")} đ`;

const sourceLabels: Record<string, string> = {
  PAYMENT: "Thanh toán", DEPOSIT: "Tiền cọc", REFUND: "Hoàn tiền",
  EXPENSE: "Chi phí", INVOICE: "Hóa đơn", ADJUSTMENT: "Điều chỉnh", REVERSAL: "Đảo bút toán",
};
const entryStatusLabels: Record<string, string> = {
  DRAFT: "Bản nháp", POSTED: "Đã ghi sổ", REVERSED: "Đã đảo bút toán",
};

export default function UnifiedTransactionHistory() {
  const [period, setPeriod] = useState(currentPeriod);
  const [sourceType, setSourceType] = useState("ALL");
  const [selectedEntry, setSelectedEntry] = useState<UnifiedEntry | null>(null);
  const { data, isLoading, isError } = useReconciliationQuery({ period });
  const lines = useMemo<ReconciliationLine[]>(
    () => Array.isArray(data?.lines) ? data.lines : [],
    [data?.lines],
  );

  const entries = useMemo(() => {
    const grouped = new Map<string, UnifiedEntry>();
    for (const line of lines) {
      const current = grouped.get(line.journalEntryId) || {
        id: line.journalEntryId,
        code: line.journalEntryCode,
        status: line.journalEntryStatus,
        date: line.entryDate,
        sourceType: line.sourceType,
        source: line.source,
        dimensions: line.dimensions,
        debit: 0,
        credit: 0,
        cashIn: 0,
        cashOut: 0,
        lineCount: 0,
      };
      current.debit += Number(line.debit || 0);
      current.credit += Number(line.credit || 0);
      if (isCashAccount(line)) {
        current.cashIn += Number(line.debit || 0);
        current.cashOut += Number(line.credit || 0);
      }
      current.lineCount += 1;
      grouped.set(line.journalEntryId, current);
    }
    return [...grouped.values()]
      .filter((entry) => sourceType === "ALL" || entry.sourceType === sourceType)
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  }, [lines, sourceType]);

  const sourceOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(lines.map((line) => line.sourceType).filter(Boolean))).sort()],
    [lines],
  );

  const selectedLines = useMemo(
    () => selectedEntry ? lines.filter((line) => line.journalEntryId === selectedEntry.id) : [],
    [lines, selectedEntry],
  );

  const openEntry = (entry: UnifiedEntry) => setSelectedEntry(entry);

  return (
    <section data-testid="unified-transaction-history" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-text"><BookOpenCheck size={17} /> Dòng tiền & bút toán hợp nhất</div>
          <p className="mt-1 text-xs font-medium text-muted">Theo dõi thanh toán, tiền mặt, tiền cọc, hoàn tiền, chi phí và các bút toán điều chỉnh.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Kỳ giao dịch" type="month" value={period} onChange={(event) => setPeriod(event.target.value || currentPeriod())} className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text" />
          <select aria-label="Loại nguồn" value={sourceType} onChange={(event) => setSourceType(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text">
            {sourceOptions.map((value) => <option key={value} value={value}>{value === "ALL" ? "Tất cả nguồn" : sourceLabels[value] || "Nguồn khác"}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-card"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : isError ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 font-bold text-rose-600">Không tải được lịch sử giao dịch hợp nhất.</div>
      ) : entries.length === 0 ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-card font-semibold text-muted">Không có bút toán trong kỳ đã chọn.</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/70 bg-card shadow-2xs">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-border/70 bg-surface text-[10px] font-black uppercase tracking-wider text-muted">
              <tr><th className="px-4 py-3">Mã bút toán</th><th className="px-4 py-3">Nghiệp vụ</th><th className="px-4 py-3">Chứng từ liên quan</th><th className="px-4 py-3 text-right">Tiền vào</th><th className="px-4 py-3 text-right">Tiền ra</th><th className="px-4 py-3 text-right">Tổng Nợ / Có</th><th className="px-4 py-3 text-center">Trạng thái</th></tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  data-testid={`unified-transaction-${entry.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Xem chi tiết bút toán ${entry.code}`}
                  onClick={() => openEntry(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEntry(entry);
                    }
                  }}
                  className="cursor-pointer align-middle transition-colors hover:bg-primary/[0.035] focus-visible:bg-primary/[0.06] focus-visible:outline-none"
                >
                  <td className="px-4 py-3"><div className="font-mono font-black text-text">{entry.code}</div><div className="mt-1 text-[11px] text-muted">{new Date(entry.date).toLocaleString("vi-VN")}</div></td>
                  <td className="px-4 py-3"><span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-[11px] font-black text-primary">{sourceLabels[entry.sourceType] || "Nguồn khác"}</span></td>
                  <td className="max-w-[360px] px-4 py-3"><div className="line-clamp-2 font-semibold leading-5 text-text">{entry.source?.path || `${sourceLabels[entry.sourceType] || "Chứng từ"}: ${entry.source?.code || entry.id}`}</div><div className="mt-1 text-[11px] text-muted">{entry.lineCount} dòng hạch toán · Nhấn để xem chi tiết</div></td>
                  <td className="px-4 py-3 text-right font-mono font-black text-emerald-600">{entry.cashIn > 0 ? <span className="inline-flex items-center gap-1"><ArrowDownLeft size={13} />{formatMoney(entry.cashIn)}</span> : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-black text-rose-600">{entry.cashOut > 0 ? <span className="inline-flex items-center gap-1"><ArrowUpRight size={13} />{formatMoney(entry.cashOut)}</span> : "—"}</td>
                  <td className="px-4 py-3 text-right"><div className="font-mono font-bold text-text">{formatMoney(entry.debit)}</div><div className="mt-1 font-mono text-[11px] text-muted">{formatMoney(entry.credit)}</div></td>
                  <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black ${entry.status === "POSTED" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : entry.status === "REVERSED" ? "bg-amber-500/10 text-amber-800 dark:text-amber-400" : "bg-muted/20 text-muted"}`}>{entryStatusLabels[entry.status] || "Chưa xác định"}<ChevronRight size={12} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title="Chi tiết dòng tiền & bút toán"
        maxWidth="max-w-3xl"
        testId="unified-transaction-detail-modal"
        footer={<Button onClick={() => setSelectedEntry(null)}>Đóng</Button>}
      >
        {selectedEntry && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <DetailStat label="Mã bút toán" value={selectedEntry.code} mono />
              <DetailStat label="Nghiệp vụ" value={sourceLabels[selectedEntry.sourceType] || "Nguồn khác"} />
              <DetailStat label="Trạng thái" value={entryStatusLabels[selectedEntry.status] || "Chưa xác định"} />
              <DetailStat label="Thời điểm" value={new Date(selectedEntry.date).toLocaleString("vi-VN")} />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Tiền vào</div>
                <div className="mt-1 font-mono text-xl font-black text-emerald-600">{formatMoney(selectedEntry.cashIn)}</div>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">Tiền ra</div>
                <div className="mt-1 font-mono text-xl font-black text-rose-600">{formatMoney(selectedEntry.cashOut)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-muted">Chứng từ nguồn</div>
              <div className="mt-1 break-words text-sm font-bold text-text">{selectedEntry.source?.path || selectedEntry.source?.code || selectedEntry.id}</div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/70">
              <div className="border-b border-border/70 bg-surface px-3 py-2 text-xs font-black text-text">Các dòng hạch toán</div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="sticky top-0 bg-card text-[10px] font-black uppercase tracking-wide text-muted">
                    <tr><th className="px-3 py-2 text-left">Tài khoản</th><th className="px-3 py-2 text-left">Loại</th><th className="px-3 py-2 text-right">Nợ</th><th className="px-3 py-2 text-right">Có</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {selectedLines.map((line) => (
                      <tr key={line.journalLineId}>
                        <td className="px-3 py-2"><div className="font-mono font-black text-text">{line.account?.code || "—"}</div><div className="mt-0.5 text-[11px] text-muted">{line.account?.name || "Chưa xác định"}</div></td>
                        <td className="px-3 py-2 font-semibold text-muted">{line.account?.type || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-text">{formatMoney(line.debit)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-text">{formatMoney(line.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

function DetailStat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 break-words text-xs font-black text-text ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
