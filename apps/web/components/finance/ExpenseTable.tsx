"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CheckCircle2, CircleDollarSign, ReceiptText, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { financeApi } from "@/lib/api/finance.api";
import { financeKeys, useExpensesQuery } from "@/lib/queries/finance.queries";

const statusOptions = [
  { value: "", label: "Tat ca trang thai" },
  { value: "DRAFT", label: "Nhap" },
  { value: "PENDING", label: "Cho duyet" },
  { value: "APPROVED", label: "Da duyet" },
  { value: "PAID", label: "Da chi" },
  { value: "CANCELLED", label: "Da huy" },
];

const categoryOptions = [
  { value: "", label: "Tat ca loai chi" },
  { value: "SUPPLIES", label: "Vat tu / dung cu" },
  { value: "REPAIR", label: "Sua chua" },
  { value: "MAINTENANCE", label: "Bao tri" },
  { value: "UTILITY", label: "Dien nuoc chung" },
  { value: "CLEANING", label: "Ve sinh" },
  { value: "REFUND", label: "Hoan tien khach" },
  { value: "STAFF", label: "Nhan su" },
  { value: "OTHER", label: "Khac" },
];

const statusVariant: Record<string, "success" | "warning" | "error" | "neutral" | "primary"> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "primary",
  PAID: "success",
  CANCELLED: "error",
};

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} d`;

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("vi-VN");
};

export default function ExpenseTable() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const queryParams = useMemo(() => ({
    ...(status ? { status } : {}),
  }), [status]);

  const { data, isLoading, isError, refetch } = useExpensesQuery(queryParams);
  const expenses = Array.isArray(data) ? data : [];

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
        expense.costCenter?.code,
        expense.costCenter?.name,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [expenses, category, search]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: financeKeys.expenses(queryParams) }),
      queryClient.invalidateQueries({ queryKey: financeKeys.ownerProfitSummary() }),
      queryClient.invalidateQueries({ queryKey: financeKeys.ledger(undefined) }),
    ]);
  };

  const approve = async (expense: any, markPaid: boolean) => {
    const message = markPaid
      ? `Danh dau da chi cho ${expense.code}?`
      : `Duyet chi phi ${expense.code}?`;
    if (!window.confirm(message)) return;

    setBusyId(expense.id);
    try {
      await financeApi.approveExpense(expense.id, { markPaid });
      toast.success(markPaid ? "Da danh dau da chi" : "Da duyet chi phi");
      await invalidate();
    } catch (error: any) {
      toast.error(error?.message || "Khong cap nhat duoc chi phi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-card border border-border rounded-[16px] overflow-hidden shadow-sm">
      <div className="p-[16px] md:p-[20px] border-b border-border flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText size={18} className="text-[#8b5cf6]" />
              <h2 className="font-black text-[16px] md:text-[18px] text-text">Chi phi phat sinh</h2>
            </div>
            <p className="text-[12px] md:text-[13px] text-muted mt-1">
              Theo doi vat tu, sua chua, hoan tien va cac khoan nguoi khac ung ho de khau tru khi chia loi nhuan.
            </p>
          </div>
          <div className="rounded-xl bg-muted/20 border border-border px-3 py-2 text-right">
            <div className="text-[10px] font-black uppercase text-muted">Ban ghi</div>
            <div className="text-[18px] font-black text-text">{filtered.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tim ma chi phi, nguoi chi, nha cung cap..."
              className="pl-9"
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} />
          <Select value={category} onChange={(event) => setCategory(event.target.value)} options={categoryOptions} />
        </div>
      </div>

      {isLoading && (
        <div className="p-8 text-center text-[13px] font-semibold text-muted">Dang tai chi phi...</div>
      )}

      {isError && (
        <div className="p-8 text-center">
          <div className="text-[13px] font-semibold text-rose-500">Khong tai duoc danh sach chi phi.</div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Thu lai
          </Button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="p-8 text-center text-[13px] font-semibold text-muted">
          Chua co chi phi phu hop bo loc.
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-surface border-b border-border text-[11px] uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-black">Ngay</th>
                <th className="px-4 py-3 font-black">Chi phi</th>
                <th className="px-4 py-3 font-black">Chu / Toa</th>
                <th className="px-4 py-3 font-black">Nguoi chi</th>
                <th className="px-4 py-3 font-black text-right">So tien</th>
                <th className="px-4 py-3 font-black">Trang thai</th>
                <th className="px-4 py-3 font-black text-right">Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((expense: any) => (
                <tr key={expense.id} className="border-b border-border/70 hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3 text-[13px] font-semibold text-muted">
                    {formatDate(expense.date || expense.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-black text-text">{expense.code}</div>
                    <div className="text-[12px] text-muted line-clamp-1">{expense.description || "-"}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="neutral">{expense.category || "OTHER"}</Badge>
                      {expense.vendor && <Badge variant="neutral">{expense.vendor}</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-text">{expense.owner?.name || "Chua gan owner"}</div>
                    <div className="text-[12px] text-muted">{expense.costCenter?.code || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-text">{expense.paidByOwner?.name || expense.paidByName || "-"}</div>
                    <div className="text-[12px] text-muted">{expense.settlementStatus || "NONE"}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-text">
                    {formatMoney(Number(expense.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[expense.status] || "neutral"}>{expense.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {expense.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={busyId === expense.id}
                          onClick={() => approve(expense, false)}
                        >
                          <CheckCircle2 size={14} className="mr-1" /> Duyet
                        </Button>
                      )}
                      {expense.status !== "PAID" && expense.status !== "CANCELLED" && (
                        <Button
                          size="sm"
                          variant="primary"
                          isLoading={busyId === expense.id}
                          onClick={() => approve(expense, true)}
                        >
                          <CircleDollarSign size={14} className="mr-1" /> Da chi
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
