"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Building2,
} from "lucide-react";
import { formatVnd } from "@/lib/utils/format";
import BuildingPerformanceDetailModal from "./BuildingPerformanceDetailModal";

interface BuildingProfitSummaryProps {
  onSelectBuilding?: (buildingCode: string) => void;
}

export default function BuildingProfitSummary({ onSelectBuilding }: BuildingProfitSummaryProps) {
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState("all");
  const [modalBuilding, setModalBuilding] = useState<{
    code: string;
    owner: string;
  } | null>(null);

  const buildings = [
    {
      code: "LK01.31",
      owner: "Tỉnh",
      ownerBadge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
      occupancy: 14,
      roomRatio: "1/7 phòng",
      rent: 4266667,
      elec: 765353,
      water: 100000,
      totalRev: 5132020,
      expense: 0,
      profit: 5132020,
      hasWarning: false,
    },
    {
      code: "LK01.32",
      owner: "Thế",
      ownerBadge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
      occupancy: 29,
      roomRatio: "2/7 phòng",
      rent: 8533334,
      elec: 549271,
      water: 200000,
      totalRev: 9282605,
      expense: 0,
      profit: 5282605,
      hasWarning: false,
    },
    {
      code: "LK08.24",
      owner: "Thế",
      ownerBadge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
      occupancy: 10,
      roomRatio: "1/10 phòng",
      rent: 4266667,
      elec: 0,
      water: 100000,
      totalRev: 4366667,
      expense: 0,
      profit: 4366667,
      hasWarning: false,
    },
    {
      code: "LK08.25",
      owner: "Tỉnh",
      ownerBadge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
      occupancy: 0,
      roomRatio: "0/10 phòng",
      rent: 0,
      elec: 0,
      water: 0,
      totalRev: 0,
      expense: 0,
      profit: 0,
      hasWarning: true,
      warningText: "Tòa chưa có phòng đang thuê",
    },
  ];

  const handleCardClick = (b: typeof buildings[0]) => {
    if (onSelectBuilding) {
      onSelectBuilding(b.code);
    } else {
      setModalBuilding({ code: b.code, owner: b.owner === "Tỉnh" ? "Nguyễn Đức Tính" : "Phan Văn Thế" });
    }
  };

  return (
    <>
      <section
        data-testid="building-profit-summary"
        className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs"
      >
        {/* Slim Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Building2 size={13} />
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-text">
                Hiệu quả theo tòa nhà
              </h2>
              <p className="text-[11px] text-muted">
                So sánh hiệu quả hoạt động của từng tòa nhà
              </p>
            </div>
          </div>

          <select
            value={selectedBuildingFilter}
            onChange={(e) => setSelectedBuildingFilter(e.target.value)}
            aria-label="Lọc theo tòa nhà"
            className="rounded-lg border border-border/70 bg-surface/40 px-2 py-1 text-xs font-semibold text-text shadow-2xs outline-none focus:border-primary"
          >
            <option value="all">Tất cả tòa nhà</option>
            <option value="LK01.31">LK01.31</option>
            <option value="LK01.32">LK01.32</option>
            <option value="LK08.24">LK08.24</option>
            <option value="LK08.25">LK08.25</option>
          </select>
        </div>

        {/* 4 Building Cards Grid - Uniform Height */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {buildings.map((b) => (
            <div
              key={b.code}
              onClick={() => handleCardClick(b)}
              className="group flex h-[165px] cursor-pointer flex-col justify-between rounded-lg border border-border/60 bg-surface/30 p-3 transition hover:border-border hover:bg-surface/70"
            >
              {/* Top: Building Code, Owner Badge, and Occupancy Donut */}
              <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 border border-purple-500/20">
                    <Building2 size={13} />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-text group-hover:text-primary transition-colors">
                        {b.code}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${b.ownerBadge}`}
                      >
                        {b.owner}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Donut Occupancy Gauge */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                      <path
                        className="text-border/40"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-emerald-500 transition-all duration-300"
                        strokeDasharray={`${b.occupancy}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-[8px] font-bold text-text">
                      {b.occupancy}%
                    </span>
                  </div>
                  <span className="text-[9px] font-medium text-muted">
                    {b.roomRatio}
                  </span>
                </div>
              </div>

              {/* Middle: Rent, Electric, Water stats */}
              <div className="grid grid-cols-3 gap-1.5 text-xs py-1">
                <div>
                  <span className="text-[9px] font-medium text-muted block">Thuê phòng</span>
                  <span className="font-mono font-bold text-text block mt-0.5 text-[10px] truncate">
                    {formatVnd(b.rent)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-medium text-muted block">Điện</span>
                  <span className="font-mono font-bold text-amber-600 block mt-0.5 text-[10px] truncate">
                    {formatVnd(b.elec)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-medium text-muted block">Nước & DV</span>
                  <span className="font-mono font-bold text-sky-600 block mt-0.5 text-[10px] truncate">
                    {formatVnd(b.water)}
                  </span>
                </div>
              </div>

              {/* Bottom: Total revenue, Expense, Profit or Warning */}
              <div className="border-t border-border/30 pt-1.5">
                {b.hasWarning ? (
                  <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    <AlertTriangle size={11} className="shrink-0" />
                    <span className="truncate">{b.warningText}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[8px] font-medium text-muted block">Tổng thu</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block text-[10px]">
                        {formatVnd(b.totalRev)}
                      </span>
                    </div>

                    <div className="text-center">
                      <span className="text-[8px] font-medium text-muted block">Chi phí</span>
                      <span className="font-mono font-bold text-rose-500 block text-[10px]">
                        {formatVnd(b.expense)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[8px] font-medium text-muted block">Lợi nhuận</span>
                      <span className="font-mono font-bold text-primary block text-[10px]">
                        {formatVnd(b.profit)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Building Performance Detail Modal */}
      {modalBuilding && (
        <BuildingPerformanceDetailModal
          isOpen={true}
          onClose={() => setModalBuilding(null)}
          buildingCode={modalBuilding.code}
          ownerName={modalBuilding.owner}
        />
      )}
    </>
  );
}
