"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, CircleDollarSign, FilterX, Paperclip, ReceiptText, RotateCcw, Search, Split, XCircle } from "lucide-react";
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

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "DRAFT", label: "Nháp" },
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
  return date.toLocaleDateString("vi-VN");
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

export default function ExpenseTable() {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const { data: buildings = [] } = useBuildingsQuery({ limit: 100 });
  const { data: ownerSummary = [] } = useOwnerProfitSummaryQuery();

  const currentYear = String(new Date().getFullYear());
  const [ownerId, setOwnerId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const renderActions = (expense: any) => (
    <div className="flex flex-wrap justify-end gap-2">
      {permissions.canApproveExpense && expense.status === "PENDING" && (
        <Button size="sm" variant="outline" isLoading={busyId === expense.id} onClick={() => openAction("approve", expense)} data-testid={`expense-approve-${expense.id}`}>
          <CheckCircle2 size={14} className="mr-1" /> Duyệt
        </Button>
      )}
      {permissions.canPayExpense && expense.status !== "PAID" && expense.status !== "CANCELLED" && (
        <Button size="sm" variant="primary" isLoading={busyId === expense.id} onClick={() => openAction("pay", expense)} data-testid={`expense-pay-${expense.id}`}>
          <CircleDollarSign size={14} className="mr-1" /> Đã chi
        </Button>
      )}
      {permissions.canSettleExpense && expense.settlementStatus === "PENDING_REIMBURSEMENT" && expense.status !== "CANCELLED" && (
        <>
          <Button size="sm" variant="outline" isLoading={busyId === expense.id} onClick={() => openAction("reimburse", expense)} data-testid={`expense-reimburse-${expense.id}`}>
            <RotateCcw size={14} className="mr-1" /> Hoàn ứng
          </Button>
          <Button size="sm" variant="outline" isLoading={busyId === expense.id} onClick={() => openAction("deduct", expense)} data-testid={`expense-deduct-${expense.id}`}>
            <Split size={14} className="mr-1" /> Khấu trừ
          </Button>
        </>
      )}
      {permissions.canApproveExpense && expense.status !== "PAID" && expense.status !== "CANCELLED" && (
        <Button
          size="sm"
          variant="outline"
          isLoading={busyId === expense.id}
          onClick={() => openAction("cancel", expense)}
          className="text-rose-600 hover:text-rose-700"
          data-testid={`expense-cancel-${expense.id}`}
        >
          <XCircle size={14} className="mr-1" /> Hủy
        </Button>
      )}
    </div>
  );

  return (
    <>
      <section data-testid="expense-table-root" className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border bg-card p-[14px] md:p-[18px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ReceiptText size={18} className="text-[#8b5cf6]" />
                <h2 className="text-[16px] font-black text-text md:text-[18px]">Chi phí phát sinh</h2>
              </div>
              <p className="mt-1 max-w-[760px] text-[12px] leading-5 text-muted md:text-[13px]">
                Theo dõi vật tư, sửa chữa, hoàn tiền và các khoản người khác ứng hộ để khấu trừ khi chia lợi nhuận.
              </p>
            </div>
            <div className="rounded-[12px] border border-border bg-surface px-3 py-2 text-right">
              <div className="text-[10px] font-black uppercase text-muted">Bản ghi</div>
              <div className="text-[18px] font-black text-text">{filtered.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-[12px] border border-border/70 bg-surface/60 p-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_150px_150px_120px_130px_150px_160px_auto]">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm mã chi phí, phòng, người chi, nhà cung cấp..."
                className="pl-9"
              />
            </div>
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
            <Select value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
            <Select value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} />
            <Select aria-label="Lọc chi phí theo loại chi" value={category} onChange={(event) => setCategory(event.target.value)} options={categoryOptions} />
            <Button variant="outline" onClick={resetFilters} className="h-10 px-3" aria-label="Xóa bộ lọc" data-testid="expense-table-reset-filters">
              <FilterX size={15} />
            </Button>
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

                  {permissions.canReadExpenseAttachment && Array.isArray(expense.attachmentUrls) && expense.attachmentUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {expense.attachmentUrls.slice(0, 3).map((url: string, index: number) => (
                        <a
                          key={`${expense.id}-attachment-card-${index}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 text-[11px] font-bold text-muted hover:text-[#8b5cf6]"
                        >
                          <Paperclip size={11} /> Chứng từ {index + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 border-t border-border pt-3">{renderActions(expense)}</div>
                </article>
              ))}
            </div>

            <div className="hidden max-h-[calc(100dvh-420px)] min-h-[260px] overflow-auto xl:block">
              <table data-testid="expense-table-desktop" className="w-full min-w-[1120px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-surface text-[11px] uppercase text-muted shadow-[0_1px_0_var(--border)]">
                  <tr>
                    <th className="px-4 py-3 font-black">Ngày</th>
                    <th className="px-4 py-3 font-black">Chi phí</th>
                    <th className="px-4 py-3 font-black">Chủ / tòa</th>
                    <th className="px-4 py-3 font-black">Phòng</th>
                    <th className="px-4 py-3 font-black">Người chi</th>
                    <th className="px-4 py-3 text-right font-black">Số tiền</th>
                    <th className="px-4 py-3 font-black">Trạng thái</th>
                    <th className="px-4 py-3 text-right font-black">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((expense: any) => (
                    <tr key={expense.id} className="border-b border-border/70 hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-[13px] font-semibold text-muted">{formatDate(expense.date || expense.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="font-black text-text">{expense.code}</div>
                        <div className="line-clamp-1 text-[12px] text-muted">{expense.description || "-"}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="neutral">{categoryLabels[expense.category] || expense.category || "Khác"}</Badge>
                          {expense.vendor && <Badge variant="neutral">{expense.vendor}</Badge>}
                        </div>
                        {permissions.canReadExpenseAttachment && Array.isArray(expense.attachmentUrls) && expense.attachmentUrls.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {expense.attachmentUrls.slice(0, 2).map((url: string, index: number) => (
                              <a
                                key={`${expense.id}-attachment-${index}`}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 text-[11px] font-bold text-muted hover:text-[#8b5cf6]"
                              >
                                <Paperclip size={11} /> Chứng từ {index + 1}
                              </a>
                            ))}
                            {expense.attachmentUrls.length > 2 && (
                              <span className="rounded-full bg-surface px-2 py-1 text-[11px] font-bold text-muted">+{expense.attachmentUrls.length - 2}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-text">{expense.owner?.name || "Chưa gắn chủ"}</div>
                        <div className="text-[12px] text-muted">{expense.building?.code || expense.costCenter?.code || "-"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-text">{expense.room?.code || "-"}</div>
                        <div className="text-[12px] text-muted">{expense.room?.name || "Chi phí theo tòa"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-text">{expense.paidByOwner?.name || expense.paidByName || "-"}</div>
                        <div className="text-[12px] text-muted">{settlementLabels[expense.settlementStatus] || expense.settlementStatus || "Không hoàn ứng"}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-text">{formatMoney(Number(expense.amount))}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[expense.status] || "neutral"}>{statusLabels[expense.status] || expense.status}</Badge>
                      </td>
                      <td className="px-4 py-3">{renderActions(expense)}</td>
                    </tr>
                  ))}
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
        maxWidth="max-w-lg"
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
            <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="font-black uppercase text-muted">Mã chi phí</div>
                <div className="mt-1 font-black text-text">{pendingAction.expense.code}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="font-black uppercase text-muted">Số tiền</div>
                <div className="mt-1 font-black text-text">{formatMoney(Number(pendingAction.expense.amount))}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="font-black uppercase text-muted">Chủ / tòa</div>
                <div className="mt-1 font-black text-text">{pendingAction.expense.owner?.name || "Chưa gắn chủ"}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-muted">{pendingAction.expense.building?.code || pendingAction.expense.costCenter?.code || "-"}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="font-black uppercase text-muted">Trạng thái hiện tại</div>
                <div className="mt-1 font-black text-text">{statusLabels[pendingAction.expense.status] || pendingAction.expense.status}</div>
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
