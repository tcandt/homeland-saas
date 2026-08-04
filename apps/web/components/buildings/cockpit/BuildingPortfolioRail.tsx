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
      <div className="overflow-x-auto pb-4 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/60 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-primary/50 dark:hover:[&::-webkit-scrollbar-thumb]:bg-primary/50 transition-colors duration-200">
        <div className="grid min-w-[1050px] grid-cols-[repeat(4,minmax(220px,1fr))_132px] gap-3 items-stretch">
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
                  "relative min-h-[160px] h-full flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-3.5 shadow-[0_12px_30px_rgb(var(--shadow-color)/0.055)] transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none",
                  isSelected
                    ? "border-primary bg-primary/[0.055] shadow-[0_16px_36px_rgb(var(--shadow-color)/0.12)] ring-1 ring-primary/35 dark:bg-primary/[0.14]"
                    : "border-border/40 dark:border-white/5",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectBuilding(descriptor.code)}
                  aria-pressed={isSelected}
                  aria-label={`Chọn tòa nhà ${descriptor.code}, ${statusLabel}`}
                  className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                />

                <div className="pointer-events-none relative z-10 flex-1 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", isSelected ? "bg-primary text-white shadow-[0_8px_18px_rgb(var(--shadow-color)/0.15)]" : "bg-primary/10 text-primary")}>
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
                  </div>

                  <div className="mt-2 text-[12px] font-semibold tabular-nums text-muted">
                    {hasMetrics ? (
                      <>
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
                      </>
                    ) : (
                      <p>
                        {isPending ? "Chưa có thông tin phòng" : "Chưa có dữ liệu vận hành"}
                      </p>
                    )}
                  </div>
                </div>

                {isPending && (
                  <div className="relative z-20 mt-2">
                    {onConfigureBuilding ? (
                      <button
                        type="button"
                        onClick={() => onConfigureBuilding(descriptor.code)}
                        className="flex min-h-8 w-full items-center justify-center gap-2 rounded-[10px] border border-primary/25 bg-card/90 px-3 text-[12px] font-black text-primary shadow-[0_8px_18px_rgb(var(--shadow-color)/0.04)] transition-colors duration-200 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                      >
                        <Settings2 size={14} aria-hidden />
                        Cấu hình mặt bằng
                      </button>
                    ) : (
                      <span className="flex min-h-8 w-full items-center justify-center gap-2 rounded-[10px] border border-primary/25 bg-card px-3 text-[12px] font-black text-primary">
                        <Settings2 size={14} aria-hidden />
                        Cấu hình mặt bằng
                      </span>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          <button
            type="button"
            onClick={onAddBuilding}
            disabled={!onAddBuilding}
            className="flex min-h-[160px] h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/90 bg-card/60 px-3 text-[12px] font-black text-muted transition-[border-color,background-color,color,box-shadow] duration-200 hover:border-primary/45 hover:bg-primary/[0.035] hover:text-primary hover:shadow-[0_12px_28px_rgb(var(--shadow-color)/0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none"
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
