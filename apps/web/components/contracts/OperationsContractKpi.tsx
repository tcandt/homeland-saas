"use client";

import React, { useMemo } from "react";
import { FileText, CheckCircle2, CalendarClock, AlertTriangle } from "lucide-react";
import { Card } from "../ui/Card";
import { useContractsQuery } from "@/lib/queries/contracts.queries";

export default function OperationsContractKpi() {
  const { data } = useContractsQuery({ limit: 100 });
  const contracts = (data as any)?.data || (data as any)?.items || [];

  const summary = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((c: any) => c.status === "ACTIVE" || c.status === "APPROVED").length;

    const expiring = contracts.filter((c: any) => {
      if (c.status === "EXPIRING") return true;
      if (!c.endDate || c.status !== "ACTIVE") return false;
      const daysLeft = (new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysLeft >= 0 && daysLeft <= 30;
    }).length;

    const pending = contracts.filter((c: any) => ["DRAFT", "PENDING_APPROVAL"].includes(c.status)).length;
    const debt = contracts.filter((c: any) => Number(c.debt || 0) > 0 && c.status !== "TERMINATED").length;

    return { total, active, expiring, pending, debt };
  }, [contracts]);

  return (
    <div data-testid="contracts-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
      <KpiCard
        title="Tổng hợp đồng"
        value={summary.total.toString()}
        trend={summary.active > 0 ? `${summary.active} đang hiệu lực` : undefined}
        trendPositive={true}
        icon={<FileText size={16} className="text-indigo-600 dark:text-indigo-400" />}
        iconBg="bg-indigo-500/10 border border-indigo-500/20"
      />
      <KpiCard
        title="Đang hiệu lực"
        value={summary.active.toString()}
        trend={summary.pending > 0 ? `${summary.pending} chờ ký/duyệt` : "Hoạt động tốt"}
        icon={<CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />}
        iconBg="bg-emerald-500/10 border border-emerald-500/20"
      />
      <KpiCard
        title="Sắp hết hạn HĐ"
        value={summary.expiring.toString()}
        trend={summary.expiring > 0 ? "Cần xử lý tái ký" : "Ổn định"}
        highlight={summary.expiring > 0}
        highlightColor="text-amber-600 dark:text-amber-400"
        icon={<CalendarClock size={16} className="text-amber-600 dark:text-amber-400" />}
        iconBg="bg-amber-500/10 border border-amber-500/20"
      />
      <KpiCard
        title="Có công nợ"
        value={summary.debt.toString()}
        trend={summary.debt > 0 ? "Cần thu hồi nợ" : "Đã thanh toán đủ"}
        highlight={summary.debt > 0}
        highlightColor="text-rose-600 dark:text-rose-400"
        icon={<AlertTriangle size={16} className={summary.debt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"} />}
        iconBg={summary.debt > 0 ? "bg-rose-500/10 border border-rose-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  trend,
  trendPositive,
  icon,
  iconBg,
  highlight,
  highlightColor,
}: any) {
  return (
    <Card
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 md:px-3.5 md:py-2.5 shadow-sm transition-all hover:border-primary/30 ${
        highlight
          ? "border-amber-500/30 dark:border-amber-500/20 bg-amber-500/[0.02]"
          : "border-border/60 bg-card"
      }`}
    >
      <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider truncate leading-tight mb-0.5">
          {title}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-black text-lg md:text-xl text-text leading-none">
            {value}
          </span>
          {trend && (
            <span
              className={`text-[10px] md:text-[11px] font-semibold truncate ${
                trendPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : highlight
                  ? highlightColor || "text-amber-600 dark:text-amber-400"
                  : "text-muted"
              }`}
            >
              {trend}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
