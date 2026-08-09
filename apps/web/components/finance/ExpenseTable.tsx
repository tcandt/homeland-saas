"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CheckCircle2, CircleDollarSign, FilterX, ReceiptText, RotateCcw, Search, Split, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { financeApi } from "@/lib/api/finance.api";
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

  const queryParams = useMemo(() => ({
    ...buildMonthRange(year, month),
    ...(ownerId ? { ownerId } : {}),
    ...(buildingId ? { buildingId } : {}),
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
  }), [buildingId, category, month, ownerId, status, year]);

  const { data, isLoading, isError, refetch } = useExpensesQuery(queryParams);
  const expenses = Array.isArray(data) ? data : [];

  const ownerOptions = useMemo(() => [
    { value: "", label: "Tất cả chủ" },
    ...(Array.isArray(ownerSummary) ? ownerSummary : []).map((row: any) => ({
      value: row.owner?.id,
      label: row.owner?.name || row.owner?.code || "Chủ sở hữu",
    })).filter((item: any) => item.value),
  ], [ownerSummary]);

  const buildingOptions = useMemo(() => [
    { value: "", label: "Tất cả tòa" },
    ...(buildings as any[])
      .filter((building) => {
        if (!ownerId) return true;
        const matchedOwner = (Array.isArray(ownerSummary) ? ownerSummary : []).find((row: any) => row.owner?.id === ownerId);
        return (matchedOwner?.buildings || []).some((ownerBuilding: any) => ownerBuilding.id === building.id);
      })
      .map((building) => ({ value: building.id, label: building.code || building.name })),
  ], [buildings, ownerId, ownerSummary]);

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
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [expenses, search]);

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
        await financeApi.approveExpense(expense.id, { markPaid: true });
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
      },
      pay: {
        title: "Đánh dấu đã chi",
        description: `Xác nhận ${code} đã được chi tiền. Nếu có cấu hình tài khoản kế toán, hệ thống sẽ tạo bút toán chi phí.`,
        confirmLabel: "Đã chi",
      },
      cancel: {
        title: "Hủy chi phí",
        description: `Hủy ${code}. Chỉ áp dụng cho khoản chưa ghi sổ đã chi; khoản đã chi cần bút toán đảo thay vì hủy trực tiếp.`,
        confirmLabel: "Hủy chi phí",
        variant: "danger",
      },
      reimburse: {
        title: "Đánh dấu đã hoàn ứng",
        description: `Xác nhận khoản ứng hộ của ${code} đã được hoàn lại cho người chi.`,
        confirmLabel: "Đã hoàn ứng",
      },
      deduct: {
        title: "Khấu trừ vào lợi nhuận",
        description: `Đánh dấu ${code} sẽ được khấu trừ khi chia lợi nhuận giữa các chủ.`,
        confirmLabel: "Khấu trừ",
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

  return (
    <>
    <section className="bg-card border border-border rounded-[16px] overflow-hidden shadow-sm">
      <div className="p-[16px] md:p-[20px] border-b border-border flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText size={18} className="text-[#8b5cf6]" />
              <h2 className="font-black text-[16px] md:text-[18px] text-text">Chi phí phát sinh</h2>
            </div>
            <p className="text-[12px] md:text-[13px] text-muted mt-1">
              Theo dõi vật tư, sửa chữa, hoàn tiền và các khoản người khác ứng hộ để khấu trừ khi chia lợi nhuận.
            </p>
          </div>
          <div className="rounded-xl bg-muted/20 border border-border px-3 py-2 text-right">
            <div className="text-[10px] font-black uppercase text-muted">Bản ghi</div>
            <div className="text-[18px] font-black text-text">{filtered.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_150px_150px_140px_140px_140px_140px_auto] gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã chi phí, phòng, người chi, nhà cung cấp..."
              className="pl-9"
            />
          </div>
          <Select value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setBuildingId(""); }} options={ownerOptions} />
          <Select value={buildingId} onChange={(event) => setBuildingId(event.target.value)} options={buildingOptions} />
          <Select value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
          <Select value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} />
          <Select value={category} onChange={(event) => setCategory(event.target.value)} options={categoryOptions} />
          <Button variant="outline" onClick={resetFilters} className="h-10 px-3">
            <FilterX size={15} />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="p-8 text-center text-[13px] font-semibold text-muted">Đang tải chi phí...</div>
      )}

      {isError && (
        <div className="p-8 text-center">
          <div className="text-[13px] font-semibold text-rose-500">Không tải được danh sách chi phí.</div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="p-8 text-center text-[13px] font-semibold text-muted">
          Chưa có chi phí phù hợp bộ lọc.
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-surface border-b border-border text-[11px] uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-black">Ngày</th>
                <th className="px-4 py-3 font-black">Chi phí</th>
                <th className="px-4 py-3 font-black">Chủ / Tòa</th>
                <th className="px-4 py-3 font-black">Phòng</th>
                <th className="px-4 py-3 font-black">Người chi</th>
                <th className="px-4 py-3 font-black text-right">Số tiền</th>
                <th className="px-4 py-3 font-black">Trạng thái</th>
                <th className="px-4 py-3 font-black text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((expense: any) => (
                <tr key={expense.id} className="border-b border-border/70 hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3 text-[13px] font-semibold text-muted">
                    {formatDate(expense.date || expense.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-black text-text">{expense.code}</div>
                    <div className="text-[12px] text-muted line-clamp-1">{expense.description || "-"}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="neutral">{categoryLabels[expense.category] || expense.category || "Khác"}</Badge>
                      {expense.vendor && <Badge variant="neutral">{expense.vendor}</Badge>}
                    </div>
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
                  <td className="px-4 py-3 text-right font-black text-text">
                    {formatMoney(Number(expense.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[expense.status] || "neutral"}>{statusLabels[expense.status] || expense.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {expense.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={busyId === expense.id}
                          onClick={() => openAction("approve", expense)}
                        >
                          <CheckCircle2 size={14} className="mr-1" /> Duyệt
                        </Button>
                      )}
                      {expense.status !== "PAID" && expense.status !== "CANCELLED" && (
                        <Button
                          size="sm"
                          variant="primary"
                          isLoading={busyId === expense.id}
                          onClick={() => openAction("pay", expense)}
                        >
                          <CircleDollarSign size={14} className="mr-1" /> Đã chi
                        </Button>
                      )}
                      {expense.settlementStatus === "PENDING_REIMBURSEMENT" && expense.status !== "CANCELLED" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={busyId === expense.id}
                            onClick={() => openAction("reimburse", expense)}
                          >
                            <RotateCcw size={14} className="mr-1" /> Hoàn ứng
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={busyId === expense.id}
                            onClick={() => openAction("deduct", expense)}
                          >
                            <Split size={14} className="mr-1" /> Khấu trừ
                          </Button>
                        </>
                      )}
                      {expense.status !== "PAID" && expense.status !== "CANCELLED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={busyId === expense.id}
                          onClick={() => openAction("cancel", expense)}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <XCircle size={14} className="mr-1" /> Hủy
                        </Button>
                      )}
                    </div>
                  </td>
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
      title={pendingAction?.title || "Xác nhận"}
      maxWidth="max-w-lg"
      zIndex={10060}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setPendingAction(null)} disabled={!!busyId}>
            Hủy
          </Button>
          <Button
            variant={pendingAction?.variant === "danger" ? "danger" : "primary"}
            onClick={executeAction}
            isLoading={!!busyId}
          >
            {pendingAction?.confirmLabel || "Xác nhận"}
          </Button>
        </div>
      }
    >
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="text-[13px] leading-6 text-muted">{pendingAction?.description}</div>
        {pendingAction?.expense && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            <div className="rounded-xl bg-card p-3">
              <div className="font-black uppercase text-muted">Mã chi phí</div>
              <div className="mt-1 font-black text-text">{pendingAction.expense.code}</div>
            </div>
            <div className="rounded-xl bg-card p-3">
              <div className="font-black uppercase text-muted">Số tiền</div>
              <div className="mt-1 font-black text-text">{formatMoney(Number(pendingAction.expense.amount))}</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
    </>
  );
}
