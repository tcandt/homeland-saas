"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { financeApi } from "@/lib/api/finance.api";

type ExportFormat = "excel" | "pdf";

async function downloadFinanceFile(format: ExportFormat) {
  const response: any = await (format === "excel"
    ? financeApi.exportExcelReport()
    : financeApi.exportPdfReport());
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  const contentDisposition = response.headers["content-disposition"];
  const filenameMatch = contentDisposition?.match(/filename="?([^\"]+)"?/);

  link.href = url;
  link.download = filenameMatch?.[1] || (format === "excel" ? "finance_report.xlsx" : "finance_report.pdf");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function FinanceExportDrawer() {
  const [open, setOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        const target = window.matchMedia("(min-width: 768px)").matches ? triggerRef.current : mobileTriggerRef.current;
        target?.focus({ preventScroll: true });
      }
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;
    window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleExport = async (format: ExportFormat) => {
    setPendingFormat(format);
    try {
      await downloadFinanceFile(format);
      toast.success(format === "excel" ? "Đã xuất báo cáo Excel." : "Đã xuất báo cáo PDF.");
    } catch {
      toast.error(format === "excel" ? "Không thể xuất báo cáo Excel." : "Không thể xuất báo cáo PDF.");
    } finally {
      setPendingFormat(null);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid="finance-export-button"
        aria-label={open ? "Đóng bảng xuất báo cáo" : "Mở bảng xuất báo cáo"}
        aria-expanded={open}
        aria-controls="finance-export-drawer"
        onClick={() => setOpen((current) => !current)}
        className={`fixed right-3 top-1/2 z-[10021] hidden min-h-11 -translate-y-1/2 cursor-pointer items-center gap-2 rounded-2xl border border-primary/30 bg-card/95 px-2.5 py-3 text-xs font-black text-primary shadow-lg backdrop-blur-md transition-[right,background-color,border-color,box-shadow] duration-300 hover:border-primary/60 hover:bg-primary/10 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex [writing-mode:vertical-rl] ${
          open ? "right-[432px]" : "right-3"
        }`}
      >
        <Download size={14} className="rotate-90" aria-hidden />
        <span>Xuất báo cáo</span>
        <ChevronLeft size={13} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      <button
        ref={mobileTriggerRef}
        type="button"
        aria-label="Mở bảng xuất báo cáo"
        aria-expanded={open}
        aria-controls="finance-export-drawer"
        onClick={() => setOpen(true)}
        className={`fixed right-2 top-1/2 z-[10021] min-h-11 -translate-y-1/2 items-center gap-2 rounded-2xl border border-primary/30 bg-card/95 px-2.5 py-3 text-xs font-black text-primary shadow-lg backdrop-blur-md transition hover:border-primary/60 hover:bg-primary/10 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden [writing-mode:vertical-rl] ${open ? "hidden" : "flex"}`}
      >
        <Download size={14} className="rotate-90" aria-hidden />
        Xuất báo cáo
      </button>

      {open && (
        <button
          type="button"
          aria-label="Đóng bảng xuất báo cáo"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[10019] cursor-default bg-slate-950/40 backdrop-blur-[2px]"
        />
      )}

      <aside
        ref={panelRef}
        id="finance-export-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-export-title"
        aria-hidden={!open}
        inert={!open}
        className={`fixed bottom-0 right-0 top-0 z-[10020] flex w-full max-w-[420px] flex-col border-l border-border/70 bg-card shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none md:top-[72px] ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-5">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
              <Download size={14} aria-hidden />
              Trung tâm xuất dữ liệu
            </div>
            <h2 id="finance-export-title" className="text-xl font-black tracking-tight text-text">
              Xuất báo cáo tài chính
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Tải bản tổng hợp doanh thu, chi phí, công nợ và sổ cái đang có trong hệ thống.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Đóng"
            onClick={() => setOpen(false)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted transition hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={17} aria-hidden />
              Dữ liệu theo quyền truy cập hiện tại
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">
              File xuất không bao gồm dữ liệu ngoài tenant và quyền tài chính của tài khoản đang đăng nhập.
            </p>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-black text-text">Nội dung báo cáo</h3>
            <div className="mt-3 grid gap-2">
              {["Tổng quan doanh thu và dòng tiền", "Chi phí và lợi nhuận ròng", "Công nợ và trạng thái thu", "Chi tiết bút toán tài chính"].map((label) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface/50 px-3.5 py-3 text-sm font-semibold text-text">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <Check size={14} aria-hidden />
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-black text-text">Chọn định dạng</h3>
            <div className="mt-3 grid gap-3">
              <button
                type="button"
                data-testid="finance-export-excel-button"
                disabled={pendingFormat !== null}
                onClick={() => handleExport("excel")}
                className="group flex min-h-[76px] w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  {pendingFormat === "excel" ? <Loader2 size={20} className="animate-spin" /> : <FileSpreadsheet size={20} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-text">Excel (.xlsx)</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">Phù hợp để lọc, đối chiếu và xử lý số liệu.</span>
                </span>
              </button>

              <button
                type="button"
                data-testid="finance-export-pdf-button"
                disabled={pendingFormat !== null}
                onClick={() => handleExport("pdf")}
                className="group flex min-h-[76px] w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-rose-500/40 hover:bg-rose-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                  {pendingFormat === "pdf" ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-text">PDF (.pdf)</span>
                  <span className="mt-1 block text-xs leading-5 text-muted">Phù hợp để lưu hồ sơ, in và gửi duyệt.</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 bg-surface/40 px-5 py-4 text-xs leading-5 text-muted">
          Báo cáo được tạo từ dữ liệu đã ghi nhận tại thời điểm tải xuống.
        </div>
      </aside>
    </>
  );
}
