"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpenCheck, Loader2 } from "lucide-react";
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
  const { data, isLoading, isError } = useReconciliationQuery({ period });
  const lines: ReconciliationLine[] = Array.isArray(data?.lines) ? data.lines : [];

  const entries = useMemo(() => {
    const grouped = new Map<string, any>();
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

  return (
    <section data-testid="unified-transaction-history" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
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
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-surface text-[10px] font-black uppercase tracking-wider text-muted">
              <tr><th className="px-4 py-3">Thời gian / mã</th><th className="px-4 py-3">Nguồn</th><th className="px-4 py-3">Đường dẫn chứng từ</th><th className="px-4 py-3 text-right">Tiền vào</th><th className="px-4 py-3 text-right">Tiền ra</th><th className="px-4 py-3 text-right">Bút toán</th><th className="px-4 py-3">Trạng thái</th></tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {entries.map((entry) => (
                <tr key={entry.id} data-testid={`unified-transaction-${entry.id}`} className="align-top hover:bg-background/70">
                  <td className="px-4 py-3"><div className="font-black text-text">{entry.code}</div><div className="mt-1 text-[10px] text-muted">{new Date(entry.date).toLocaleString("vi-VN")}</div></td>
                  <td className="px-4 py-3"><span className="rounded-md bg-primary/10 px-2 py-1 font-black text-primary">{sourceLabels[entry.sourceType] || "Nguồn khác"}</span></td>
                  <td className="max-w-[340px] px-4 py-3"><div className="break-words font-semibold text-text">{entry.source?.path || `${sourceLabels[entry.sourceType] || "Chứng từ"}: ${entry.source?.code || entry.id}`}</div><div className="mt-1 text-[10px] text-muted">{entry.lineCount} dòng bút toán</div></td>
                  <td className="px-4 py-3 text-right font-black text-emerald-600">{entry.cashIn > 0 ? <span className="inline-flex items-center gap-1"><ArrowDownLeft size={13} />{formatMoney(entry.cashIn)}</span> : "—"}</td>
                  <td className="px-4 py-3 text-right font-black text-rose-600">{entry.cashOut > 0 ? <span className="inline-flex items-center gap-1"><ArrowUpRight size={13} />{formatMoney(entry.cashOut)}</span> : "—"}</td>
                  <td className="px-4 py-3 text-right"><div className="font-bold text-text">Nợ {formatMoney(entry.debit)}</div><div className="text-[10px] text-muted">Có {formatMoney(entry.credit)}</div></td>
                  <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-black ${entry.status === "POSTED" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : entry.status === "REVERSED" ? "bg-amber-500/10 text-amber-800 dark:text-amber-400" : "bg-muted/20 text-muted"}`}>{entryStatusLabels[entry.status] || "Chưa xác định"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
