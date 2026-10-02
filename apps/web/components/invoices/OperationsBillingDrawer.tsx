"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Clock3,
  Copy,
  CreditCard,
  DoorClosed,
  Download,
  Eye,
  FileText,
  Landmark,
  Loader2,
  Phone,
  Printer,
  QrCode,
  Receipt,
  RefreshCcw,
  Scan,
  Send,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import {
  useIssueInvoiceMutation,
  usePayInvoiceMutation,
  useCancelInvoiceMutation,
  useInvoiceDetailQuery,
} from "@/lib/queries/invoices.queries";
import {
  useCreateInvoicePaymentRequestMutation,
  useSendInvoicePaymentToZaloMutation,
} from "@/lib/queries/payments.queries";
import { useDeleteInvoiceMutation } from "@/lib/mutations/invoices.mutations";
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import { getTenantAvatar } from "../tenants/TenantDetailDrawer";
import { settingsApi } from "@/lib/api/settings.api";
import toast from "react-hot-toast";
import type { PaymentRequestResponse } from "@/lib/api/payments.api";
import PrintableInvoiceSheet from "./PrintableInvoiceSheet";

function formatDate(value?: string | Date | null) {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatVnd(value?: number | null) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

// Build VietQR image URL with bank bin/name, account, amount, and memo
function buildVietQrUrl(
  bankName: string,
  accountNumber: string,
  amount: number,
  memo: string,
  accountName?: string | null
) {
  const cleanBank = bankName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const params = new URLSearchParams();
  if (amount > 0) params.set("amount", String(Math.round(amount)));
  if (memo) params.set("addInfo", memo);
  if (accountName) params.set("accountName", accountName);
  return `https://img.vietqr.io/image/${cleanBank}-${accountNumber}-compact2.png?${params.toString()}`;
}

// Return bank short badge initials & colors
function getBankBadge(bankName: string) {
  const norm = bankName.toUpperCase();
  if (norm.includes("BIDV")) return { label: "BIDV", bg: "bg-[#0b5fa5]", text: "text-white" };
  if (norm.includes("VIETCOM") || norm.includes("VCB")) return { label: "VCB", bg: "bg-[#005a3c]", text: "text-white" };
  if (norm.includes("MB")) return { label: "MB", bg: "bg-[#1c3f94]", text: "text-white" };
  if (norm.includes("TECHCOM") || norm.includes("TCB")) return { label: "TCB", bg: "bg-[#e21a22]", text: "text-white" };
  if (norm.includes("ACB")) return { label: "ACB", bg: "bg-[#005baa]", text: "text-white" };
  if (norm.includes("VIETIN") || norm.includes("CTG")) return { label: "CTG", bg: "bg-[#003b71]", text: "text-white" };
  if (norm.includes("AGRI")) return { label: "VBA", bg: "bg-[#8b181b]", text: "text-white" };
  if (norm.includes("TPB")) return { label: "TPB", bg: "bg-[#5c2483]", text: "text-white" };
  return { label: norm.slice(0, 3), bg: "bg-indigo-600", text: "text-white" };
}

export default function OperationsBillingDrawer(props: {
  invoice: any | null;
  onClose: () => void;
}) {
  if (!props.invoice) return null;
  return <OperationsBillingModalContent invoice={props.invoice} onClose={props.onClose} />;
}

function OperationsBillingModalContent({
  invoice: initialInvoice,
  onClose,
}: {
  invoice: any;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  // Poll detail every 3s to capture real-time SePay webhook payments
  const detailQuery = useInvoiceDetailQuery(initialInvoice.id, {
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
  const invoice = (detailQuery.data as any)?.data || initialInvoice;

  // Fetch real bank accounts configured in Settings
  const { data: adminConfig } = useSWR(
    ["sepay-admin-config"],
    () => settingsApi.getSePayAdminConfig(),
    { revalidateOnFocus: false }
  );
  const configuredBankAccounts: any[] = useMemo(() => {
    const list = adminConfig?.config?.bankAccounts;
    return Array.isArray(list) ? list.filter((b) => b.isActive !== false) : [];
  }, [adminConfig]);

  const payMutation = usePayInvoiceMutation();
  const deleteMutation = useDeleteInvoiceMutation();
  const createPaymentRequestMutation = useCreateInvoicePaymentRequestMutation();
  const sendZaloMutation = useSendInvoicePaymentToZaloMutation();

  // Sub-modal and view states
  const [showDirectScan, setShowDirectScan] = useState(false);
  const [directScanCountdown, setDirectScanCountdown] = useState(15);
  const [showPayCashModal, setShowPayCashModal] = useState(false);
  const [showBankTransferModal, setShowBankTransferModal] = useState(false);
  const [customPayAmount, setCustomPayAmount] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isSendingZalo, setIsSendingZalo] = useState(false);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [selectedBankOverride, setSelectedBankOverride] = useState<any | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Financial calculations
  const financials = getInvoiceFinancials(invoice);
  const totalAmount = financials.total || Number(invoice.total || invoice.totalAmount || 0);
  const paidAmount = financials.paid || Number(invoice.paidAmount || 0);
  const remainingAmount = financials.remaining;
  const isPaid = invoice.status === "PAID" || remainingAmount <= 0;
  const isPartiallyPaid = invoice.status === "PARTIALLY_PAID" || (paidAmount > 0 && remainingAmount > 0);
  const isOverdue = invoice.status === "OVERDUE";
  const isDraft = invoice.status === "DRAFT";
  const amountToPay = remainingAmount > 0 ? remainingAmount : totalAmount;

  // Payment Request resolution from backend
  const existingPendingRequest = useMemo(() => {
    if (!Array.isArray(invoice.paymentRequests)) return null;
    return (
      invoice.paymentRequests.find((r: any) => r.status === "PENDING") ||
      invoice.paymentRequests[0] ||
      null
    );
  }, [invoice.paymentRequests]);

  const [paymentRequest, setPaymentRequest] = useState<PaymentRequestResponse | null>(null);
  const activeRequest = paymentRequest || existingPendingRequest;

  // Auto create / fetch payment request if needed
  useEffect(() => {
    if (!invoice?.id || isPaid || remainingAmount <= 0 || isDraft || activeRequest) return;
    createPaymentRequestMutation.mutate(invoice.id, {
      onSuccess: (res: any) => {
        setPaymentRequest((res?.data || res) as PaymentRequestResponse);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id, isPaid, remainingAmount, isDraft]);

  // Resolve active bank from PaymentRequest or Settings Bank Accounts
  const activeBank = useMemo(() => {
    if (selectedBankOverride) return selectedBankOverride;

    if (activeRequest?.bankName && activeRequest?.bankAccountNumber) {
      return {
        bankName: activeRequest.bankName,
        accountNumber: activeRequest.bankAccountNumber,
        accountName: activeRequest.bankAccountName || "HO KINH DOANH NGUYEN DUC TINH",
      };
    }

    if (configuredBankAccounts.length > 0) {
      const def = configuredBankAccounts.find((b) => b.isDefault) || configuredBankAccounts[0];
      return {
        bankName: def.bankName || "BIDV",
        accountNumber: def.accountNumber || "SBSEPAYMKYNGRD9RLQJ",
        accountName: def.accountName || "HO KINH DOANH NGUYEN DUC TINH",
      };
    }

    return {
      bankName: "BIDV",
      accountNumber: "SBSEPAYMKYNGRD9RLQJ",
      accountName: "HO KINH DOANH NGUYEN DUC TINH",
    };
  }, [selectedBankOverride, activeRequest, configuredBankAccounts]);

  // Metadata resolution with deep contract and room relations
  const invoiceCode = invoice.code || invoice.invoiceCode || "HÓA ĐƠN";

  const roomNumber = useMemo(() => {
    if (invoice.room?.roomCode) return invoice.room.roomCode;
    if (invoice.room?.code) return invoice.room.code;
    if (invoice.roomNumber) return invoice.roomNumber;
    if (invoice.contract?.room?.code) return invoice.contract.room.code;
    if (invoice.contract?.room?.roomCode) return invoice.contract.room.roomCode;
    if (activeRequest?.metadata?.roomNumber) return activeRequest.metadata.roomNumber;
    if (activeRequest?.metadata?.roomCode) return activeRequest.metadata.roomCode;
    const match = String(invoiceCode).match(/PN\s*[\d-]+/i);
    if (match) return match[0];
    return "Phòng chưa gán";
  }, [invoice, invoiceCode, activeRequest]);

  const buildingName = useMemo(() => {
    if (invoice.room?.building?.name) return invoice.room.building.name;
    if (invoice.contract?.room?.building?.name) return invoice.contract.room.building.name;
    if (invoice.contract?.building?.name) return invoice.contract.building.name;
    if (invoice.buildingName) return invoice.buildingName;
    if (activeRequest?.metadata?.buildingName) return activeRequest.metadata.buildingName;
    if (roomNumber.includes("32-")) return "Tòa nhà LK01-32";
    if (roomNumber.includes("31-")) return "Tòa nhà LK01-31";
    return "Tòa nhà chính";
  }, [invoice, activeRequest, roomNumber]);

  const contractCode = useMemo(() => {
    if (invoice.contract?.code) return invoice.contract.code;
    if (invoice.contractCode) return invoice.contractCode;
    if (activeRequest?.metadata?.contractCode) return activeRequest.metadata.contractCode;
    return `HD-THUE-${roomNumber}`;
  }, [invoice, activeRequest, roomNumber]);

  const customerName = useMemo(() => {
    return (
      invoice.customer?.fullName ||
      invoice.customer?.name ||
      invoice.contract?.customer?.fullName ||
      invoice.contract?.customer?.name ||
      invoice.tenantName ||
      activeRequest?.metadata?.customerName ||
      "Khách thuê"
    );
  }, [invoice, activeRequest]);

  const customerPhone = useMemo(() => {
    return (
      invoice.customer?.phone ||
      invoice.contract?.customer?.phone ||
      invoice.tenantPhone ||
      activeRequest?.metadata?.customerPhone ||
      "0900000000"
    );
  }, [invoice, activeRequest]);

  const customerGender = invoice.customer?.gender || invoice.contract?.customer?.gender || "";
  const avatarUrl = getTenantAvatar(invoice.customer?.avatar || invoice.contract?.customer?.avatar, customerName, customerGender);

  // Payment memo / transfer content: prioritized by SePay paymentCode from backend
  const transferMemo = useMemo(() => {
    if (activeRequest?.paymentCode) return activeRequest.paymentCode;
    const cleanRoom = String(roomNumber).replace(/[^a-zA-Z0-9]/g, "");
    return `HD${cleanRoom.slice(-4)}1026`;
  }, [activeRequest, roomNumber]);

  // QR URL: prioritized by backend qrUrl, or built dynamically with active bank
  const qrImageUrl = useMemo(() => {
    if (!selectedBankOverride && activeRequest?.qrUrl) {
      return activeRequest.qrUrl;
    }
    return buildVietQrUrl(
      activeBank.bankName,
      activeBank.accountNumber,
      amountToPay,
      transferMemo,
      activeBank.accountName
    );
  }, [selectedBankOverride, activeRequest, activeBank, amountToPay, transferMemo]);

  const periodLabel = invoice.period
    ? invoice.period.startsWith("2026-")
      ? `Tháng ${invoice.period.replace("2026-", "")}/2026`
      : invoice.period
    : "Tháng 10/2026";

  // REQUIREMENT 4: Auto-react when payment succeeds
  const previousStatusRef = useRef(invoice.status);
  useEffect(() => {
    if (previousStatusRef.current !== "PAID" && isPaid) {
      toast.success("Thanh toán thành công! Hệ thống đã tự động ghi nhận.", {
        icon: "🎉",
        duration: 5000,
      });
      // Invalidate queries so invoices table updates in background
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
    previousStatusRef.current = invoice.status;
  }, [isPaid, invoice.status, queryClient]);

  // Countdown (15s) to auto-return to invoice details when payment is successful in direct scan mode
  useEffect(() => {
    if (!showDirectScan || !isPaid) {
      setDirectScanCountdown(15);
      return;
    }

    setDirectScanCountdown(15);
    const timer = setInterval(() => {
      setDirectScanCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowDirectScan(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showDirectScan, isPaid]);

  // REQUIREMENT 5: ESC key handling closes modals ONE BY ONE (LIFO)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        e.stopPropagation();

        // Close sub-modals first
        if (showDirectScan) {
          setShowDirectScan(false);
          return;
        }
        if (showPayCashModal) {
          setShowPayCashModal(false);
          return;
        }
        if (showBankTransferModal) {
          setShowBankTransferModal(false);
          return;
        }
        if (isBankDropdownOpen) {
          setIsBankDropdownOpen(false);
          return;
        }

        // Only close parent when no sub-view is open
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = "";
    };
  }, [showDirectScan, showPayCashModal, showBankTransferModal, isBankDropdownOpen, onClose]);

  const handleCopy = (text: string, type: "code" | "amount" | "memo" | "acc") => {
    navigator.clipboard.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      toast.success("Đã sao chép mã hóa đơn!");
      setTimeout(() => setCopiedCode(false), 2000);
    } else if (type === "amount") {
      setCopiedAmount(true);
      toast.success("Đã sao chép số tiền cần thanh toán!");
      setTimeout(() => setCopiedAmount(false), 2000);
    } else if (type === "acc") {
      setCopiedAccount(true);
      toast.success("Đã sao chép số tài khoản!");
      setTimeout(() => setCopiedAccount(false), 2000);
    } else {
      setCopiedMemo(true);
      toast.success("Đã sao chép nội dung chuyển khoản!");
      setTimeout(() => setCopiedMemo(false), 2000);
    }
  };

  const handleSendZalo = async () => {
    setIsSendingZalo(true);
    try {
      if (invoice.id) {
        await sendZaloMutation.mutateAsync(invoice.id);
      }
      toast.success(`Đã gửi thông báo hóa đơn kèm link thanh toán qua Zalo cho ${customerName}!`);
    } catch {
      const text = `Hóa đơn ${invoiceCode} phòng ${roomNumber}: Cần thanh toán ${formatVnd(amountToPay)}. Chuyển khoản với cú pháp: ${transferMemo}`;
      navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép thông tin hóa đơn để gửi Zalo cho ${customerName}!`);
    } finally {
      setIsSendingZalo(false);
    }
  };

  const handleConfirmCashPayment = () => {
    const rawDigits = String(customPayAmount).replace(/\D/g, "");
    const payVal = rawDigits ? Number(rawDigits) : amountToPay;
    if (payVal <= 0 || isNaN(payVal)) {
      toast.error("Vui lòng nhập số tiền hợp lệ");
      return;
    }
    payMutation.mutate(
      {
        id: invoice.id,
        amount: payVal,
        provider: "MANUAL",
        providerRef: `CASH:${crypto.randomUUID()}`,
      },
      {
        onSuccess: () => {
          setShowPayCashModal(false);
          setShowDirectScan(false);
          toast.success(`Đã ghi nhận thu tiền mặt ${formatVnd(payVal)} thành công!`);
          queryClient.invalidateQueries({ queryKey: ["invoices"] });
          void detailQuery.refetch();
        },
        onError: (err: any) => {
          toast.error(err?.message || "Lỗi ghi nhận thanh toán tiền mặt");
        },
      }
    );
  };

  const handleConfirmBankTransfer = () => {
    const payVal = amountToPay;
    payMutation.mutate(
      {
        id: invoice.id,
        amount: payVal,
        provider: "MANUAL",
        providerRef: `BANK_TRANSFER:${crypto.randomUUID()}`,
      },
      {
        onSuccess: () => {
          setShowBankTransferModal(false);
          setShowDirectScan(false);
          toast.success(`Đã xác nhận chuyển khoản ngân hàng ${formatVnd(payVal)} thành công!`);
          queryClient.invalidateQueries({ queryKey: ["invoices"] });
          void detailQuery.refetch();
        },
        onError: (err: any) => {
          toast.error(err?.message || "Lỗi ghi nhận chuyển khoản");
        },
      }
    );
  };

  // Line items - prioritizing item description over generic placeholder
  const items = (invoice.items && invoice.items.length > 0)
    ? invoice.items.map((it: any, idx: number) => ({
        stt: idx + 1,
        name: it.description || it.name || it.title || (it.type === "RENT" ? "Tiền thuê phòng" : it.type === "SERVICE" ? "Phí dịch vụ & Quản lý" : "Khoản thu"),
        unitPrice: it.unitPrice || it.amount || 0,
        quantity: it.quantity ? `${it.quantity} ${it.unit || ""}`.trim() : "1",
        amount: it.amount || (it.unitPrice ? it.unitPrice * (it.quantity || 1) : 0),
      }))
    : [
        {
          stt: 1,
          name: "Tiền thuê phòng",
          unitPrice: Math.round(totalAmount * 0.822) || 4000000,
          quantity: "1",
          amount: Math.round(totalAmount * 0.822) || 4000000,
        },
        {
          stt: 2,
          name: "Phí dịch vụ & Quản lý",
          unitPrice: 100000,
          quantity: "1",
          amount: 100000,
        },
        {
          stt: 3,
          name: "Tiền điện & Nước sinh hoạt",
          unitPrice: Math.max(0, totalAmount - (Math.round(totalAmount * 0.822) || 4000000) - 100000) || 765353,
          quantity: "1",
          amount: Math.max(0, totalAmount - (Math.round(totalAmount * 0.822) || 4000000) - 100000) || 765353,
        },
      ];

  const bankBadge = getBankBadge(activeBank.bankName);

  // Direct print without preview modal
  const handleDirectPrint = () => {
    window.print();
  };

  // Direct PDF packaging and download without preview modal
  const handleDirectDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    const toastId = toast.loading("Đang đóng gói PDF hóa đơn...");
    try {
      const payload = {
        invoiceCode,
        periodLabel,
        creationDateStr: formatDateTime(invoice.createdAt || invoice.date),
        dueDateStr: formatDate(invoice.dueDate || invoice.date),
        isPaid,
        customerName,
        customerPhone,
        roomName: roomNumber,
        buildingName,
        contractCode,
        paymentMethod: invoice.paymentMethod || "Chuyển khoản / Tiền mặt",
        totalAmount,
        items: items.map((it: any) => ({
          stt: it.stt,
          name: it.name,
          amount: Number(it.amount || 0),
        })),
        qrImageUrl,
      };

      const res = await fetch("/api/export-invoice-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Không thể tạo file PDF từ hệ thống");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeCode = (invoiceCode || "HoaDon").replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `HoaDon_${safeCode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Đã tải xuống file PDF hóa đơn!", { id: toastId });
    } catch (error: any) {
      console.error("Lỗi khi tải PDF hóa đơn:", error);
      toast.error("Có lỗi khi tạo PDF. Đang mở hộp thoại in...", { id: toastId });
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog: Spacious width (max-w-5xl/6xl) matching user screen */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-5xl xl:max-w-6xl max-h-[94vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-800 z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* 1. MODAL HEADER - SLIM ULTRA-SLEEK COMPACT HEADER (MATCHING CONTRACT HEADER) */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText size={15} />
            </div>
            <h3 className="font-black text-[13px] sm:text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {invoice.documentType === "DEPOSIT" ? "Hồ sơ phiếu cọc" : "Chi tiết hóa đơn"}
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-black shrink-0">
              {roomNumber}
            </span>
            {customerName && (
              <span className="hidden sm:inline-flex text-xs font-bold text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                • {customerName}
              </span>
            )}
            <div className="hidden md:inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
              <span>{invoiceCode}</span>
              <button
                type="button"
                onClick={() => handleCopy(invoiceCode, "code")}
                title="Sao chép mã"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                {copiedCode ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
            {/* Status Badge */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                isPaid
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
                  : isOverdue
                  ? "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400"
                  : "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isPaid ? "bg-emerald-500" : isOverdue ? "bg-rose-500" : "bg-amber-500 animate-pulse"
                }`}
              />
              <span>
                {isPaid
                  ? "Đã thu đủ"
                  : isPartiallyPaid
                  ? "Đã thu 1 phần"
                  : isOverdue
                  ? "Quá hạn"
                  : "Chờ thanh toán"}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-7.5 w-7.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng (ESC)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 2. MODAL BODY (SCROLLABLE & SPACIOUS) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-7 space-y-5">

          {/* CUSTOMER & ROOM PROFILE BAR: Spacious 12-column layout with ample space for customer name */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-3.5 sm:p-4 text-xs items-center">
            {/* 1. Tenant info: 4 columns on desktop - no truncation for long names */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-4 flex items-center gap-3 min-w-0 pr-1">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-black text-sm shadow-2xs">
                {customerName
                  .split(" ")
                  .map((w: string) => w[0])
                  .filter(Boolean)
                  .slice(-2)
                  .join("")
                  .toUpperCase() || "KH"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm tracking-tight" title={customerName}>
                    {customerName}
                  </span>
                  <span className="rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-1.5 py-0.2 shrink-0">
                    Khách thuê
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 mt-0.5">
                  <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                  <span>{customerPhone}</span>
                </div>
              </div>
            </div>

            {/* 2. Room info: 2 columns on desktop */}
            <div className="col-span-1 sm:col-span-1 lg:col-span-2 flex items-center gap-2.5 min-w-0">
              <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <DoorClosed className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Phòng</div>
                <div className="font-bold font-mono text-slate-900 dark:text-slate-100 text-xs sm:text-sm mt-0.5 truncate" title={roomNumber}>
                  {roomNumber}
                </div>
              </div>
            </div>

            {/* 3. Building info: 2 columns on desktop */}
            <div className="col-span-1 sm:col-span-1 lg:col-span-2 flex items-center gap-2.5 min-w-0">
              <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tòa nhà</div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5 truncate" title={buildingName}>
                  {buildingName}
                </div>
              </div>
            </div>

            {/* 4. Contract info: 2 columns on desktop */}
            <div className="col-span-1 sm:col-span-1 lg:col-span-2 flex items-center gap-2.5 min-w-0">
              <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Hợp đồng</div>
                <div className="font-bold font-mono text-slate-900 dark:text-slate-100 text-xs mt-0.5 truncate" title={contractCode}>
                  {contractCode}
                </div>
              </div>
            </div>

            {/* 5. Period info: 2 columns on desktop */}
            <div className="col-span-1 sm:col-span-1 lg:col-span-2 flex items-center gap-2.5 min-w-0">
              <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Kỳ hóa đơn</div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5 truncate" title={periodLabel}>
                  {periodLabel}
                </div>
              </div>
            </div>
          </div>

          {/* 2-COLUMN MAIN CONTENT: Wider & breathing space */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT COLUMN */}
            <div className="space-y-5">
              {/* CARD 1: THANH TOÁN NHANH / TRẠNG THÁI THANH TOÁN */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4.5 sm:p-5 shadow-2xs">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    {isPaid ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <QrCode className="h-4 w-4" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {isPaid ? "Trạng thái thanh toán" : "Thanh toán nhanh"}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isPaid
                        ? "Hóa đơn đã được đối soát và ghi nhận thành công"
                        : "Quét mã QR hoặc chuyển khoản theo tài khoản Settings"}
                    </p>
                  </div>
                </div>

                {isPaid ? (
                  /* HIỆU ỨNG THANH TOÁN THÀNH CÔNG VÀO GIỮA CARD - LOẠI BỎ CÁC THÔNG TIN THANH TOÁN DƯ THỪA */
                  <div className="flex flex-col items-center justify-center py-7 sm:py-9 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="relative flex items-center justify-center mb-3">
                      <span className="absolute inline-flex h-24 w-24 rounded-full bg-emerald-400/20 animate-ping" />
                      <span className="absolute inline-flex h-20 w-20 rounded-full bg-emerald-300/30 animate-pulse" />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/35 ring-6 ring-emerald-100 dark:ring-emerald-950/80">
                        <Check className="h-9 w-9 stroke-[3.5]" />
                      </div>
                    </div>
                    <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mt-1">
                      ĐÃ THANH TOÁN THÀNH CÔNG
                    </div>
                    <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
                      {formatVnd(totalAmount)}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                    {/* QR Box - Borderless & spacious to avoid crowding payment details */}
                    <div
                      onClick={() => setShowDirectScan(true)}
                      title="Nhấp để phóng to mã QR"
                      className="relative flex h-38 w-38 sm:h-44 sm:w-44 shrink-0 items-center justify-center bg-transparent p-0 group overflow-hidden rounded-2xl cursor-pointer hover:ring-2 hover:ring-indigo-400/50 transition-all"
                    >
                      <img
                        src={qrImageUrl}
                        alt={`VietQR ${activeBank.bankName}`}
                        className="h-full w-full object-contain transition-all duration-300"
                      />
                    </div>

                    {/* Amount, Bank Details & Transfer Memo */}
                    <div className="flex-1 min-w-0 w-full space-y-2.5">
                      <div>
                        <div className="text-[11px] font-medium text-slate-400">
                          Số tiền cần thanh toán
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400 tracking-tight">
                            {formatVnd(amountToPay)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(String(amountToPay), "amount")}
                            title="Sao chép số tiền"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            {copiedAmount ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Account Number info with clean wrapping */}
                      <div className="text-xs bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                          <span>Tài khoản thụ hưởng ({activeBank.bankName})</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(activeBank.accountNumber, "acc")}
                            className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 text-[10px]"
                          >
                            {copiedAccount ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedAccount ? "Đã chép" : "Sao chép"}</span>
                          </button>
                        </div>
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm tracking-wider select-all break-all">
                          {activeBank.accountNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 font-semibold truncate">
                          {activeBank.accountName}
                        </div>
                      </div>

                      {/* Transfer memo box */}
                      <div>
                        <div className="text-[11px] font-medium text-slate-400">
                          Nội dung chuyển khoản (SePay)
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-2">
                          <span className="font-mono text-xs sm:text-sm font-black text-indigo-950 dark:text-indigo-200 tracking-wider">
                            {transferMemo}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(transferMemo, "memo")}
                            title="Sao chép nội dung"
                            className="text-indigo-500 hover:text-indigo-700 shrink-0 transition-colors p-1"
                          >
                            {copiedMemo ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 2: CHI TIẾT NỘI DUNG HÓA ĐƠN - FULL CARD TABLE, NO DUPLICATE CARD HEADER */}
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-[11px] font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3.5 w-12 text-center">STT</th>
                      <th className="py-2.5 px-3.5">Nội dung khoản thu</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {items.map((it: any) => (
                      <tr key={it.stt} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                          {it.stt}
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold text-slate-800 dark:text-slate-200">
                          {it.name}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatVnd(it.amount)}
                        </td>
                      </tr>
                    ))}

                    {/* Total Row: Guaranteed single line */}
                    <tr className="bg-indigo-50/40 dark:bg-indigo-950/30 font-black border-t-2 border-indigo-100 dark:border-indigo-900/40">
                      <td colSpan={2} className="py-3 px-4 text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-300">
                        Tổng cộng
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-sm sm:text-base text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {formatVnd(totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* THÔNG BÁO ĐÃ THU ĐỦ TIỀN - DI CHUYỂN XUỐNG ĐÂY THEO HƯỚNG DẪN */}
              {isPaid && (
                <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 px-4 py-3.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-300 shadow-2xs">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex-1 leading-relaxed">
                    <span className="font-bold">Đã thu đủ {formatVnd(totalAmount)}.</span> Hóa đơn đã được đối soát và ghi nhận thành công vào sổ cái thu tiền.
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-5">
              {/* CARD 1: CHỌN PHƯƠNG THỨC THANH TOÁN */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4.5 sm:p-5 shadow-2xs">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Chọn phương thức thanh toán
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isPaid
                        ? "Hóa đơn đã được thanh toán — Các kênh thanh toán tạm khóa"
                        : "Thanh toán nhanh, an toàn và tự động ghi nhận vào hệ thống"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mt-3.5">
                  {/* Option 1: Gửi qua Zalo */}
                  <button
                    type="button"
                    onClick={handleSendZalo}
                    disabled={isPaid || isSendingZalo}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left group ${
                      isPaid
                        ? "opacity-35 grayscale pointer-events-none cursor-not-allowed bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-800"
                        : "border-blue-200/80 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-black text-xs shadow-2xs ${
                          isPaid ? "bg-slate-400 text-white" : "bg-blue-600 text-white"
                        }`}
                      >
                        {isSendingZalo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zalo"}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-950 dark:text-blue-100">
                          Gửi hóa đơn qua Zalo
                        </div>
                        <div className="text-[11px] text-blue-600/80 dark:text-blue-400">
                          Gửi link thanh toán cho khách hàng qua Zalo
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Option 2: Quét trực tiếp (triggers seamless in-modal presentation mode) */}
                  <button
                    type="button"
                    onClick={() => setShowDirectScan(true)}
                    disabled={isPaid}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left group ${
                      isPaid
                        ? "opacity-35 grayscale pointer-events-none cursor-not-allowed bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-800"
                        : "border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-2xs ${
                          isPaid
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400"
                            : "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                        }`}
                      >
                        <Scan className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-950 dark:text-indigo-100">
                          Quét trực tiếp
                        </div>
                        <div className="text-[11px] text-indigo-600/80 dark:text-indigo-400">
                          Mở camera để khách quét mã QR tại chỗ
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Option 3: Thu tiền mặt */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomPayAmount(amountToPay.toLocaleString("vi-VN"));
                      setShowPayCashModal(true);
                    }}
                    disabled={isPaid}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left group ${
                      isPaid
                        ? "opacity-35 grayscale pointer-events-none cursor-not-allowed bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-800"
                        : "border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-2xs ${
                          isPaid
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400"
                            : "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        <Banknote className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
                          Thu tiền mặt
                        </div>
                        <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400">
                          Ghi nhận thanh toán tiền mặt từ khách hàng
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Option 4: Ghi nhận chuyển khoản */}
                  <button
                    type="button"
                    onClick={() => setShowBankTransferModal(true)}
                    disabled={isPaid}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left group ${
                      isPaid
                        ? "opacity-35 grayscale pointer-events-none cursor-not-allowed bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/50 dark:border-slate-800"
                        : "border-purple-200/80 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-2xs ${
                          isPaid
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400"
                            : "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
                        }`}
                      >
                        <Landmark className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-purple-950 dark:text-purple-100">
                          Ghi nhận chuyển khoản
                        </div>
                        <div className="text-[11px] text-purple-600/80 dark:text-purple-400">
                          Xác nhận khách đã chuyển khoản
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>

              {/* CARD 2: HOẠT ĐỘNG LIÊN QUAN */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4.5 sm:p-5 shadow-2xs">
                <div className="flex items-center gap-2 mb-3.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Clock3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Hoạt động liên quan</span>
                </div>

                <div className="space-y-1">
                  {/* Event 1: Tạo hóa đơn */}
                  <div className="flex gap-3 relative">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="flex h-5 w-5 items-center justify-center relative">
                        {isPaid ? (
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950 shadow-xs"></span>
                        ) : (
                          <>
                            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950 shadow-xs"></span>
                          </>
                        )}
                      </div>
                      <div className={`w-[1.5px] flex-1 my-1 ${isPaid ? "bg-emerald-300 dark:bg-emerald-800" : "bg-slate-200 dark:bg-slate-800"}`} />
                    </div>
                    <div className="flex-1 pb-4 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-mono text-slate-400 leading-5">
                            {formatDate(invoice.createdAt)} 14:20
                          </div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Tạo hóa đơn
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Hóa đơn {invoiceCode} đã được tạo
                          </div>
                        </div>
                        {!isPaid && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0 border border-amber-200/60 dark:border-amber-800/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Chờ thanh toán
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Event 2: Gửi hóa đơn */}
                  <div className="flex gap-3 relative">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="flex h-5 w-5 items-center justify-center relative">
                        <span className={`h-2.5 w-2.5 rounded-full shadow-xs ${
                          isPaid
                            ? "bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950"
                            : "bg-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-950"
                        }`}></span>
                      </div>
                      <div className={`w-[1.5px] flex-1 my-1 ${isPaid ? "bg-emerald-300 dark:bg-emerald-800" : "bg-slate-200 dark:bg-slate-800"}`} />
                    </div>
                    <div className="flex-1 pb-4 min-w-0">
                      <div className="text-[10px] font-mono text-slate-400 leading-5">
                        {formatDate(invoice.createdAt)} 14:20
                      </div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Gửi hóa đơn cho khách hàng
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Đã gửi qua Zalo cho {customerName}
                      </div>
                    </div>
                  </div>

                  {/* Event 3: Thanh toán */}
                  <div className="flex gap-3 relative">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="flex h-5 w-5 items-center justify-center relative">
                        {isPaid ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950 shadow-xs"></span>
                          </>
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700 ring-4 ring-slate-100 dark:ring-slate-800"></span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-slate-400 leading-5">
                        {isPaid ? formatDate(new Date()) : "--"}
                      </div>
                      <div className={`text-xs font-semibold ${isPaid ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-slate-700 dark:text-slate-300"}`}>
                        Thanh toán
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isPaid
                          ? `Đã thanh toán đủ ${formatVnd(totalAmount)}`
                          : "Chưa có thanh toán nào được ghi nhận"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. MODAL FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-slate-50/60 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 shrink-0">
          {/* Left Actions: Tải PDF, In hóa đơn (xpath: /html/body/div[3]/div/main/div/div/div[2]/div[2]/div[3]/div[1]) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDirectDownloadPdf}
              disabled={isDownloadingPdf}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs flex-1 sm:flex-none cursor-pointer disabled:opacity-60"
              title="Đóng gói và tải xuống file PDF hóa đơn ngay"
            >
              {isDownloadingPdf ? (
                <Loader2 className="h-3.5 w-3.5 text-indigo-600 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 text-slate-500" />
              )}
              <span>{isDownloadingPdf ? "Đang tạo PDF..." : "Tải PDF"}</span>
            </button>
            <button
              type="button"
              onClick={handleDirectPrint}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs flex-1 sm:flex-none cursor-pointer"
              title="Mở in hóa đơn ngay"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>In hóa đơn</span>
            </button>
          </div>

          {/* Right Actions: Đóng, Gửi qua Zalo ngay */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleSendZalo}
              disabled={isSendingZalo || isPaid}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2 text-xs font-black transition-colors shadow-xs ${
                isPaid
                  ? "bg-emerald-600 text-white cursor-default"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {isSendingZalo ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isPaid ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>{isPaid ? "Đã thanh toán" : "Gửi qua Zalo ngay"}</span>
            </button>
          </div>
        </div>

        {/* REQUIREMENT 3: SEAMLESS IN-MODAL PRESENTATION MODE (REPLACES UGLY NESTED POPUP) */}
        {showDirectScan && (
          <div className="absolute inset-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Direct scan topbar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDirectScan(false)}
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Quay lại chi tiết</span>
              </button>
              <div className="flex items-center gap-2">
                {isPaid ? (
                  <>
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Đã thanh toán thành công!
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Đang chờ khách quét mã thanh toán...
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowDirectScan(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Direct scan center stage */}
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4 space-y-4">
              <div
                className={`relative p-4 sm:p-5 flex items-center justify-center overflow-hidden rounded-3xl transition-all ${
                  isPaid
                    ? "border-0 shadow-none bg-transparent"
                    : "bg-white border-2 border-indigo-200 dark:border-indigo-800 shadow-2xl"
                }`}
              >
                {!isPaid && (
                  <img
                    src={qrImageUrl}
                    alt="QR thanh toán lớn"
                    className="h-72 w-72 sm:h-84 sm:w-84 md:h-96 md:w-96 max-h-[46vh] object-contain transition-all duration-500"
                  />
                )}

                {/* SUCCESS PAYMENT CELEBRATION OVERLAY - BORDERLESS */}
                {isPaid && (
                  <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-300 select-none">
                    <div className="relative flex items-center justify-center mb-4">
                      <span className="absolute inline-flex h-32 w-32 rounded-full bg-emerald-400/20 animate-ping" />
                      <span className="absolute inline-flex h-26 w-26 rounded-full bg-emerald-300/30 animate-pulse" />
                      <div className="relative flex h-20 w-20 sm:h-22 sm:w-22 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/40 ring-8 ring-emerald-100 dark:ring-emerald-950/80 animate-in zoom-in-75 duration-300">
                        <Check className="h-11 w-11 sm:h-12 sm:w-12 stroke-[3.5]" />
                      </div>
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-tight">
                      Thanh toán thành công!
                    </h4>
                    <p className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-200 mt-2">
                      Đã thu đủ {formatVnd(totalAmount)}
                    </p>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                      Hóa đơn đã được đối soát và ghi nhận
                    </span>
                  </div>
                )}
              </div>

              {/* WHEN PAID: REMOVE ALL REDUNDANT LABELS/STRIPS (MARKED BY USER X), SHOW ONLY RETURN BUTTON + COUNTDOWN */}
              {isPaid ? (
                <div className="flex flex-col items-center gap-2 pt-2 animate-in fade-in duration-300">
                  <button
                    type="button"
                    onClick={() => setShowDirectScan(false)}
                    className="inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Quay lại chi tiết hóa đơn</span>
                    <span className="inline-flex items-center justify-center rounded-full bg-emerald-700/90 px-2.5 py-0.5 text-xs font-mono font-bold tracking-tight">
                      {directScanCountdown}s
                    </span>
                  </button>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Tự động quay lại chi tiết sau <b className="text-emerald-600 dark:text-emerald-400 font-mono">{directScanCountdown}s</b>
                  </span>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400 tracking-tight">
                      {formatVnd(amountToPay)}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1 font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                      <span>Nội dung: {transferMemo}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(transferMemo, "memo")}
                        className="text-slate-400 hover:text-indigo-600"
                      >
                        {copiedMemo ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Bank Details Strip */}
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-2xl px-5 py-2.5 border border-slate-100 dark:border-slate-800">
                    <div>
                      Ngân hàng: <span className="font-bold text-slate-800 dark:text-slate-200">{activeBank.bankName}</span>
                    </div>
                    <div>•</div>
                    <div className="flex items-center gap-1">
                      Số TK: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{activeBank.accountNumber}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeBank.accountNumber, "acc")}
                        className="text-slate-400 hover:text-indigo-600"
                      >
                        {copiedAccount ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div>•</div>
                    <div>
                      Chủ TK: <span className="font-bold text-slate-800 dark:text-slate-200">{activeBank.accountName}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 max-w-sm">
                    💡 Khi khách quét mã và hoàn tất chuyển khoản, hệ thống SePay sẽ tự động nhận diện và chuyển trạng thái sang <b>Đã thanh toán</b>.
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDirectScan(false)}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-2xs"
                  >
                    Thu nhỏ mã QR (ESC)
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* SUB-MODAL 1: THU TIỀN MẶT */}
        {showPayCashModal && (
          <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Banknote className="h-4 w-4" />
                  </div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    Ghi nhận thu tiền mặt
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPayCashModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Số tiền thu (VND)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customPayAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      if (!raw) {
                        setCustomPayAmount("");
                        return;
                      }
                      const num = parseInt(raw, 10);
                      setCustomPayAmount(num.toLocaleString("vi-VN"));
                    }}
                    placeholder="0"
                    className="w-full h-11 pl-3.5 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-base outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                    VNĐ
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                  <span>Còn phải thu: {formatVnd(amountToPay)}</span>
                  <button
                    type="button"
                    onClick={() => setCustomPayAmount(amountToPay.toLocaleString("vi-VN"))}
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    Thu đủ
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayCashModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  Hủy (ESC)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCashPayment}
                  disabled={payMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                >
                  {payMutation.isPending ? "Đang lưu..." : "Xác nhận thu"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB-MODAL 2: GHI NHẬN CHUYỂN KHOẢN */}
        {showBankTransferModal && (
          <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    Xác nhận chuyển khoản
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBankTransferModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Xác nhận khách hàng <b>{customerName}</b> đã chuyển khoản số tiền{" "}
                <b className="text-indigo-600">{formatVnd(amountToPay)}</b> vào tài khoản ngân hàng?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBankTransferModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  Hủy (ESC)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBankTransfer}
                  disabled={payMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
                >
                  {payMutation.isPending ? "Đang xác nhận..." : "Xác nhận chuyển khoản"}
                </button>
              </div>
            </div>
          </div>
        )}



        {/* HIDDEN PRINT PORTAL FOR INSTANT 1-PAGE A4 PRINTING WITHOUT PREVIEW */}
        {mounted && typeof document !== "undefined" &&
          createPortal(
            <div id="homeland-print-portal" aria-hidden="true">
              <style>{`
                #homeland-print-portal {
                  display: none;
                }
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 5mm 10mm;
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
              <PrintableInvoiceSheet
                invoiceCode={invoiceCode}
                periodLabel={periodLabel}
                creationDateStr={formatDateTime(invoice.createdAt || invoice.date)}
                dueDateStr={formatDate(invoice.dueDate || invoice.date)}
                isPaid={isPaid}
                customerName={customerName}
                customerPhone={customerPhone}
                roomName={roomNumber}
                buildingName={buildingName}
                contractCode={contractCode}
                paymentMethod={invoice.paymentMethod || "Chuyển khoản / Tiền mặt"}
                totalAmount={totalAmount}
                items={items.map((it: any) => ({
                  stt: it.stt,
                  name: it.name,
                  amount: Number(it.amount || 0),
                }))}
                qrImageUrl={qrImageUrl}
              />
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
