"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Clock3, Plus, Tags, Wallet } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import ExpenseCreateModal from "@/components/finance/ExpenseCreateModal";
import ExpenseTable from "@/components/finance/ExpenseTable";
import { Button } from "@/components/ui/Button";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useExpensesQuery } from "@/lib/queries/finance.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

function buildYearRange(year: number) {
  return {
    startDate: new Date(year, 0, 1).toISOString(),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999).toISOString(),
  };
}

export default function FinanceExpensesPage() {
  const permissions = usePermissions();
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const { data } = useExpensesQuery(buildYearRange(currentYear));
  const expenses = Array.isArray(data) ? data : [];

  const summary = useMemo(() => {
    return expenses.reduce(
      (acc, expense: any) => {
        const amount = Number(expense.amount || 0);
        acc.total += amount;
        if (expense.status === "PENDING") acc.pending += 1;
        if (expense.status === "APPROVED") acc.approved += amount;
        if (expense.status === "PAID") acc.paid += amount;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, paid: 0 },
    );
  }, [expenses]);

  return (
    <AppShell>
      <div data-testid="finance-expenses-root" className="flex min-h-full w-full flex-col gap-[16px] md:gap-[20px]">
        <div className="sticky top-[87px] z-40 -mx-[16px] -mt-[16px] border-b border-border/70 bg-background/95 px-[16px] py-[12px] shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:top-[80px]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
              <ExpenseStatCard icon={Wallet} label="Tổng chi phí năm" value={formatVnd(summary.total)} tone="text-rose-500 bg-rose-500/10" />
              <ExpenseStatCard icon={Clock3} label="Chờ duyệt" value={`${summary.pending} khoản`} tone="text-amber-600 bg-amber-500/10" />
              <ExpenseStatCard icon={CheckCircle2} label="Đã duyệt" value={formatVnd(summary.approved)} tone="text-[#6366f1] bg-[#6366f1]/10" />
              <ExpenseStatCard icon={CircleDollarSign} label="Đã chi" value={formatVnd(summary.paid)} tone="text-[#059669] bg-emerald-500/10" />
            </div>
            {permissions.canCreateExpense && (
              <Button
                onClick={() => setExpenseModalOpen(true)}
                className="h-[42px] shrink-0 bg-[#8b5cf6] px-[18px] text-white shadow-[#8b5cf6]/20 hover:bg-[#6366f1] xl:self-stretch"
              >
                <Plus size={16} className="mr-1.5" />
                Thêm chi phí
              </Button>
            )}
          </div>
        </div>

        <section className="grid grid-cols-1 gap-3 text-[12px] font-semibold leading-5 text-muted lg:grid-cols-3">
          <ExpenseGuideItem title="Phân loại" body="Điện nước, sửa chữa, bảo trì, vệ sinh, nhân sự, hoàn tiền và chi phí khác." />
          <ExpenseGuideItem title="Gắn chi phí" body="Theo owner, tòa, phòng hoặc cost center để chia lợi nhuận chính xác." />
          <ExpenseGuideItem title="Quy trình" body="Nháp, chờ duyệt, đã duyệt, đã chi, đã hủy và hoàn ứng/khấu trừ." />
        </section>

        <ExpenseTable />
      </div>

      <ExpenseCreateModal isOpen={isExpenseModalOpen} onClose={() => setExpenseModalOpen(false)} />
    </AppShell>
  );
}

function ExpenseStatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase tracking-wide text-muted">{label}</div>
          <div className="mt-2 truncate text-[18px] font-black leading-none text-text">{value}</div>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${tone}`}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

function ExpenseGuideItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[56px] items-start gap-3 rounded-[12px] border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[#8b5cf6]/10 text-[#8b5cf6]">
        <Tags size={14} />
      </div>
      <div>
        <span className="font-black text-text">{title}:</span> {body}
      </div>
    </div>
  );
}
