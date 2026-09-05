"use client";

import { Building2, Check, Settings2 } from "lucide-react";
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
  className,
}: BuildingPortfolioRailProps) {
  const buildingsByCode = new Map(
    buildings.map((building) => [normalizeBuildingCode(building.code), building]),
  );
  const normalizedActiveCode = normalizeBuildingCode(activeBuildingCode);

  return (
    <section aria-label="Danh mục tòa nhà" className={cx("min-w-0", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
          {buildingTemplateRegistry.map((descriptor) => {
            const building = buildingsByCode.get(descriptor.code);
            const isPending = !building || descriptor.layoutStatus === "pending" || building.layoutStatus === "pending";
            const isSelected = descriptor.code === normalizedActiveCode;
            const metrics = building && !isPending ? getBuildingMetrics(building) : null;
            const hasMetrics = Boolean(metrics && metrics.totalRooms > 0);
            const statusLabel = isPending
              ? "Coming Soon"
              : building?.statusLabel || "Chưa đồng bộ";

            return (
              <article
                key={descriptor.code}
                className={cx(
                  "group relative flex min-h-[102px] h-full flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-300 motion-reduce:transition-none p-3 select-none bg-card",
                  isSelected
                    ? "border-primary shadow-[0_10px_26px_rgb(var(--shadow-color)/0.08)] ring-2 ring-primary/25"
                    : "border-border/30 dark:border-white/5 shadow-[0_10px_26px_rgb(var(--shadow-color)/0.055)] hover:border-primary/40 hover:shadow-md",
                )}
              >
                {/* Left active gradient indicator bar */}
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-indigo-500 to-violet-500 rounded-l-2xl" />
                )}

                <button
                  type="button"
                  onClick={() => onSelectBuilding(descriptor.code)}
                  aria-pressed={isSelected}
                  aria-label={`Chọn tòa nhà ${descriptor.code}, ${statusLabel}`}
                  className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                />

                <div className="pointer-events-none relative z-10 flex flex-col justify-between h-full gap-2">
                  {/* Top Bar: Icon, Code, Live Status Badge, Active Indicator */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
                        isSelected
                          ? "bg-primary text-white shadow-md shadow-primary/25 ring-2 ring-primary/20"
                          : "bg-primary/10 text-primary group-hover:bg-primary/15"
                      )}>
                        <Building2 size={16} aria-hidden />
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h2 className="text-xs font-black tracking-tight text-text truncate">
                          {descriptor.code}
                        </h2>
                        <span
                          className={cx(
                            "inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold leading-none",
                            isPending
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : building
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-surface text-muted border border-border/20",
                          )}
                          title={statusLabel}
                        >
                          {!isPending && building && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                          )}
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm" aria-hidden>
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>

                  {/* Middle Bar: Progress & Occupancy */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-text font-semibold">
                        {hasMetrics ? `${metrics!.occupiedRooms}/${metrics!.totalRooms} phòng đã thuê` : "—"}
                      </span>
                      <span className={cx("font-black text-[11px]", hasMetrics ? "text-primary" : "text-muted")}>
                        {hasMetrics ? `${metrics!.occupancyRate}%` : "—%"}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Tỷ lệ lấp đầy ${descriptor.code}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={hasMetrics ? metrics!.occupancyRate : undefined}
                      aria-valuetext={hasMetrics ? `${metrics!.occupancyRate}%` : "Chưa có dữ liệu"}
                      className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
                    >
                      {hasMetrics && (
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-primary via-indigo-500 to-violet-500 transition-[width] duration-300 motion-reduce:transition-none"
                          style={{ width: `${metrics!.occupancyRate}%` }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Bottom Bar: Operational Indicators */}
                  <div className="flex items-center justify-between text-[10px] font-semibold text-muted min-w-0">
                    {hasMetrics ? (
                      <>
                        <span className="truncate">{metrics!.vacantRooms} phòng trống</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="flex items-center gap-1">
                            <i className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {metrics!.expiringContracts} HĐ hết hạn
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            {metrics!.overduePayments} quá hạn
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="truncate text-muted">
                        {isPending ? "Chưa có thông tin phòng" : "Chưa có dữ liệu"}
                      </span>
                    )}
                  </div>
                </div>

                {isPending && (
                  <div className="relative z-20 mt-1.5">
                    {onConfigureBuilding ? (
                      <button
                        type="button"
                        onClick={() => onConfigureBuilding(descriptor.code)}
                        className="flex min-h-7 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-2 text-[11px] font-black text-primary transition-colors hover:bg-primary/20"
                      >
                        <Settings2 size={13} aria-hidden />
                        Cấu hình mặt bằng
                      </button>
                    ) : (
                      <span className="flex min-h-7 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-2 text-[11px] font-black text-primary">
                        <Settings2 size={13} aria-hidden />
                        Cấu hình mặt bằng
                      </span>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
    </section>
  );
}
