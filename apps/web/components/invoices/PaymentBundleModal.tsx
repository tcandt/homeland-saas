"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  CalendarDays,
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
  Folder,
  Info,
  Landmark,
  Link2,
  Loader2,
  Phone,
  QrCode,
  Receipt,
  RefreshCcw,
  Scan,
  Send,
  Share2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { getTenantAvatar } from "@/components/tenants/TenantDetailDrawer";
import { settingsApi } from "@/lib/api/settings.api";
import toast from "react-hot-toast";
import PrintableInvoiceModal from "./PrintableInvoiceModal";

const formatVnd = (value: number) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value?: string) => {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Build VietQR image URL with bank name, account, amount, and memo
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

// Return bank badge
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

export type PaymentBundleData = {
  bundleCode: string;
  title?: string;
  modalTitle?: string;
  badgeLabel?: string;
  subtitle?: string;
  bannerText?: string;
  total: number;
  paid: number;
  remaining: number;
  status: string;
  statusLabel?: string;
  dueDate: string;
  period: string;
  customer?: any;
  room?: {
    roomCode?: string;
    buildingName?: string;
  };
  contract?: any;
  items?: {
    stt: number;
    name: string;
    amount: number;
    isNegative?: boolean;
  }[];
  vouchers?: {
    id: string;
    code: string;
    title: string;
    badge: string;
    badgeType: "success" | "info" | "warning";
    type: "INVOICE" | "DEPOSIT";
  }[];
  steps?: {
    label: string;
    time: string;
    done: boolean;
  }[];
  activities?: {
    time: string;
    text: string;
  }[];
};

interface PaymentBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundle: PaymentBundleData | null;
  onViewContract?: (contractId?: string) => void;
}

export default function PaymentBundleModal({
  isOpen,
  onClose,
  bundle,
  onViewContract,
}: PaymentBundleModalProps) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "VOUCHERS" | "PAYMENT" | "HISTORY">("OVERVIEW");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedMemo, setCopiedMemo] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isCashCollected, setIsCashCollected] = useState(false);
  const [showDirectScan, setShowDirectScan] = useState(false);
  const [directScanCountdown, setDirectScanCountdown] = useState(15);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [selectedBankOverride, setSelectedBankOverride] = useState<any | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

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

  // Resolve active bank from Settings Bank Accounts
  const activeBank = useMemo(() => {
    if (selectedBankOverride) return selectedBankOverride;
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
  }, [selectedBankOverride, configuredBankAccounts]);

  const bankBadge = getBankBadge(activeBank.bankName);

  // Hierarchical ESC key handling (LIFO)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        e.stopPropagation();

        if (showPrintModal) {
          setShowPrintModal(false);
          return;
        }
        if (showDirectScan) {
          setShowDirectScan(false);
          return;
        }
        if (isBankDropdownOpen) {
          setIsBankDropdownOpen(false);
          return;
        }

        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = "";
    };
  }, [isOpen, showPrintModal, showDirectScan, isBankDropdownOpen, onClose]);

  if (!isOpen || !bundle) return null;

  const isPaid = (bundle.paid >= bundle.total && bundle.total > 0) || isCashCollected;
  const amountToPay = bundle.remaining > 0 ? bundle.remaining : bundle.total;

  const customerName =
    bundle.customer?.fullName ||
    bundle.customer?.name ||
    bundle.contract?.customer?.fullName ||
    "UAT LK01.32 2PN MUMN94T9";
  const roomCode =
    bundle.room?.roomCode ||
    bundle.contract?.room?.code ||
    "PN 32-02";

  // SePay payment code or normalized room code
  const transferMemo = (() => {
    const cleanRoom = String(roomCode || "3202").replace(/[^a-zA-Z0-9]/g, "");
    return `HD${cleanRoom.slice(-4)}1026`;
  })();

  const qrImageUrl = buildVietQrUrl(
    activeBank.bankName,
    activeBank.accountNumber,
    amountToPay,
    transferMemo,
    activeBank.accountName
  );

  // Countdown (15s) to auto-return to details when payment is successful in direct scan mode
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

  const handleCopy = (text: string, type: "code" | "amount" | "memo" | "acc") => {
    navigator.clipboard.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      toast.success("Đã sao chép mã đợt thanh toán!");
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

  const handleSendZalo = () => {
    toast.success(`Đang mở Zalo gửi thông tin thanh toán ${formatVnd(amountToPay)} cho ${customerName}...`);
    const shareText = `Chào bạn, đợt thanh toán ${bundle.bundleCode} cho phòng ${roomCode} với số tiền ${formatVnd(amountToPay)}. Vui lòng quét mã QR hoặc chuyển khoản với nội dung: ${transferMemo}`;
    navigator.clipboard.writeText(shareText);
  };

  const handleCollectCash = () => {
    setIsCashCollected(true);
    setShowDirectScan(false);
    toast.success(`Đã ghi nhận thu tiền mặt ${formatVnd(amountToPay)} từ khách hàng thành công!`);
  };

  const handleExportVoucher = () => {
    setShowPrintModal(true);
  };

  // Fallback default items if not provided
  const items = bundle.items && bundle.items.length > 0 ? bundle.items : [
    { stt: 1, name: "Tiền thuê tháng đầu (ACTUAL_DAYS_V1)", amount: 266667 },
    { stt: 2, name: "Tiền cọc hợp đồng", amount: 8000000 },
    { stt: 3, name: "Trừ cọc giữ phòng đã thanh toán", amount: -1000000, isNegative: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog: Spacious layout max-w-5xl xl:max-w-6xl */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-5xl xl:max-w-6xl max-h-[94vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-800 z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* 1. MODAL HEADER - SLIM ULTRA-SLEEK COMPACT HEADER */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText size={15} />
            </div>
            <h3 className="font-black text-[13px] sm:text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {bundle.modalTitle || bundle.title || "Chi tiết đợt thanh toán đầu tiên"}
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-black shrink-0">
              {roomCode}
            </span>
            {customerName && (
              <span className="hidden sm:inline-flex text-xs font-bold text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                • {customerName}
              </span>
            )}
            <div className="hidden md:inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
              <span>{bundle.bundleCode}</span>
              <button
                type="button"
                onClick={() => handleCopy(bundle.bundleCode, "code")}
                title="Sao chép mã đợt thanh toán"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                {copiedCode ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                isPaid || isCashCollected
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isPaid || isCashCollected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                }`}
              />
              <span>{isPaid || isCashCollected ? "Đã thu đủ" : "Chờ thanh toán"}</span>
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

        {/* 2. MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* BANNER NOTIFICATION (ORANGE WARNING IF UNPAID) */}
          {!(isPaid || isCashCollected) ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Khách hàng chưa thanh toán. Có thể gửi QR qua Zalo, quét trực tiếp hoặc thu tiền mặt.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Đã thanh toán đầy đủ cho đợt thanh toán này.</span>
            </div>
          )}

          {/* 5 METRIC KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* Card 1: Tổng cần thu */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 shadow-2xs">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-slate-500">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <span>Tổng cần thu</span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono tracking-tight text-slate-900 dark:text-slate-100">
                {formatVnd(bundle.total)}
              </div>
            </div>

            {/* Card 2: Đã thu */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 shadow-2xs">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-slate-500">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-3.5 w-3.5" />
                </div>
                <span>Đã thu</span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatVnd(isCashCollected ? bundle.total : bundle.paid)}
              </div>
            </div>

            {/* Card 3: Còn lại */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 shadow-2xs">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-slate-500">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span>Còn lại</span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono tracking-tight text-slate-900 dark:text-slate-100">
                {formatVnd(isCashCollected ? 0 : bundle.remaining)}
              </div>
            </div>

            {/* Card 4: Hạn thanh toán */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 shadow-2xs">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-slate-500">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <span>Hạn thanh toán</span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {formatDate(bundle.dueDate)}
              </div>
            </div>

            {/* Card 5: Kỳ thanh toán */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 shadow-2xs">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-slate-500">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <span>Kỳ thanh toán</span>
              </div>
              <div className="text-sm sm:text-base font-black font-mono tracking-tight text-slate-900 dark:text-slate-100">
                {bundle.period || "2026-09"}
              </div>
            </div>
          </div>

          {/* TAB NAVIGATION */}
          <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab("OVERVIEW")}
              className={`flex items-center gap-2 pb-2.5 px-1 text-xs font-bold transition-all relative ${
                activeTab === "OVERVIEW"
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Tổng quan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("VOUCHERS")}
              className={`flex items-center gap-2 pb-2.5 px-1 text-xs font-bold transition-all relative ${
                activeTab === "VOUCHERS"
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>Phiếu liên kết</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PAYMENT")}
              className={`flex items-center gap-2 pb-2.5 px-1 text-xs font-bold transition-all relative ${
                activeTab === "PAYMENT"
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Thanh toán</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("HISTORY")}
              className={`flex items-center gap-2 pb-2.5 px-1 text-xs font-bold transition-all relative ${
                activeTab === "HISTORY"
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Clock3 className="h-3.5 w-3.5" />
              <span>Lịch sử</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW (EXACT MATCH WITH IMAGE 1) */}
          {activeTab === "OVERVIEW" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* LEFT COLUMN */}
              <div className="space-y-4">
                {/* 1. QR THANH TOÁN */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                        <QrCode className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          QR thanh toán
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Quét mã QR hoặc chuyển khoản theo tài khoản Settings
                        </p>
                      </div>
                    </div>

                    {/* Bank Selector Dropdown - Only show when unpaid */}
                    {!isPaid && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
                        >
                          <span className={`flex h-4.5 w-4.5 items-center justify-center rounded-md ${bankBadge.bg} ${bankBadge.text} text-[9px] font-black`}>
                            {bankBadge.label[0]}
                          </span>
                          <span>{activeBank.bankName}</span>
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </button>

                        {isBankDropdownOpen && configuredBankAccounts.length > 0 && (
                          <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[240px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Tài khoản nhận tiền trong Settings
                            </div>
                            {configuredBankAccounts.map((acc) => (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() => {
                                  setSelectedBankOverride(acc);
                                  setIsBankDropdownOpen(false);
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                                  activeBank.accountNumber === acc.accountNumber
                                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 font-bold"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                }`}
                              >
                                <div>
                                  <div className="font-bold">{acc.bankName}</div>
                                  <div className="font-mono text-[11px] text-slate-400">{acc.accountNumber}</div>
                                </div>
                                {activeBank.accountNumber === acc.accountNumber && (
                                  <Check className="h-4 w-4 text-indigo-600" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isPaid ? (
                    /* HIỆU ỨNG THANH TOÁN THÀNH CÔNG VÀO GIỮA CARD - LOẠI BỎ THÔNG TIN THANH TOÁN */
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
                        {formatVnd(bundle.total)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                      {/* QR Box - Borderless & spacious to avoid crowding payment details */}
                      <div className="relative flex h-38 w-38 sm:h-44 sm:w-44 shrink-0 items-center justify-center bg-transparent p-0 group">
                        <img
                          src={qrImageUrl}
                          alt={`QR thanh toán ${activeBank.bankName}`}
                          className="h-full w-full object-contain"
                        />
                      </div>

                      {/* Amount & Transfer Memo Info */}
                      <div className="flex-1 w-full space-y-2.5">
                        <div>
                          <div className="text-[11px] font-medium text-slate-400">
                            Số tiền cần thanh toán
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 tracking-tight">
                              {formatVnd(amountToPay)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(String(amountToPay), "amount")}
                              title="Sao chép số tiền"
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              {copiedAmount ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Account details */}
                        <div className="text-xs bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-1.5 border border-slate-100 dark:border-slate-800">
                          <div className="text-[10px] text-slate-400 font-medium">Tài khoản thụ hưởng ({activeBank.bankName})</div>
                          <div className="flex items-center justify-between font-mono font-bold text-slate-800 dark:text-slate-200">
                            <span>{activeBank.accountNumber}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(activeBank.accountNumber, "acc")}
                              className="text-slate-400 hover:text-indigo-600"
                            >
                              {copiedAccount ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold truncate">{activeBank.accountName}</div>
                        </div>

                        <div>
                          <div className="text-[11px] font-medium text-slate-400">
                            Nội dung chuyển khoản
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-1.5">
                            <span className="font-mono text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate">
                              {transferMemo}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(transferMemo, "memo")}
                              title="Sao chép nội dung"
                              className="text-indigo-500 hover:text-indigo-700 shrink-0 transition-colors"
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

                {/* 2. CHI TIẾT KHOẢN THU */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 shadow-2xs">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Chi tiết khoản thu
                    </h3>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 mb-2">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">STT</th>
                          <th className="py-2.5 px-3">Nội dung khoản thu</th>
                          <th className="py-2.5 px-3 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {items.map((item) => (
                          <tr key={item.stt} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                              {item.stt}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                              {item.name}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                              {formatVnd(item.amount)}
                            </td>
                          </tr>
                        ))}
                        {/* TOTAL ROW */}
                        <tr className="bg-indigo-50/30 dark:bg-indigo-950/20 font-black">
                          <td colSpan={2} className="py-3 px-3 text-sm text-indigo-600 dark:text-indigo-400">
                            Tổng cộng
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-base text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {formatVnd(bundle.total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                {/* 1. THỰC HIỆN THANH TOÁN */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 shadow-2xs">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Thực hiện thanh toán
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {isPaid
                          ? "Đợt thanh toán đã hoàn tất — Các kênh thanh toán tạm khóa"
                          : "Chọn phương thức phù hợp để nhận thanh toán từ khách hàng"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-3">
                    {/* Method 1: Zalo */}
                    <button
                      type="button"
                      onClick={handleSendZalo}
                      disabled={isPaid}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left group ${
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
                          Zalo
                        </div>
                        <div>
                          <div className="text-xs font-bold text-blue-950 dark:text-blue-100">
                            Gửi thanh toán qua Zalo
                          </div>
                          <div className="text-[11px] text-blue-600/80 dark:text-blue-400">
                            Gửi QR và thông tin thanh toán cho khách hàng qua Zalo
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Method 2: Direct Scan */}
                    <button
                      type="button"
                      onClick={() => setShowDirectScan(!showDirectScan)}
                      disabled={isPaid}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left group ${
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

                    {/* Method 3: Cash */}
                    <button
                      type="button"
                      onClick={handleCollectCash}
                      disabled={isPaid}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left group ${
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
                  </div>

                  {/* Actions Links Below */}
                  <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => handleCopy(window.location.href, "code")}
                      className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-semibold transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>Sao chép link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.success("Đã làm mới mã QR thanh toán!")}
                      className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-semibold transition-colors"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      <span>Làm mới QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportVoucher}
                      className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-semibold transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Xuất phiếu</span>
                    </button>
                  </div>
                </div>

                {/* 2. HOẠT ĐỘNG GẦN ĐÂY */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 shadow-2xs">
                  <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <Clock3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Hoạt động gần đây</span>
                  </div>

                  <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200 dark:before:bg-slate-800">
                    {/* Activity 1 */}
                    <div className="relative">
                      <div className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-50 dark:ring-amber-950" />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-mono text-slate-400">
                            29/09/2026 14:20
                          </div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Tạo đợt thanh toán đầu tiên
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Chờ khách hàng thanh toán
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Chờ thanh toán
                        </span>
                      </div>
                    </div>

                    {/* Activity 2 */}
                    <div className="relative">
                      <div className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-slate-400 ring-4 ring-slate-100 dark:ring-slate-800" />
                      <div>
                        <div className="text-[10px] font-mono text-slate-400">
                          29/09/2026 14:20
                        </div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Đã tạo QR thanh toán
                        </div>
                      </div>
                    </div>

                    {/* Activity 3 */}
                    <div className="relative">
                      <div className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-slate-400 ring-4 ring-slate-100 dark:ring-slate-800" />
                      <div>
                        <div className="text-[10px] font-mono text-slate-400">
                          29/09/2026 14:20
                        </div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Gửi thông tin thanh toán cho khách hàng
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VOUCHERS */}
          {activeTab === "VOUCHERS" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                Danh sách chứng từ trong đợt thanh toán
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(bundle.vouchers || []).map((v) => (
                  <div key={v.code} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                        {v.code}
                      </div>
                      <div className="text-xs text-slate-500">{v.title}</div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {v.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PAYMENT */}
          {activeTab === "PAYMENT" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                Thông tin giao dịch & thanh toán
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div className="text-slate-500">Phương thức thanh toán</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                    Tiền mặt / Chuyển khoản (Đã đối soát)
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <div className="text-slate-500">Mã giao dịch đối soát</div>
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1">
                    TXN-ENTRY-{bundle.period}-CONFIRMED
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HISTORY */}
          {activeTab === "HISTORY" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                Nhật ký sự kiện đợt thanh toán
              </h3>
              <div className="space-y-3 text-xs">
                {(bundle.activities || []).map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="font-mono text-slate-400">{a.time}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {a.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. MODAL FOOTER */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50/60 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={() => {
              if (onViewContract) {
                onViewContract(bundle.contract?.id);
              } else {
                window.location.href = `/contracts`;
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-black transition-colors shadow-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Xem hợp đồng thuê</span>
          </button>
        </div>

        {/* IN-MODAL PRESENTATION MODE FOR DIRECT SCAN (SEAMLESS, NO NESTED POPUP) */}
        {showDirectScan && (
          <div className="absolute inset-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Top bar */}
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

            {/* Center stage */}
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
                      Đã thu đủ {formatVnd(bundle.total)}
                    </p>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                      Đợt thanh toán đã được đối soát và ghi nhận
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

        {/* PRINTABLE INVOICE MODAL PREVIEW */}
        {showPrintModal && (
          <PrintableInvoiceModal
            isOpen={showPrintModal}
            onClose={() => setShowPrintModal(false)}
            invoiceCode={(bundle as any).code || bundle.vouchers?.[0]?.code || "HD-DOT-THANH-TOAN"}
            periodLabel="Kỳ hiện tại"
            creationDateStr={new Date().toLocaleDateString("vi-VN")}
            dueDateStr={new Date().toLocaleDateString("vi-VN")}
            isPaid={isPaid}
            customerName={customerName}
            customerPhone="0900000000"
            roomName={roomCode}
            buildingName={bundle.contract?.room?.building?.name || "Tòa nhà chính"}
            contractCode={bundle.contract?.code || "HĐ"}
            paymentMethod={isPaid ? "Tiền mặt / Chuyển khoản" : "Chuyển khoản"}
            totalAmount={bundle.total}
            items={items.map((it: any, idx: number) => ({
              stt: it.stt || idx + 1,
              name: it.name,
              amount: it.amount,
            }))}
            qrImageUrl={qrImageUrl}
          />
        )}
      </div>
    </div>
  );
}
