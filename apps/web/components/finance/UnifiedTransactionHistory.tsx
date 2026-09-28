"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpenCheck, ChevronDown, ChevronRight, CircleHelp, Landmark, Loader2, ReceiptText } from "lucide-react";
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
const accountNameLabels: Record<string, string> = {
  "1000": "Tiền mặt",
  "1100": "Tiền gửi ngân hàng",
  "1200": "Phải thu khách hàng",
  "1300": "Tiền cọc đang giữ",
  "4000": "Doanh thu tiền thuê",
  "4100": "Doanh thu điện nước",
  "4200": "Doanh thu dịch vụ",
  "4300": "Doanh thu giữ/khấu trừ cọc",
  "5000": "Chi phí điện",
  "5100": "Chi phí nước",
  "5200": "Chi phí bảo trì",
  "5300": "Chi phí nhân sự",
  "5400": "Chi phí khác",
};
const accountTypeLabels: Record<string, string> = {
  ASSET: "Tài sản",
  LIABILITY: "Nợ phải trả",
  EQUITY: "Vốn chủ sở hữu",
  REVENUE: "Doanh thu",
  EXPENSE: "Chi phí",
};
const accountTypeExplanations: Record<string, string> = {
  ASSET: "Những gì đơn vị đang sở hữu hoặc quản lý. Trong giao dịch thu tiền, đây thường là tiền đã vào tài khoản ngân hàng.",
  LIABILITY: "Khoản tiền đơn vị đang giữ nhưng có nghĩa vụ phải trả hoặc hoàn lại cho bên khác.",
  EQUITY: "Giá trị thuộc về chủ sở hữu sau khi trừ các khoản phải trả.",
  REVENUE: "Nguồn tạo ra khoản tiền thu được, ví dụ tiền thuê phòng, điện nước hoặc phí dịch vụ.",
  EXPENSE: "Khoản tiền đã dùng cho hoạt động vận hành, sửa chữa hoặc dịch vụ.",
};
const plainAccountNameLabels: Record<string, string> = {
  "1000": "Tiền mặt",
  "1100": "Tài khoản ngân hàng",
  "1200": "Khoản khách còn phải trả",
  "1300": "Tiền cọc đang giữ",
  "4000": "Tiền thuê phòng",
  "4100": "Tiền điện, nước",
  "4200": "Phí dịch vụ",
  "4300": "Tiền cọc được giữ/khấu trừ",
  "5000": "Chi phí điện",
  "5100": "Chi phí nước",
  "5200": "Chi phí bảo trì",
  "5300": "Chi phí nhân sự",
  "5400": "Chi phí khác",
};

const getPlainAccountName = (line?: ReconciliationLine) => (
  plainAccountNameLabels[line?.account?.code || ""]
  || accountNameLabels[line?.account?.code || ""]
  || line?.account?.name
  || "Chưa xác định"
);

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
        {selectedEntry && (() => {
          const cashLine = selectedLines.find(isCashAccount);
          const counterpartLine = selectedLines.find((line) => !isCashAccount(line));
          const isInflow = selectedEntry.cashIn > 0;
          const flowAmount = isInflow ? selectedEntry.cashIn : selectedEntry.cashOut;

          return (
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

            <div data-testid="cashflow-plain-summary" className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3.5">
              <div className="mb-3 text-xs font-black text-text">Giao dịch này có nghĩa là</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <PlainMeaningCard
                  icon={<Landmark size={16} aria-hidden />}
                  label={isInflow ? "Tiền đã vào đâu?" : "Tiền đã chi từ đâu?"}
                  help={isInflow
                    ? "Cho biết số tiền thực tế đang nằm ở đâu sau khi nhận được giao dịch."
                    : "Cho biết số tiền thực tế được lấy từ đâu để thực hiện khoản chi."}
                  helpTestId="plain-money-destination-help"
                  value={getPlainAccountName(cashLine)}
                  description={`${isInflow ? "Đã nhận thêm" : "Đã chi"} ${formatMoney(flowAmount)} ${isInflow ? "vào" : "từ"} nơi này.`}
                  tone={isInflow ? "emerald" : "rose"}
                />
                <PlainMeaningCard
                  icon={<ReceiptText size={16} aria-hidden />}
                  label={isInflow ? "Tiền này từ đâu?" : "Tiền được dùng cho việc gì?"}
                  help={isInflow
                    ? "Cho biết lý do tạo ra khoản tiền vừa nhận, chẳng hạn tiền thuê phòng hoặc điện nước."
                    : "Cho biết mục đích của khoản tiền vừa chi, chẳng hạn điện, nước hoặc bảo trì."}
                  helpTestId="plain-money-source-help"
                  value={getPlainAccountName(counterpartLine)}
                  description={isInflow ? "Đây là nguồn tạo ra khoản tiền vừa nhận." : "Đây là mục đích của khoản tiền vừa chi."}
                  tone="primary"
                />
              </div>
            </div>

            <details data-testid="accounting-details" className="group overflow-hidden rounded-xl border border-border/70 bg-card">
              <summary data-testid="accounting-details-toggle" className="flex cursor-pointer list-none items-center justify-between gap-3 bg-surface px-3.5 py-3 text-xs font-black text-text transition-colors hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                <span className="flex min-w-0 items-center gap-2">
                  <BookOpenCheck size={16} className="shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block">Xem chi tiết kế toán</span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-muted">Mã tài khoản và quy tắc Nợ/Có dành cho kế toán</span>
                  </span>
                </span>
                <ChevronDown size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="max-h-64 overflow-auto border-t border-border/70">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="sticky top-0 bg-card text-[10px] font-black uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left"><HelpTooltip label="Tài khoản" explanation="Mã dùng để phân loại nơi tiền đang nằm hoặc lý do phát sinh khoản tiền." /></th>
                      <th className="px-3 py-2 text-left"><HelpTooltip label="Nhóm kế toán" explanation="Nhóm cho biết đây là tiền đang có, khoản phải trả, doanh thu hay chi phí." /></th>
                      <th className="px-3 py-2 text-right"><HelpTooltip label="Nợ" explanation="Với tài khoản ngân hàng, ghi Nợ nghĩa là số tiền trong ngân hàng tăng." align="right" /></th>
                      <th className="px-3 py-2 text-right"><HelpTooltip label="Có" explanation="Với tài khoản doanh thu, ghi Có nghĩa là doanh thu được ghi nhận tăng." align="right" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {selectedLines.map((line) => (
                      <tr key={line.journalLineId}>
                        <td className="px-3 py-2"><div className="font-mono font-black text-text">{line.account?.code || "—"}</div><div className="mt-0.5 text-[11px] text-muted">{accountNameLabels[line.account?.code || ""] || line.account?.name || "Chưa xác định"}</div></td>
                        <td className="px-3 py-2 font-semibold text-muted">
                          <HelpTooltip
                            label={accountTypeLabels[line.account?.type || ""] || line.account?.type || "Chưa xác định"}
                            explanation={accountTypeExplanations[line.account?.type || ""] || "Nhóm phân loại của tài khoản kế toán này."}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-text">{formatMoney(line.debit)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-text">{formatMoney(line.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
          );
        })()}
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

function PlainMeaningCard({
  icon,
  label,
  help,
  helpTestId,
  value,
  description,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  help: string;
  helpTestId: string;
  value: string;
  description: string;
  tone: "emerald" | "rose" | "primary";
}) {
  const toneClasses = tone === "emerald"
    ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300"
    : tone === "rose"
      ? "border-rose-500/20 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300"
      : "border-primary/20 bg-card text-primary";

  return (
    <div className={`rounded-xl border p-3 ${toneClasses}`}>
      <div className="flex items-center gap-2 text-[11px] font-black">
        {icon}
        <HelpTooltip label={label} explanation={help} testId={helpTestId} />
      </div>
      <div className="mt-2 text-sm font-black text-text">{value}</div>
      <div className="mt-1 text-[11px] font-semibold leading-5 text-muted">{description}</div>
    </div>
  );
}

function HelpTooltip({
  label,
  explanation,
  testId,
  align = "left",
}: {
  label: string;
  explanation: string;
  testId?: string;
  align?: "left" | "right";
}) {
  return (
    <span className="group/help relative inline-flex items-center gap-1 normal-case tracking-normal">
      <span>{label}</span>
      <button
        type="button"
        data-testid={testId}
        aria-label={`Giải thích ${label}: ${explanation}`}
        className="inline-flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full text-muted transition-colors hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <CircleHelp size={13} aria-hidden />
      </button>
      <span
        role="tooltip"
        data-testid={testId ? `${testId}-content` : undefined}
        className={`pointer-events-none invisible absolute bottom-[calc(100%+8px)] z-50 w-64 rounded-xl border border-border bg-card px-3 py-2 text-left text-[11px] font-semibold leading-5 text-text opacity-0 shadow-xl transition-opacity group-hover/help:visible group-hover/help:opacity-100 group-focus-within/help:visible group-focus-within/help:opacity-100 ${align === "right" ? "right-0" : "left-0"}`}
      >
        {explanation}
      </span>
    </span>
  );
}
