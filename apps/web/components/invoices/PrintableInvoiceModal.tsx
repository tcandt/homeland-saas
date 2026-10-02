"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, Printer, X } from "lucide-react";
import PrintableInvoiceSheet, {
  PrintableInvoiceSheetProps,
} from "./PrintableInvoiceSheet";

export interface PrintableInvoiceModalProps extends PrintableInvoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrintableInvoiceModal({
  isOpen,
  onClose,
  ...props
}: PrintableInvoiceModalProps) {
  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div
      id="homeland-print-portal"
      className="print-modal-root fixed inset-0 z-[10060] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
    >
      {/* Print CSS styles to ensure 100% exact 1-page A4 printout */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body {
            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            max-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Completely hide all background application DOM */
          body > *:not(#homeland-print-portal) {
            display: none !important;
          }
          #homeland-print-portal {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            max-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: transparent !important;
            overflow: visible !important;
            transform: none !important;
          }
          .print-modal-container,
          .print-modal-viewport {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            max-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: transparent !important;
            overflow: visible !important;
            transform: none !important;
          }
          #homeland-printable-invoice {
            position: static !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            width: 100% !important;
            max-width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            max-height: 100% !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #homeland-printable-invoice * {
            box-sizing: border-box !important;
          }
          .invoice-no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="print-modal-container relative w-full max-w-4xl bg-slate-100 dark:bg-slate-900/90 rounded-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden border border-slate-200 dark:border-slate-800">

        {/* Top Control Bar (Hidden on print) */}
        <div className="invoice-no-print flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Mẫu In Hóa Đơn Thanh Toán
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                {props.invoiceCode || "HÓA ĐƠN"} • Chuẩn A4 Homeland Premium CRM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-indigo-600" />
              <span>In hóa đơn</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Tải PDF</span>
            </button>
            <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Đóng (ESC)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Viewport with A4 Sheet Centered */}
        <div className="print-modal-viewport flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 flex justify-center bg-slate-100/80 dark:bg-slate-950/60">
          <PrintableInvoiceSheet {...props} />
        </div>
      </div>
    </div>,
    document.body
  );
}
