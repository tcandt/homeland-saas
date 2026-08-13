"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Eye,
  FilterX,
  Image as ImageIcon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Split,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { financeApi } from "@/lib/api/finance.api";
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
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "PAID", label: "Đã chi" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const categoryOptions = [
  { value: "", label: "Tất cả loại chi" },
  { value: "SUPPLIES", label: "Vật tư / dụng cụ" },
  { value: "REPAIR", label: "Sửa chữa" },
  { value: "MAINTENANCE", label: "Bảo trì" },
  { value: "UTILITY", label: "Điện nước chung" },
  { value: "CLEANING", label: "Vệ sinh" },
  { value: "REFUND", label: "Hoàn tiền khách" },
  { value: "STAFF", label: "Nhân sự" },
  { value: "OTHER", label: "Khác" },
];

const statusLabels: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PAID: "Đã chi",
  CANCELLED: "Đã hủy",
};

const settlementLabels: Record<string, string> = {
  NONE: "Không hoàn ứng",
  PENDING_REIMBURSEMENT: "Chờ hoàn ứng",
  REIMBURSED: "Đã hoàn ứng",
  DEDUCTED_FROM_PROFIT: "Đã khấu trừ",
};

const categoryLabels = Object.fromEntries(categoryOptions.filter((item) => item.value).map((item) => [item.value, item.label]));

const statusVariant: Record<string, "success" | "warning" | "error" | "neutral" | "primary"> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "primary",
  PAID: "success",
  CANCELLED: "error",
};

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getExpenseName = (expense: any) => expense.description || expense.vendor || categoryLabels[expense.category] || expense.code || "Chi phí";

const getExpenseLocation = (expense: any) => {
  const parts = [expense.building?.code || expense.costCenter?.code, expense.room?.code].filter(Boolean);
  return parts.join(" / ") || "-";
};

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
};

export default function ExpenseTable({ defaultYear, onCreateExpense }: ExpenseTableProps = {}) {
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
  const [previewBillUrl, setPreviewBillUrl] = useState<string | null>(null);
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
  const expenses = Array.isArray(data) ? data : [];

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
        .filter((building) => {
          if (!ownerId) return true;
          const matchedOwner = (Array.isArray(ownerSummary) ? ownerSummary : []).find((row: any) => row.owner?.id === ownerId);
          return (matchedOwner?.buildings || []).some((ownerBuilding: any) => ownerBuilding.id === building.id);
        })
        .map((building) => ({ value: building.id, label: building.code || building.name })),
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
        expense.room?.name,
        expense.costCenter?.code,
        expense.costCenter?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [category, expenses, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: financeKeys.expenses(queryParams) }),
      queryClient.invalidateQueries({ queryKey: financeKeys.ownerProfitSummary() }),
      queryClient.invalidateQueries({ queryKey: financeKeys.ledger(undefined) }),
    ]);
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    const { expense, type } = pendingAction;
    setBusyId(expense.id);
    try {
      if (type === "approve") {
        await financeApi.approveExpense(expense.id, { markPaid: false });
        toast.success("Đã duyệt chi phí");
      }
      if (type === "pay") {
        await financeApi.payExpense(expense.id);
        toast.success("Đã đánh dấu đã chi");
      }
      if (type === "cancel") {
        await financeApi.cancelExpense(expense.id, { reason: "Hủy từ bảng chi phí" });
        toast.success("Đã hủy chi phí");
      }
      if (type === "reimburse") {
        await financeApi.updateExpenseSettlement(expense.id, { settlementStatus: "REIMBURSED" });
        toast.success("Đã đánh dấu hoàn ứng");
      }
      if (type === "deduct") {
        await financeApi.updateExpenseSettlement(expense.id, { settlementStatus: "DEDUCTED_FROM_PROFIT" });
        toast.success("Đã khấu trừ vào lợi nhuận");
      }
      await invalidate();
    } catch (error: any) {
      toast.error(error?.message || "Không cập nhật được chi phí");
    } finally {
      setBusyId(null);
      setPendingAction(null);
    }
  };

  const uploadBill = async (expense: any, file?: File) => {
    if (!file) return;
    setUploadBusyId(expense.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/expense-bills", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("UPLOAD_FAILED");
      const payload = await response.json();
      const attachmentUrls = [...(Array.isArray(expense.attachmentUrls) ? expense.attachmentUrls : []), payload.url];
      await financeApi.updateExpense(expense.id, { attachmentUrls });
      toast.success("Đã tải bill lên");
      await invalidate();
    } catch (error: any) {
      toast.error(error?.message || "Không tải được bill");
    } finally {
      setUploadBusyId(null);
    }
  };

  const deleteBill = async (expense: any, url: string) => {
    setBusyId(expense.id);
    try {
      const attachmentUrls = (Array.isArray(expense.attachmentUrls) ? expense.attachmentUrls : []).filter((item: string) => item !== url);
      await financeApi.updateExpense(expense.id, { attachmentUrls });
      if (url.startsWith("/api/expense-bills/")) {
        await fetch(url, { method: "DELETE" }).catch(() => undefined);
      }
      toast.success("Đã xóa bill");
      await invalidate();
    } catch (error: any) {
      toast.error(error?.message || "Không xóa được bill");
    } finally {
      setBusyId(null);
      setOpenActionMenuId(null);
    }
  };

  const openAction = (type: ExpenseActionType, expense: any) => {
    const code = expense.code || "chi phí";
    const configs: Record<ExpenseActionType, Omit<PendingAction, "type" | "expense">> = {
      approve: {
        title: "Duyệt chi phí",
        description: `Duyệt ${code} để đưa khoản chi vào quy trình theo dõi lợi nhuận.`,
        confirmLabel: "Duyệt chi phí",
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

  React.useEffect(() => {
    setPage(1);
  }, [queryParams, search]);

  React.useEffect(() => {
    if (defaultYear) {
      setYear(defaultYear);
    }
  }, [defaultYear]);

  const renderActions = (expense: any) => {
    const firstBill = Array.isArray(expense.attachmentUrls) ? expense.attachmentUrls[0] : "";

    return (
    <div className="relative flex justify-end">
      <Button
        size="icon"
        variant="outline"
        aria-label="Mở thao tác"
        className="h-8 w-8 rounded-[10px]"
        onClick={() => setOpenActionMenuId((current) => (current === expense.id ? null : expense.id))}
      >
        <MoreHorizontal size={14} />
      </Button>

      {openActionMenuId === expense.id && (
        <div className="absolute right-0 top-10 z-50 w-[190px] overflow-hidden rounded-[12px] border border-border bg-card p-1.5 text-[12px] font-bold shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
          <ActionMenuButton icon={<Eye size={14} />} label="Xem chi phí" onClick={() => setOpenActionMenuId(null)} />
          <ActionMenuButton icon={<Edit3 size={14} />} label="Sửa chi phí" onClick={() => setOpenActionMenuId(null)} />
          {permissions.canApproveExpense && expense.status === "PENDING" && (
            <ActionMenuButton icon={<CheckCircle2 size={14} />} label="Duyệt" onClick={() => openAction("approve", expense)} dataTestId={`expense-approve-${expense.id}`} />
          )}
          {permissions.canPayExpense && expense.status !== "PAID" && expense.status !== "CANCELLED" && (
            <ActionMenuButton icon={<CircleDollarSign size={14} />} label="Đã chi" onClick={() => openAction("pay", expense)} dataTestId={`expense-pay-${expense.id}`} highlight />
          )}
          {permissions.canSettleExpense && expense.settlementStatus === "PENDING_REIMBURSEMENT" && expense.status !== "CANCELLED" && (
            <>
              <ActionMenuButton icon={<RotateCcw size={14} />} label="Hoàn ứng" onClick={() => openAction("reimburse", expense)} dataTestId={`expense-reimburse-${expense.id}`} />
              <ActionMenuButton icon={<Split size={14} />} label="Khấu trừ" onClick={() => openAction("deduct", expense)} dataTestId={`expense-deduct-${expense.id}`} />
            </>
          )}
          {firstBill && (
            <ActionMenuButton icon={<Trash2 size={14} />} label="Xóa bill" onClick={() => deleteBill(expense, firstBill)} danger />
          )}
          {permissions.canApproveExpense && expense.status !== "PAID" && expense.status !== "CANCELLED" && (
            <ActionMenuButton icon={<XCircle size={14} />} label="Hủy chi phí" onClick={() => openAction("cancel", expense)} dataTestId={`expense-cancel-${expense.id}`} danger />
          )}
        </div>
      )}
    </div>
    );
  };

  return (
    <>
      <section data-testid="expense-table-root" className="overflow-visible rounded-[16px] border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-card p-[14px] md:p-[18px]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value || "all"}
                  type="button"
                  onClick={() => setStatus(tab.value)}
                  className={`h-10 shrink-0 rounded-[12px] px-4 text-[12px] font-black transition-all ${
                    status === tab.value
                      ? "border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#6d3df8] shadow-[0_8px_20px_rgba(109,61,248,0.14)]"
                      : "border border-transparent text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(260px,1fr)_120px_130px_auto_auto] xl:min-w-[860px]">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm chi phí, phòng, người chi, nhà cung cấp..."
                  className="pl-9"
                />
              </div>
              <Select value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
              <Select value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
              <Button variant="outline" onClick={resetFilters} className="h-10 gap-2 px-3" aria-label="Bộ lọc" data-testid="expense-table-reset-filters">
                <FilterX size={15} /> Bộ lọc
              </Button>
              {onCreateExpense && permissions.canCreateExpense && (
                <Button
                  onClick={onCreateExpense}
                  className="h-10 shrink-0 gap-2 bg-[#6d3df8] px-4 text-white shadow-[#6d3df8]/20 hover:bg-[#5b35f5]"
                  data-testid="expense-table-create-button"
                >
                  <Plus size={15} /> Thêm chi phí
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Select
              aria-label="Lọc chi phí theo chủ sở hữu"
              value={ownerId}
              onChange={(event) => {
                setOwnerId(event.target.value);
                setBuildingId("");
              }}
              options={ownerOptions}
            />
            <Select aria-label="Lọc chi phí theo tòa nhà" value={buildingId} onChange={(event) => setBuildingId(event.target.value)} options={buildingOptions} />
            <Select aria-label="Lọc chi phí theo loại chi" value={category} onChange={(event) => setCategory(event.target.value)} options={categoryOptions} />
          </div>
        </div>

        {isLoading && <div className="p-8 text-center text-[13px] font-semibold text-muted">Đang tải chi phí...</div>}

        {isError && (
          <div className="p-8 text-center">
            <div className="text-[13px] font-semibold text-rose-500">Không tải được danh sách chi phí.</div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Thử lại
            </Button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="p-8 text-center text-[13px] font-semibold text-muted">Chưa có chi phí phù hợp bộ lọc.</div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 xl:hidden p-4">
              {visibleRows.map((expense: any) => (
                <article key={`${expense.id}-card`} data-testid={`expense-row-${expense.id}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-black text-text">{expense.code}</div>
                      <div className="mt-1 text-[12px] font-semibold text-muted">{formatDate(expense.date || expense.createdAt)}</div>
                    </div>
                    <Badge variant={statusVariant[expense.status] || "neutral"}>{statusLabels[expense.status] || expense.status}</Badge>
                  </div>

                  <div className="mt-3 text-[13px] font-medium text-text">{expense.description || "Không có mô tả"}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="neutral">{categoryLabels[expense.category] || expense.category || "Khác"}</Badge>
                    {expense.vendor && <Badge variant="neutral">{expense.vendor}</Badge>}
                    <Badge variant="neutral">{settlementLabels[expense.settlementStatus] || expense.settlementStatus || "Không hoàn ứng"}</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-surface p-3 text-[12px]">
                    <InfoCell label="Chủ / tòa" value={`${expense.owner?.name || "Chưa gắn chủ"}${expense.building?.code ? ` / ${expense.building.code}` : ""}`} />
                    <InfoCell label="Phòng" value={expense.room?.code || "Chi phí theo tòa"} />
                    <InfoCell label="Người chi" value={expense.paidByOwner?.name || expense.paidByName || "-"} />
                    <InfoCell label="Số tiền" value={formatMoney(Number(expense.amount))} valueClassName="text-[14px] text-text" />
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-2xl border border-border bg-card p-3">
                    <div>
                      <div className="text-[10px] font-black uppercase text-muted">Bill</div>
                      <div className="mt-1 text-[12px] font-bold text-text">
                        {Array.isArray(expense.attachmentUrls) && expense.attachmentUrls.length > 0 ? `${expense.attachmentUrls.length} hình đã tải` : "Chưa có bill"}
                      </div>
                    </div>
                    <BillCell expense={expense} uploadBusyId={uploadBusyId} onUpload={uploadBill} onPreview={setPreviewBillUrl} />
                  </div>

                  <div className="mt-4 border-t border-border pt-3">{renderActions(expense)}</div>
                </article>
              ))}
            </div>

            <div className="hidden max-h-[calc(100dvh-500px)] min-h-[280px] overflow-auto xl:block">
              <table data-testid="expense-table-desktop" className="w-full min-w-[1180px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-surface text-[11px] uppercase text-muted shadow-[0_1px_0_var(--border)]">
                  <tr>
                    <th className="w-[130px] px-5 py-3 font-black">Ngày</th>
                    <th className="px-5 py-3 font-black">Tên chi phí</th>
                    <th className="w-[150px] px-5 py-3 font-black">Loại chi phí</th>
                    <th className="w-[110px] px-5 py-3 font-black">Bill</th>
                    <th className="px-5 py-3 font-black">Chủ / tòa</th>
                    <th className="px-5 py-3 font-black">Người chi</th>
                    <th className="px-5 py-3 text-right font-black">Số tiền</th>
                    <th className="px-5 py-3 font-black">Trạng thái</th>
                    <th className="px-5 py-3 text-right font-black">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((expense: any) => {
                    return (
                    <tr key={expense.id} className="border-b border-border/70 hover:bg-black/[0.025] dark:hover:bg-white/5">
                      <td className="px-5 py-4 align-middle">
                        <div className="text-[13px] font-black text-text">{formatDate(expense.date || expense.createdAt)}</div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="min-w-0">
                          <div className="line-clamp-1 font-black text-text">{getExpenseName(expense)}</div>
                          <div className="mt-1 text-[12px] font-semibold text-muted">{expense.code}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {expense.vendor && <Badge variant="neutral">{expense.vendor}</Badge>}
                            {expense.room?.code && <Badge variant="neutral">{expense.room.code}</Badge>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <Badge variant="neutral">{categoryLabels[expense.category] || expense.category || "Khác"}</Badge>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <BillCell expense={expense} uploadBusyId={uploadBusyId} onUpload={uploadBill} onPreview={setPreviewBillUrl} />
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="font-bold text-text">{expense.owner?.name || "Chưa gắn chủ"}</div>
                        <div className="text-[12px] text-muted">{expense.building?.code || expense.costCenter?.code || "-"}</div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="font-bold text-text">{expense.paidByOwner?.name || expense.paidByName || "-"}</div>
                        <div className="text-[12px] text-muted">{settlementLabels[expense.settlementStatus] || expense.settlementStatus || "Không hoàn ứng"}</div>
                      </td>
                      <td className="px-5 py-4 text-right align-middle font-black text-text">{formatMoney(Number(expense.amount))}</td>
                      <td className="px-5 py-4 align-middle">
                        <Badge variant={statusVariant[expense.status] || "neutral"}>{statusLabels[expense.status] || expense.status}</Badge>
                      </td>
                      <td className="px-5 py-4 align-middle">{renderActions(expense)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-border p-4 text-[12px] font-semibold text-muted sm:flex-row sm:items-center sm:justify-between">
              <div>
                Hiển thị {visibleRows.length} / {filtered.length} chi phí
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  Trước
                </Button>
                <span className="min-w-16 text-center">Trang {page}/{totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  Sau
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <Modal
        isOpen={!!pendingAction}
        onClose={() => (busyId ? undefined : setPendingAction(null))}
        title={
          <span className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                pendingAction?.tone === "danger"
                  ? "bg-rose-50 text-rose-600"
                  : pendingAction?.tone === "warning"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {pendingAction?.tone === "danger" ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            </span>
            <span>{pendingAction?.title || "Xác nhận"}</span>
          </span>
        }
        maxWidth="max-w-2xl"
        zIndex={10060}
        testId="expense-confirm-modal"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setPendingAction(null)} disabled={!!busyId} data-testid="expense-confirm-cancel">
              Hủy
            </Button>
            <Button variant={pendingAction?.variant === "danger" ? "danger" : "primary"} onClick={executeAction} isLoading={!!busyId} data-testid="expense-confirm-submit">
              {pendingAction?.confirmLabel || "Xác nhận"}
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl border border-border bg-gradient-to-b from-surface to-card p-4 shadow-sm">
          <div className="text-[13px] leading-6 text-muted">{pendingAction?.description}</div>
          {pendingAction?.expense && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {Array.isArray(pendingAction.expense.attachmentUrls) && pendingAction.expense.attachmentUrls[0] ? (
                  <a href={pendingAction.expense.attachmentUrls[0]} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pendingAction.expense.attachmentUrls[0]} alt="Bill chi phí" className="h-[220px] w-full object-contain bg-surface" />
                  </a>
                ) : (
                  <div className="flex h-[220px] flex-col items-center justify-center gap-2 bg-surface text-muted">
                    <ImageIcon size={24} />
                    <span className="text-[12px] font-bold">Chưa có bill</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
                <DetailCell label="Tên chi phí" value={getExpenseName(pendingAction.expense)} className="sm:col-span-2" />
                <DetailCell label="Ngày chi phí" value={formatDate(pendingAction.expense.date || pendingAction.expense.createdAt)} />
                <DetailCell label="Mã chi phí" value={pendingAction.expense.code || "-"} />
                <DetailCell label="Số tiền chi phí" value={formatMoney(Number(pendingAction.expense.amount))} valueClassName="text-[#6d3df8]" />
                <DetailCell label="Tòa chi phí" value={getExpenseLocation(pendingAction.expense)} />
                <DetailCell label="Chủ sở hữu" value={pendingAction.expense.owner?.name || "Chưa gắn chủ"} />
                <DetailCell label="Người chi" value={pendingAction.expense.paidByOwner?.name || pendingAction.expense.paidByName || "-"} />
                <DetailCell label="Loại chi phí" value={categoryLabels[pendingAction.expense.category] || pendingAction.expense.category || "Khác"} />
                <DetailCell label="Trạng thái hiện tại" value={statusLabels[pendingAction.expense.status] || pendingAction.expense.status} />
              </div>
            </div>
          )}
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-[12px] font-bold ${
              pendingAction?.tone === "danger"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : pendingAction?.tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            Thao tác này sẽ được ghi nhận vào lịch sử tài chính để phục vụ đối soát và chia lợi nhuận.
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!previewBillUrl}
        onClose={() => setPreviewBillUrl(null)}
        title="Xem bill"
        maxWidth="max-w-3xl"
        zIndex={10080}
        testId="expense-bill-preview-modal"
      >
        <div className="rounded-2xl border border-border bg-surface p-3">
          {previewBillUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewBillUrl} alt="Bill chi phí" className="max-h-[70vh] w-full rounded-xl object-contain" />
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

function InfoCell({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-black uppercase text-muted">{label}</div>
      <div className={`mt-1 truncate font-bold text-text ${valueClassName || ""}`}>{value}</div>
    </div>
  );
}

function DetailCell({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-3 ${className || ""}`}>
      <div className="font-black uppercase text-muted">{label}</div>
      <div className={`mt-1 break-words font-black text-text ${valueClassName || ""}`}>{value}</div>
    </div>
  );
}

function BillCell({
  expense,
  uploadBusyId,
  onUpload,
  onPreview,
}: {
  expense: any;
  uploadBusyId: string | null;
  onUpload: (expense: any, file?: File) => void;
  onPreview: (url: string) => void;
}) {
  const bills = Array.isArray(expense.attachmentUrls) ? expense.attachmentUrls : [];
  const firstBill = bills[0];
  const inputId = `expense-bill-upload-${expense.id}`;

  return (
    <div className="relative inline-flex">
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          onUpload(expense, file);
          event.currentTarget.value = "";
        }}
      />

      {firstBill ? (
        <div className="group relative">
          <button
            type="button"
            onClick={() => onPreview(firstBill)}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[12px] border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 text-[#6d3df8]"
            aria-label="Xem bill"
            title="Xem bill"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={firstBill} alt="Bill" className="h-full w-full object-cover" />
          </button>
          {bills.length > 1 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6d3df8] px-1 text-[10px] font-black text-white">
              {bills.length}
            </span>
          )}
          <div className="pointer-events-none invisible absolute left-1/2 top-12 z-40 w-[220px] -translate-x-1/2 rounded-[14px] border border-border bg-card p-2 opacity-0 shadow-[0_22px_55px_rgba(15,23,42,0.22)] transition-all group-hover:visible group-hover:opacity-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={firstBill} alt="Bill preview" className="max-h-[260px] w-full rounded-[10px] object-contain" />
            <div className="mt-2 text-center text-[11px] font-bold text-muted">Rê chuột để xem nhanh · bấm để phóng to</div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => document.getElementById(inputId)?.click()}
          disabled={uploadBusyId === expense.id}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-dashed border-border bg-surface text-muted transition-colors hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/10 hover:text-[#6d3df8] disabled:opacity-50"
          aria-label="Tải bill"
        >
          {uploadBusyId === expense.id ? <ImageIcon size={15} className="animate-pulse" /> : <Upload size={15} />}
        </button>
      )}
    </div>
  );
}

function ActionMenuButton({
  icon,
  label,
  onClick,
  dataTestId,
  danger,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  dataTestId?: string;
  danger?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={dataTestId}
      className={`flex w-full items-center gap-2 rounded-[9px] px-3 py-2 text-left transition-colors ${
        danger
          ? "text-rose-600 hover:bg-rose-500/10"
          : highlight
            ? "bg-[#6d3df8] text-white hover:bg-[#5b35f5]"
            : "text-text hover:bg-surface"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
