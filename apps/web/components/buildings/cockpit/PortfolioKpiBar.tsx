import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  FileWarning,
  Users,
} from "lucide-react";
import type { CockpitBuildingSpec } from "./building-cockpit.types";
import { formatVnd, getBuildingMetrics } from "./building-cockpit-metrics";

export interface PortfolioKpiBarProps {
  buildings: readonly CockpitBuildingSpec[];
  revenueLabel?: string;
  className?: string;
}

type KpiTone = "primary" | "success" | "slate" | "warning" | "danger" | "info";

interface KpiItem {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: KpiTone;
}

const toneStyles: Record<KpiTone, { iconBg: string; text: string }> = {
  primary: {
    iconBg: "bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 shadow-sm",
    text: "text-primary",
  },
  success: {
    iconBg: "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  slate: {
    iconBg: "bg-gradient-to-br from-slate-500/20 to-slate-500/5 text-slate-700 dark:text-slate-300 border border-slate-500/20 shadow-sm",
    text: "text-slate-700 dark:text-slate-300",
  },
  warning: {
    iconBg: "bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm",
    text: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    iconBg: "bg-gradient-to-br from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-sm",
    text: "text-rose-600 dark:text-rose-400",
  },
  info: {
    iconBg: "bg-gradient-to-br from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-sm",
    text: "text-sky-600 dark:text-sky-400",
  },
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export default function PortfolioKpiBar({
  buildings,
  revenueLabel = "Doanh thu tháng",
  className,
}: PortfolioKpiBarProps) {
  const configuredMetrics = buildings
    .filter((building) => building.layoutStatus === "configured")
    .map(getBuildingMetrics);

  const totals = configuredMetrics.reduce(
    (aggregate, metrics) => ({
      totalRooms: aggregate.totalRooms + metrics.totalRooms,
      occupiedRooms: aggregate.occupiedRooms + metrics.occupiedRooms,
      vacantRooms: aggregate.vacantRooms + metrics.vacantRooms,
      monthlyRevenue: aggregate.monthlyRevenue + metrics.monthlyRevenue,
      expiringContracts: aggregate.expiringContracts + metrics.expiringContracts,
      overduePayments: aggregate.overduePayments + metrics.overduePayments,
      incompleteTemporaryResidence:
        aggregate.incompleteTemporaryResidence + metrics.incompleteTemporaryResidence,
    }),
    {
      totalRooms: 0,
      occupiedRooms: 0,
      vacantRooms: 0,
      monthlyRevenue: 0,
      expiringContracts: 0,
      overduePayments: 0,
      incompleteTemporaryResidence: 0,
    },
  );

  const hasData = totals.totalRooms > 0;
  const emptyValue = "—";
  const emptyHint = "Chưa có dữ liệu";
  const items: KpiItem[] = [
    {
      label: revenueLabel,
      value: hasData ? formatVnd(totals.monthlyRevenue) : emptyValue,
      hint: hasData
        ? totals.monthlyRevenue > 0
          ? "Tổng doanh thu đã ghi nhận"
          : "Chưa ghi nhận doanh thu"
        : emptyHint,
      icon: DollarSign,
      tone: "primary",
    },
    {
      label: "Phòng đã thuê",
      value: hasData ? `${totals.occupiedRooms} / ${totals.totalRooms}` : emptyValue,
      hint: hasData ? `${percentage(totals.occupiedRooms, totals.totalRooms)}% công suất` : emptyHint,
      icon: ClipboardCheck,
      tone: "success",
    },
    {
      label: "Phòng trống",
      value: hasData ? `${totals.vacantRooms} / ${totals.totalRooms}` : emptyValue,
      hint: hasData ? `${percentage(totals.vacantRooms, totals.totalRooms)}% còn trống` : emptyHint,
      icon: Users,
      tone: "slate",
    },
    {
      label: "HĐ sắp hết hạn (30 ngày)",
      value: hasData ? String(totals.expiringContracts) : emptyValue,
      hint: hasData
        ? `${percentage(totals.expiringContracts, totals.occupiedRooms)}% phòng đang thuê`
        : emptyHint,
      icon: CalendarDays,
      tone: "warning",
    },
    {
      label: "Thanh toán quá hạn",
      value: hasData ? String(totals.overduePayments) : emptyValue,
      hint: hasData
        ? totals.overduePayments > 0
          ? `${totals.overduePayments} khoản cần xử lý`
          : "Không có khoản quá hạn"
        : emptyHint,
      icon: AlertCircle,
      tone: "danger",
    },
    {
      label: "Tạm trú chưa hoàn thiện",
      value: hasData ? String(totals.incompleteTemporaryResidence) : emptyValue,
      hint: hasData
        ? `${percentage(totals.incompleteTemporaryResidence, totals.occupiedRooms)}% phòng có người`
        : emptyHint,
      icon: FileWarning,
      tone: "info",
    },
  ];

  return (
    <section aria-label="KPI toàn danh mục tòa nhà" className={cx("min-w-0", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          const unavailable = item.value === emptyValue;
          const style = toneStyles[item.tone];

          return (
            <article
              key={item.label}
              title={unavailable ? emptyHint : undefined}
              className="group flex h-[76px] min-w-0 items-center gap-2.5 rounded-2xl border border-border/30 dark:border-white/5 bg-card/90 backdrop-blur-sm px-3 py-2.5 shadow-sm transition-all duration-300 hover:border-primary/30 hover:bg-card hover:shadow-md select-none"
            >
              <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105", style.iconBg)}>
                <Icon size={16} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[10px] font-extrabold uppercase tracking-wider text-muted" title={item.label}>
                  {item.label}
                </h2>
                <strong className="block truncate whitespace-nowrap text-[16px] font-black tracking-tight tabular-nums text-text mt-0.5" title={item.value}>
                  {item.value}
                </strong>
                <p className="truncate text-[10px] font-semibold text-muted-foreground" title={item.hint}>
                  {item.hint}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
