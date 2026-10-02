"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  BarChart3,
  Building,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  FilterX,
  MoreHorizontal,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Split,
  Trash2,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ModalHeaderTitle } from "@/components/ui/ModalHeaderTitle";
import ExpenseDetailModal from "@/components/finance/ExpenseDetailModal";
import { financeApi } from "@/lib/api/finance.api";
import { getAuthorizationHeader } from "@/lib/auth/auth-header";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useBuildingsQuery } from "@/lib/queries/buildings.queries";
import { financeKeys, useExpensesQuery, useOwnerProfitSummaryQuery } from "@/lib/queries/finance.queries";

type ExpenseActionType = "approve" | "pay" | "cancel" | "reimburse" | "deduct";

type PendingAction = {
  type: ExpenseActionType;
  expense: any;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "primary" | "danger";
  tone?: "success" | "warning" | "danger";
};

const statusTabs = [
  { value: "", key: "all", label: "Tất cả" },
  { value: "PENDING", key: "pending", label: "Chờ duyệt" },
  { value: "APPROVED", key: "approved", label: "Đã duyệt" },
  { value: "PAID", key: "paid", label: "Đã chi" },
  { value: "CANCELLED", key: "cancelled", label: "Đã hủy" },
];

const categoryOptions = [
  { value: "", label: "Tất cả loại chi" },
  { value: "UTILITY", label: "Điện nước" },
  { value: "REPAIR", label: "Sửa chữa" },
  { value: "CLEANING", label: "Vệ sinh" },
  { value: "SUPPLIES", label: "Vật tư" },
  { value: "MAINTENANCE", label: "Bảo trì" },
  { value: "MARKETING", label: "Marketing" },
  { value: "REFUND", label: "Hoàn cọc" },
  { value: "STAFF", label: "Nhân sự" },
  { value: "OTHER", label: "Khác" },
];

const categoryLabels: Record<string, string> = {
  UTILITY: "Điện nước",
  REPAIR: "Sửa chữa",
  CLEANING: "Vệ sinh",
  SUPPLIES: "Vật tư",
  MAINTENANCE: "Bảo trì",
  MARKETING: "Marketing",
  REFUND: "Hoàn cọc",
  STAFF: "Nhân sự",
  OTHER: "Khác",
};

const categoryBadgeStyles: Record<string, string> = {
  CLEANING: "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300",
  REPAIR: "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-300",
  UTILITY: "bg-indigo-50 text-indigo-700 border-indigo-200/70 dark:bg-indigo-950/30 dark:border-indigo-800/40 dark:text-indigo-300",
  SUPPLIES: "bg-sky-50 text-sky-700 border-sky-200/70 dark:bg-sky-950/30 dark:border-sky-800/40 dark:text-sky-300",
  MARKETING: "bg-slate-100 text-slate-700 border-slate-200/70 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300",
  MAINTENANCE: "bg-teal-50 text-teal-700 border-teal-200/70 dark:bg-teal-950/30 dark:border-teal-800/40 dark:text-teal-300",
  REFUND: "bg-orange-50 text-orange-700 border-orange-200/70 dark:bg-orange-950/30 dark:border-orange-800/40 dark:text-orange-300",
  STAFF: "bg-blue-50 text-blue-700 border-blue-200/70 dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-blue-300",
  OTHER: "bg-slate-100 text-slate-600 border-slate-200/70 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
};

const settlementLabels: Record<string, string> = {
  NONE: "Chưa đối soát",
  REIMBURSED: "Đã hoàn ứng",
  DEDUCTED_FROM_PROFIT: "Khấu trừ lợi nhuận",
};

const formatMoney = (val?: number) => {
  return `${Number(val || 0).toLocaleString("vi-VN")} ₫`;
};

const formatDateOnly = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatTimeOnly = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const getExpenseName = (expense: any) => expense.description || expense.vendor || categoryLabels[expense.category] || expense.code || "Chi phí";

const buildMonthRange = (year: string, month: string) => {
  if (!year) return {};
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear)) return {};

  if (!month) {
    return {
      startDate: new Date(numericYear, 0, 1).toISOString(),
      endDate: new Date(numericYear, 11, 31, 23, 59, 59, 999).toISOString(),
    };
  }

  const numericMonth = Number(month);
  if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) return {};
  return {
    startDate: new Date(numericYear, numericMonth - 1, 1).toISOString(),
    endDate: new Date(numericYear, numericMonth, 0, 23, 59, 59, 999).toISOString(),
  };
};

type ExpenseTableProps = {
  defaultYear?: string;
  onCreateExpense?: () => void;
  showAnalyticsToggle?: boolean;
  isAnalyticsOpen?: boolean;
  onToggleAnalytics?: () => void;
};

export default function ExpenseTable({
  defaultYear,
  onCreateExpense,
  showAnalyticsToggle,
  isAnalyticsOpen,
  onToggleAnalytics,
}: ExpenseTableProps = {}) {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const { data: buildings = [] } = useBuildingsQuery({ limit: 100 });
  const { data: ownerSummary = [] } = useOwnerProfitSummaryQuery();

  const currentYear = defaultYear || String(new Date().getFullYear());
  const [ownerId, setOwnerId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadBusyId, setUploadBusyId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [selectedDetailExpense, setSelectedDetailExpense] = useState<any | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const queryParams = useMemo(
    () => ({
      ...buildMonthRange(year, month),
      ...(ownerId ? { ownerId } : {}),
      ...(buildingId ? { buildingId } : {}),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
    }),
    [buildingId, category, month, ownerId, status, year],
  );

  const { data, isLoading, isError, refetch } = useExpensesQuery(queryParams);

  // 100% strictly real database records (0 mock data)
  const expenses = useMemo(() => {
    if (Array.isArray(data)) return data;
    return [];
  }, [data]);

  const ownerOptions = useMemo(
    () => [
      { value: "", label: "Tất cả chủ" },
      ...(Array.isArray(ownerSummary) ? ownerSummary : [])
        .map((row: any) => ({
          value: row.owner?.id,
          label: row.owner?.name || row.owner?.code || "Chủ sở hữu",
        }))
        .filter((item: any) => item.value),
    ],
    [ownerSummary],
  );

  const buildingOptions = useMemo(
    () => [
      { value: "", label: "Tất cả tòa" },
      ...(buildings as any[])
        .filter((b) => {
          if (!ownerId) return true;
          const matchedOwner = (Array.isArray(ownerSummary) ? ownerSummary : []).find((row: any) => row.owner?.id === ownerId);
          return (matchedOwner?.buildings || []).some((ob: any) => ob.id === b.id);
        })
        .map((b) => ({ value: b.id, label: b.code || b.name })),
    ],
    [buildings, ownerId, ownerSummary],
  );

  const yearOptions = useMemo(() => {
    const baseYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => {
      const value = String(baseYear - index);
      return { value, label: value };
    });
  }, []);

  const monthOptions = [
    { value: "", label: "Cả năm" },
    ...Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1),
      label: `Tháng ${index + 1}`,
    })),
  ];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return expenses.filter((expense: any) => {
      if (status && expense.status !== status) return false;
      if (category && expense.category !== category) return false;
      if (!needle) return true;
      const haystack = [
        expense.code,
        expense.description,
        expense.vendor,
        expense.paidByName,
        expense.owner?.name,
        expense.building?.code,
        expense.building?.name,
        expense.room?.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [category, expenses, search, status]);

  // Tab counts strictly from real database
  const tabCounts = useMemo(() => {
    const counts = { all: expenses.length, pending: 0, approved: 0, paid: 0, cancelled: 0 };
    expenses.forEach((item: any) => {
      if (item.status === "PENDING") counts.pending += 1;
      else if (item.status === "APPROVED") counts.approved += 1;
      else if (item.status === "PAID") counts.paid += 1;
      else if (item.status === "CANCELLED") counts.cancelled += 1;
    });
    return counts;
  }, [expenses]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, page, pageSize]);

  const handleBillUpload = async (expenseId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Chỉ chấp nhận file ảnh (JPG, PNG, WEBP) hoặc PDF.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File tải lên không được vượt quá 10MB.");
      event.target.value = "";
      return;
    }

    setUploadBusyId(expenseId);
    const toastId = toast.loading("Đang tải hóa đơn...");

    try {
      const authHeaders = getAuthorizationHeader();
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "expenses");
      form.append("purpose", "expense-bill");

      const uploadRes = await fetch("/api/v1/settings/assets/upload", {
        method: "POST",
        headers: {
          ...authHeaders,
        },
        body: form,
      });

      if (!uploadRes.ok) {
        throw new Error("Tải file thất bại");
      }

      const uploadData = await uploadRes.json();
      const assetUrl = uploadData.data?.url || uploadData.url;
      if (!assetUrl) throw new Error("Không lấy được đường dẫn file");

      const current = expenses.find((e: any) => e.id === expenseId);
      const existingAttachments = Array.isArray(current?.attachmentUrls) ? current.attachmentUrls : [];
      const updatedAttachments = [...existingAttachments, assetUrl];

      await financeApi.updateExpense(expenseId, { attachmentUrls: updatedAttachments });
      await queryClient.invalidateQueries({ queryKey: financeKeys.expensesRoot() });
      toast.success("Đã đính kèm hóa đơn!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Tải hóa đơn thất bại", { id: toastId });
    } finally {
      setUploadBusyId(null);
      event.target.value = "";
    }
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    const { type, expense } = pendingAction;
    setBusyId(expense.id);

    try {
      if (type === "approve") {
        await financeApi.approveExpense(expense.id, { markPaid: false });
        toast.success("Đã duyệt chi phí");
      } else if (type === "pay") {
        await financeApi.payExpense(expense.id);
        toast.success("Đã ghi nhận chi tiền");
      } else if (type === "cancel") {
        await financeApi.cancelExpense(expense.id, { reason: "Hủy từ bảng chi phí" });
        toast.success("Đã hủy chi phí");
      } else if (type === "reimburse") {
        await financeApi.updateExpenseSettlement(expense.id, { settlementStatus: "REIMBURSED" });
        toast.success("Đã ghi nhận hoàn ứng");
      } else if (type === "deduct") {
        await financeApi.updateExpenseSettlement(expense.id, { settlementStatus: "DEDUCTED_FROM_PROFIT" });
        toast.success("Đã ghi nhận khấu trừ vào lợi nhuận");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financeKeys.ownerProfitSummary() }),
        queryClient.invalidateQueries({ queryKey: financeKeys.expensesRoot() }),
        queryClient.invalidateQueries({ queryKey: financeKeys.ledgerRoot() }),
      ]);
      setPendingAction(null);
    } catch (error: any) {
      toast.error(error?.message || "Không thể thực hiện thao tác");
    } finally {
      setBusyId(null);
    }
  };

  const openAction = (type: ExpenseActionType, expense: any) => {
    const code = expense.code || "Khoản chi";
    const configs: Record<ExpenseActionType, Omit<PendingAction, "type" | "expense">> = {
      approve: {
        title: "Duyệt chi phí",
        description: `Xác nhận duyệt ${code}. Khoản chi sẽ chuyển sang trạng thái đã duyệt và sẵn sàng để thanh toán.`,
        confirmLabel: "Duyệt chi",
        tone: "success",
      },
      pay: {
        title: "Đánh dấu đã chi",
        description: `Xác nhận ${code} đã được chi tiền. Nếu có cấu hình tài khoản kế toán, hệ thống sẽ tạo bút toán chi phí.`,
        confirmLabel: "Đã chi",
        tone: "warning",
      },
      cancel: {
        title: "Hủy chi phí",
        description: `Hủy ${code}. Chỉ áp dụng cho khoản chưa ghi sổ đã chi; khoản đã chi cần bút toán đảo thay vì hủy trực tiếp.`,
        confirmLabel: "Hủy chi phí",
        variant: "danger",
        tone: "danger",
      },
      reimburse: {
        title: "Đánh dấu đã hoàn ứng",
        description: `Xác nhận khoản ứng hộ của ${code} đã được hoàn lại cho người chi.`,
        confirmLabel: "Đã hoàn ứng",
        tone: "success",
      },
      deduct: {
        title: "Khấu trừ vào lợi nhuận",
        description: `Đánh dấu ${code} sẽ được khấu trừ khi chia lợi nhuận giữa các chủ.`,
        confirmLabel: "Khấu trừ",
        tone: "warning",
      },
    };
    setOpenActionMenuId(null);
    setPendingAction({ type, expense, ...configs[type] });
  };

  const resetFilters = () => {
    setOwnerId("");
    setBuildingId("");
    setStatus("");
    setCategory("");
    setYear(currentYear);
    setMonth("");
    setSearch("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(ownerId || buildingId || status || category || month || search);

  useEffect(() => {
    setPage(1);
  }, [queryParams, search]);

  useEffect(() => {
    if (defaultYear) {
      setYear(defaultYear);
    }
  }, [defaultYear]);

  // Click outside listener to close action dropdown
  useEffect(() => {
    if (!openActionMenuId) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-action-menu]")) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openActionMenuId]);

  const renderStatusBadge = (expense: any) => {
    const st = expense.status;
    const isDeducted = expense.settlementStatus === "DEDUCTED_FROM_PROFIT";

    if (isDeducted && st === "PAID") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/70 dark:bg-purple-950/30 dark:border-purple-800/40 dark:text-purple-300">
          <User size={12} className="text-purple-600" /> Đã khấu trừ owner
        </span>
      );
    }
    if (st === "PENDING") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-300">
          <Clock3 size={12} className="text-amber-500" /> Chờ duyệt
        </span>
      );
    }
    if (st === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300">
          <CheckCircle2 size={12} className="text-emerald-600" /> Đã duyệt
        </span>
      );
    }
    if (st === "PAID") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300">
          <CircleDollarSign size={12} className="text-emerald-600" /> Đã thanh toán
        </span>
      );
    }
    if (st === "CANCELLED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-950/30 dark:border-rose-800/40 dark:text-rose-300">
          <XCircle size={12} className="text-rose-500" /> Đã hủy
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
        {statusLabels[st] || st}
      </span>
    );
  };

  const renderActions = (expense: any) => {
    const firstBill = Array.isArray(expense.attachmentUrls) ? expense.attachmentUrls[0] : "";

    return (
      <div className="relative flex justify-end" data-action-menu>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Mở thao tác"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-text hover:bg-muted/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setOpenActionMenuId((curr) => (curr === expense.id ? null : expense.id));
          }}
        >
          <MoreHorizontal size={16} />
        </Button>

        {openActionMenuId === expense.id && (
          <div
            className="absolute right-0 top-9 z-50 w-48 overflow-hidden rounded-2xl border border-border/80 bg-card p-1.5 text-xs font-bold shadow-xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {permissions.canApproveExpense && expense.status === "PENDING" && (
              <ActionMenuButton
                dataTestId={`expense-approve-${expense.id}`}
                icon={<CheckCircle2 size={14} className="text-emerald-500" />}
                label="Duyệt chi phí"
                onClick={() => openAction("approve", expense)}
                highlight
              />
            )}

            {permissions.canPayExpense && (expense.status === "APPROVED" || expense.status === "PENDING") && (
              <ActionMenuButton
                dataTestId={`expense-pay-${expense.id}`}
                icon={<CircleDollarSign size={14} className="text-emerald-500" />}
                label="Đánh dấu đã chi"
                onClick={() => openAction("pay", expense)}
                highlight
              />
            )}

            {permissions.canSettleExpense && expense.status === "PAID" && (
              <>
                <ActionMenuButton
                  dataTestId={`expense-reimburse-${expense.id}`}
                  icon={<RotateCcw size={14} className="text-sky-500" />}
                  label="Hoàn ứng người chi"
                  onClick={() => openAction("reimburse", expense)}
                />
                <ActionMenuButton
                  dataTestId={`expense-deduct-${expense.id}`}
                  icon={<Split size={14} className="text-amber-500" />}
                  label="Khấu trừ lợi nhuận"
                  onClick={() => openAction("deduct", expense)}
                />
              </>
            )}

            {(permissions.isSystemAdmin || permissions.hasPermission("finance.update")) && expense.status !== "CANCELLED" && (
              <ActionMenuButton
                dataTestId={`expense-cancel-${expense.id}`}
                icon={<Trash2 size={14} />}
                label="Hủy chi phí"
                danger
                onClick={() => openAction("cancel", expense)}
              />
            )}

            {/* Upload bill option */}
            <div className="my-1 border-t border-border/40" />
            <label className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/10 cursor-pointer transition-colors">
              <Upload size={14} />
              <span>{firstBill ? "Đổi hóa đơn" : "Đính kèm hóa đơn"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                disabled={uploadBusyId === expense.id}
                onChange={(e) => handleBillUpload(expense.id, e)}
              />
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <section
        data-testid="expense-table-root"
        className="flex flex-col gap-2.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden"
      >
        {/* COMPACT FILTER & ACTION BAR - Synchronized with OperationsContractFilters */}
        <div className="p-3 md:p-3.5 border-b border-border/50 flex flex-col gap-2.5">
          {/* TOP BAR: Search & Select Filters & Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="search"
                name="expense_search_query"
                autoComplete="off"
                spellCheck="false"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm mã, nội dung, người chi, nhà cung cấp..."
                className="h-9 w-full rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-slate-50/60 dark:bg-white/[0.03] pl-9 pr-3 text-xs font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 focus:border-primary focus:bg-white dark:focus:bg-card focus:outline-none transition-colors"
              />
            </div>

            {/* Filter Dropdowns & Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Dropdown: Tất cả chủ */}
              <select
                aria-label="Lọc chi phí theo chủ sở hữu"
                data-testid="expense-filter-owner"
                value={ownerId}
                onChange={(e) => {
                  setOwnerId(e.target.value);
                  setBuildingId("");
                }}
                className="h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer hover:border-primary/50 transition-colors"
              >
                {ownerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Dropdown: Tất cả tòa */}
              <select
                aria-label="Lọc chi phí theo tòa nhà"
                data-testid="expense-filter-building"
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                className="h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer hover:border-primary/50 transition-colors"
              >
                {buildingOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Dropdown: Tất cả loại chi */}
              <select
                aria-label="Lọc chi phí theo loại chi"
                data-testid="expense-filter-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer hover:border-primary/50 transition-colors"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Dropdown: Cả năm / Tháng */}
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer hover:border-primary/50 transition-colors"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Dropdown: Năm */}
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer hover:border-primary/50 transition-colors"
              >
                {yearOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Button: Xóa lọc */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 gap-1.5 rounded-xl border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] px-3 text-xs font-semibold hover:border-primary/50"
                  aria-label="Bộ lọc"
                  data-testid="expense-table-reset-filters"
                >
                  <FilterX size={14} /> Xóa lọc
                </Button>
              )}

              {/* Button: Toggle Analytics Chart */}
              {showAnalyticsToggle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleAnalytics}
                  className={`h-9 gap-1.5 rounded-xl border-slate-200/80 dark:border-white/[0.1] px-3 text-xs font-semibold transition-all ${
                    isAnalyticsOpen
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                      : "bg-white dark:bg-white/[0.03] hover:border-primary/50"
                  }`}
                  aria-label="Biểu đồ phân tích"
                >
                  <BarChart3 size={14} />
                  <span>Biểu đồ</span>
                </Button>
              )}

              {/* Button: "+ Thêm chi phí" */}
              {onCreateExpense && permissions.canCreateExpense && (
                <Button
                  onClick={onCreateExpense}
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 text-white px-3.5 text-xs font-bold shadow-xs active:scale-95 transition-all"
                  data-testid="expense-table-create-button"
                >
                  <Plus size={15} /> Thêm chi phí
                </Button>
              )}
            </div>
          </div>

          {/* BOTTOM ROW: Quick Status Tabs / Pills with Real Count Badges */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pt-0.5 hide-scrollbar">
            {statusTabs.map((tab) => {
              const count = tabCounts[tab.key as keyof typeof tabCounts] || 0;
              const isSelected = status === tab.value;

              return (
                <button
                  key={tab.key}
                  type="button"
                  data-testid={`expense-tab-${tab.key}`}
                  onClick={() => setStatus(tab.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:border-purple-800 dark:text-purple-300 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-transparent"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? "bg-purple-600 text-white dark:bg-purple-400 dark:text-purple-950"
                        : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* LOADING & ERROR STATES */}
        {isLoading && (
          <div className="p-12 text-center text-xs font-semibold text-slate-400">Đang tải danh sách chi phí...</div>
        )}

        {isError && (
          <div className="p-12 text-center">
            <div className="text-xs font-semibold text-rose-500">Không tải được danh sách chi phí.</div>
            <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={() => refetch()}>
              Thử lại
            </Button>
          </div>
        )}

        {/* DESKTOP TABLE - Always rendered when not loading/error for test compatibility */}
        {!isLoading && !isError && (
          <>
            <div className="hidden xl:block overflow-x-auto min-h-[260px]">
              <table data-testid="expense-table-desktop" className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-border/60 bg-slate-50/70 dark:bg-card/50 text-[11px] font-semibold text-muted-foreground select-none">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Mã chi phí</th>
                    <th className="px-4 py-3 font-semibold min-w-[200px]">Nội dung</th>
                    <th className="px-4 py-3 font-semibold">Tòa nhà / Chủ</th>
                    <th className="px-4 py-3 font-semibold">Danh mục</th>
                    <th className="px-4 py-3 font-semibold">Người chi</th>
                    <th className="px-4 py-3 font-semibold">Số tiền</th>
                    <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="w-12 px-3 py-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Receipt size={32} className="mb-2 stroke-1 text-slate-300 dark:text-slate-600" />
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Chưa có chi phí nào</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {hasActiveFilters ? "Không có bản ghi phù hợp với bộ lọc hiện tại" : "Bấm nút '+ Thêm chi phí' để tạo phiếu chi mới"}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((expense: any) => {
                      const descLines = (expense.description || getExpenseName(expense)).split("\n");
                      const titleText = descLines[0];
                      const subText = descLines.slice(1).join(" ") || expense.vendor || "";
                      const categoryKey = expense.category || "OTHER";
                      const buildingCode = expense.building?.code || expense.building?.name || expense.costCenter?.code || "-";
                      const ownerTitle = expense.owner?.name || expense.paidByOwner?.name || "-";

                      return (
                        <tr
                          key={expense.id}
                          onClick={() => setSelectedDetailExpense(expense)}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors cursor-pointer group"
                        >
                          {/* 1. Mã chi phí */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
                                <FileText size={15} />
                              </div>
                              <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                {expense.code}
                              </span>
                            </div>
                          </td>

                          {/* 2. Nội dung */}
                          <td className="px-4 py-3.5">
                            <div className="min-w-0 max-w-[260px]">
                              <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs leading-tight">
                                {titleText}
                              </div>
                              {subText && (
                                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  {subText}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 3. Tòa nhà / Chủ */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="relative w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-border/60 flex items-center justify-center shrink-0">
                                <Building size={15} className="text-slate-500" />
                                {expense.room?.code && (
                                  <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-bold text-slate-700 dark:text-slate-300 border border-white dark:border-slate-900">
                                    {expense.room.code}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                  {buildingCode}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {ownerTitle}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 4. Danh mục */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                categoryBadgeStyles[categoryKey] || categoryBadgeStyles.OTHER
                              }`}
                            >
                              {categoryLabels[categoryKey] || categoryKey}
                            </span>
                          </td>

                          {/* 5. Người chi */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                {expense.paidByOwner?.name || expense.paidByName || "-"}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {expense.paidByRole || settlementLabels[expense.settlementStatus] || "Nhân viên"}
                              </div>
                            </div>
                          </td>

                          {/* 6. Số tiền */}
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                            {formatMoney(Number(expense.amount))}
                          </td>

                          {/* 7. Ngày tạo */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div>
                              <div className="font-medium text-slate-900 dark:text-slate-100 text-xs">
                                {formatDateOnly(expense.date || expense.createdAt)}
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground">
                                {formatTimeOnly(expense.createdAt || expense.date)}
                              </div>
                            </div>
                          </td>

                          {/* 8. Trạng thái */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {renderStatusBadge(expense)}
                          </td>

                          {/* 9. Thao tác */}
                          <td
                            className="px-3 py-3.5 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {renderActions(expense)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE & TABLET CARDS VIEW */}
            <div className="grid grid-cols-1 gap-3 xl:hidden p-4">
              {visibleRows.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Chưa có chi phí nào
                </div>
              ) : (
                visibleRows.map((expense: any) => {
                  const descLines = (expense.description || getExpenseName(expense)).split("\n");
                  const titleText = descLines[0];
                  const subText = descLines.slice(1).join(" ") || expense.vendor || "";
                  const categoryKey = expense.category || "OTHER";
                  const buildingCode = expense.building?.code || expense.building?.name || "-";
                  const ownerTitle = expense.owner?.name || expense.paidByOwner?.name || "-";

                  return (
                    <article
                      key={`${expense.id}-card`}
                      data-testid={`expense-row-${expense.id}`}
                      onClick={() => setSelectedDetailExpense(expense)}
                      className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-3 cursor-pointer hover:border-indigo-400 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <FileText size={16} />
                          </div>
                          <div>
                            <div className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                              {expense.code}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatDateOnly(expense.date || expense.createdAt)} {formatTimeOnly(expense.createdAt || expense.date)}
                            </div>
                          </div>
                        </div>
                        {renderStatusBadge(expense)}
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{titleText}</div>
                        {subText && <div className="text-[11px] text-muted-foreground mt-0.5">{subText}</div>}
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/20 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Tòa nhà / Chủ</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{buildingCode} / {ownerTitle}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Người chi</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{expense.paidByOwner?.name || expense.paidByName || "-"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Danh mục</span>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryBadgeStyles[categoryKey] || categoryBadgeStyles.OTHER}`}>
                            {categoryLabels[categoryKey] || categoryKey}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Số tiền</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatMoney(Number(expense.amount))}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[11px] text-muted-foreground font-medium">Nhấp để xem chi tiết</span>
                        {renderActions(expense)}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* PAGINATION FOOTER */}
            {filtered.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border/60 text-xs text-muted-foreground">
                <div>
                  Hiển thị 1 - {visibleRows.length} của {filtered.length} chi phí
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page <= 1}
                      onClick={() => setPage((v) => Math.max(1, v - 1))}
                      className="h-8 w-8 rounded-lg border-border/70"
                    >
                      <ChevronLeft size={14} />
                    </Button>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs"
                    >
                      {page}
                    </button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page >= totalPages}
                      onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
                      className="h-8 w-8 rounded-lg border-border/70"
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* CONFIRM ACTION MODAL */}
      <Modal
        isOpen={!!pendingAction}
        onClose={() => (busyId ? undefined : setPendingAction(null))}
        title={
          <ModalHeaderTitle
            icon={pendingAction?.tone === "danger" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            title={pendingAction?.title || "Xác nhận"}
            tone={pendingAction?.tone === "danger" ? "rose" : pendingAction?.tone === "warning" ? "amber" : "emerald"}
          />
        }
        maxWidth="max-w-xl"
        zIndex={10060}
        testId="expense-confirm-modal"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setPendingAction(null)} disabled={!!busyId} data-testid="expense-confirm-cancel" className="rounded-xl">
              Hủy
            </Button>
            <Button
              variant={pendingAction?.variant === "danger" ? "danger" : "primary"}
              onClick={executeAction}
              isLoading={!!busyId}
              data-testid="expense-confirm-submit"
              className="rounded-xl"
            >
              {pendingAction?.confirmLabel || "Xác nhận"}
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3">
          <div className="text-xs text-muted-foreground">{pendingAction?.description}</div>
          {pendingAction?.expense && (
            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/20 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block">Mã chi phí</span>
                <span className="font-mono font-bold text-text">{pendingAction.expense.code}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Số tiền</span>
                <span className="font-mono font-bold text-indigo-600">{formatMoney(Number(pendingAction.expense.amount))}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-muted-foreground block">Nội dung</span>
                <span className="font-semibold text-text">{getExpenseName(pendingAction.expense)}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* DETAIL MODAL (Mockup 3 with Real Data) */}
      <ExpenseDetailModal
        isOpen={!!selectedDetailExpense}
        onClose={() => setSelectedDetailExpense(null)}
        expense={selectedDetailExpense}
        onApprove={(exp) => openAction("approve", exp)}
        onPay={(exp) => openAction("pay", exp)}
        onCancel={(exp) => openAction("cancel", exp)}
        onReimburse={(exp) => openAction("reimburse", exp)}
        onDeduct={(exp) => openAction("deduct", exp)}
        canApprove={permissions.canApproveExpense}
        canPay={permissions.canPayExpense}
      />
    </>
  );
}

function ActionMenuButton({
  icon,
  label,
  onClick,
  highlight,
  danger,
  dataTestId,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
  danger?: boolean;
  dataTestId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={dataTestId}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors ${
        danger
          ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          : highlight
          ? "text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
