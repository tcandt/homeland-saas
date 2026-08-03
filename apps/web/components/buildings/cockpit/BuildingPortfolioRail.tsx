"use client";

import { Building2, Check, Plus, Settings2 } from "lucide-react";
import type { CockpitBuildingSpec } from "./building-cockpit.types";
import { getBuildingMetrics } from "./building-cockpit-metrics";
import { buildingTemplateRegistry, normalizeBuildingCode } from "./building-template-registry";

export interface BuildingPortfolioRailProps {
  buildings: readonly CockpitBuildingSpec[];
  activeBuildingCode: string;
  onSelectBuilding: (code: string) => void;
  onConfigureBuilding?: (code: string) => void;
  onAddBuilding?: () => void;
  className?: string;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function BuildingPortfolioRail({
  buildings,
  activeBuildingCode,
  onSelectBuilding,
  onConfigureBuilding,
  onAddBuilding,
  className,
}: BuildingPortfolioRailProps) {
  const buildingsByCode = new Map(
    buildings.map((building) => [normalizeBuildingCode(building.code), building]),
  );
  const normalizedActiveCode = normalizeBuildingCode(activeBuildingCode);

  return (
    <section aria-label="Danh mục tòa nhà" className={cx("min-w-0", className)}>
      <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid min-w-[1050px] grid-cols-[repeat(4,minmax(220px,1fr))_132px] gap-3">
          {buildingTemplateRegistry.map((descriptor) => {
            const building = buildingsByCode.get(descriptor.code);
            const isPending = descriptor.layoutStatus === "pending" || building?.layoutStatus === "pending";
            const isSelected = descriptor.code === normalizedActiveCode;
            const metrics = building && !isPending ? getBuildingMetrics(building) : null;
            const hasMetrics = Boolean(metrics && metrics.totalRooms > 0);
            const statusLabel = isPending
              ? "Chưa cấu hình"
              : building?.statusLabel || "Chưa đồng bộ";

            return (
              <article
                key={descriptor.code}
                className={cx(
                  "relative min-h-[146px] overflow-hidden rounded-2xl border bg-card p-3.5 shadow-[0_10px_28px_rgb(var(--shadow-color)/0.05)] transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none",
                  isSelected
                    ? "border-primary bg-primary/[0.045] shadow-[0_12px_30px_rgb(var(--shadow-color)/0.09)] ring-1 ring-primary/35"
                    : "border-border hover:border-primary/35 hover:shadow-[0_12px_30px_rgb(var(--shadow-color)/0.08)]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectBuilding(descriptor.code)}
                  aria-pressed={isSelected}
                  aria-label={`Chọn tòa nhà ${descriptor.code}, ${statusLabel}`}
                  className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                />

                <div className="pointer-events-none relative z-10">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                      <Building2 size={17} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="shrink-0 whitespace-nowrap text-[15px] font-black tracking-tight text-text">
                          {descriptor.code}
                        </h2>
                        <span
                          className={cx(
                            "min-w-0 truncate rounded-full px-2 py-1 text-[12px] font-bold leading-none",
                            isPending
                              ? "bg-warning/10 text-warning"
                              : building
                                ? "bg-success/10 text-success"
                                : "bg-surface text-muted",
                          )}
                          title={statusLabel}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white" aria-hidden>
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="flex items-baseline justify-between gap-3 text-[12px] font-bold tabular-nums">
                      <span className="text-text">
                        {hasMetrics ? `${metrics!.occupiedRooms} / ${metrics!.totalRooms} phòng đã thuê` : "— / —"}
                      </span>
                      <strong className={cx("text-[13px]", hasMetrics ? "text-primary" : "text-muted")}>
                        {hasMetrics ? `${metrics!.occupancyRate}%` : "—%"}
                      </strong>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Tỷ lệ lấp đầy ${descriptor.code}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={hasMetrics ? metrics!.occupancyRate : undefined}
                      aria-valuetext={hasMetrics ? `${metrics!.occupancyRate}%` : "Chưa có dữ liệu"}
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface"
                    >
                      {hasMetrics && (
                        <span
                          className="block h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
                          style={{ width: `${metrics!.occupancyRate}%` }}
                        />
                      )}
                    </div>
                  </div>

                  {hasMetrics ? (
                    <div className="mt-1.5 text-[12px] font-semibold tabular-nums text-muted">
                      <p>{metrics!.vacantRooms} phòng trống</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <i className="h-2 w-2 rounded-full bg-warning" />
                          {metrics!.expiringContracts} HĐ sắp hết hạn
                        </span>
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <i className="h-2 w-2 rounded-full bg-danger" />
                          {metrics!.overduePayments} quá hạn
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[12px] font-semibold text-muted">
                      {isPending ? "Chưa có thông tin phòng" : "Chưa có dữ liệu vận hành"}
                    </p>
                  )}
                </div>

                {isPending && (
                  onConfigureBuilding ? (
                    <button
                      type="button"
                      onClick={() => onConfigureBuilding(descriptor.code)}
                      className="relative z-20 mt-1.5 flex min-h-8 w-full items-center justify-center gap-2 rounded-[10px] border border-primary/25 bg-card px-3 text-[12px] font-black text-primary transition-colors duration-200 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                    >
                      <Settings2 size={14} aria-hidden />
                      Cấu hình mặt bằng
                    </button>
                  ) : (
                    <span className="pointer-events-none relative z-20 mt-1.5 flex min-h-8 w-full items-center justify-center gap-2 rounded-[10px] border border-primary/25 bg-card px-3 text-[12px] font-black text-primary">
                      <Settings2 size={14} aria-hidden />
                      Cấu hình mặt bằng
                    </span>
                  )
                )}
              </article>
            );
          })}

          <button
            type="button"
            onClick={onAddBuilding}
            disabled={!onAddBuilding}
            className="flex min-h-[146px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-3 text-[12px] font-black text-muted transition-[border-color,background-color,color] duration-200 hover:border-primary/45 hover:bg-primary/[0.035] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-primary">
              <Plus size={18} aria-hidden />
            </span>
            Thêm tòa nhà
          </button>
        </div>
      </div>
    </section>
  );
}
