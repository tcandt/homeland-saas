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

const toneClasses: Record<KpiTone, string> = {
  primary: "bg-primary/10 text-primary ring-primary/15",
  success: "bg-success/10 text-success ring-success/15",
  slate: "bg-surface text-muted ring-border",
  warning: "bg-warning/10 text-warning ring-warning/15",
  danger: "bg-danger/10 text-danger ring-danger/15",
  info: "bg-info/10 text-info ring-info/15",
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
      <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid min-w-[1050px] grid-cols-6 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            const unavailable = item.value === emptyValue;

            return (
              <article
                key={item.label}
                title={unavailable ? emptyHint : undefined}
                className="flex h-[86px] min-w-0 items-start gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-[0_12px_30px_rgb(var(--shadow-color)/0.055)] transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-[0_16px_34px_rgb(var(--shadow-color)/0.085)] motion-reduce:transition-none"
              >
                <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ring-1", toneClasses[item.tone])}>
                  <Icon size={17} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[12px] font-bold leading-4 text-muted" title={item.label}>
                    {item.label}
                  </h2>
                  <strong className="mt-1 block truncate whitespace-nowrap text-[20px] font-black leading-6 tracking-tight tabular-nums text-text" title={item.value}>
                    {item.value}
                  </strong>
                  <p className="truncate text-[12px] font-semibold leading-4 text-muted/90" title={item.hint}>
                    {item.hint}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
