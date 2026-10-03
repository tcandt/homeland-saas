"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  HandCoins,
  Layers,
  Minus,
  Receipt,
  Scale,
  Sparkles,
  User,
  Wallet,
  X,
} from "lucide-react";
import { formatVnd, formatNumber } from "@/lib/utils/format";

export type MonthRange = {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
};

export type OwnerEqualProfitSettlementProps = {
  buildingsData: any[];
  expenses: any[];
  isLoading: boolean;
  onOpenCreateExpense?: () => void;
  monthRange?: MonthRange;
  onMonthRangeChange?: (range: MonthRange) => void;
};

const MONTHS = [
  { value: 1, label: "Thg 01" },
  { value: 2, label: "Thg 02" },
  { value: 3, label: "Thg 03" },
  { value: 4, label: "Thg 04" },
  { value: 5, label: "Thg 05" },
  { value: 6, label: "Thg 06" },
  { value: 7, label: "Thg 07" },
  { value: 8, label: "Thg 08" },
  { value: 9, label: "Thg 09" },
  { value: 10, label: "Thg 10" },
  { value: 11, label: "Thg 11" },
  { value: 12, label: "Thg 12" },
];

const PRESET_OPTIONS = [
  { id: "this_month", label: "Tháng này" },
  { id: "last_3_months", label: "3 tháng gần nhất" },
  { id: "last_6_months", label: "6 tháng gần nhất" },
  { id: "last_12_months", label: "12 tháng gần nhất" },
  { id: "custom", label: "Tùy chọn" },
];

const MANAGED_BUILDINGS_CONFIG = [
  {
    code: "LK01.31",
    name: "Tòa LK01.31",
    cluster: "LK01",
    clusterName: "Cụm LK01",
    ownerCode: "OWNER-A",
    ownerName: "Nguyễn Đức Tính",
    sharePercent: 50,
  },
  {
    code: "LK01.32",
    name: "Tòa LK01.32",
    cluster: "LK01",
    clusterName: "Cụm LK01",
    ownerCode: "OWNER-B",
    ownerName: "Phan Văn Thể",
    sharePercent: 50,
  },
  {
    code: "LK08.24",
    name: "Tòa LK08.24",
    cluster: "LK08",
    clusterName: "Cụm LK08",
    ownerCode: "OWNER-B",
    ownerName: "Phan Văn Thể",
    sharePercent: 50,
  },
  {
    code: "LK08.25",
    name: "Tòa LK08.25",
    cluster: "LK08",
    clusterName: "Cụm LK08",
    ownerCode: "OWNER-A",
    ownerName: "Nguyễn Đức Tính",
    sharePercent: 50,
  },
];

export default function OwnerEqualProfitSettlement({
  buildingsData = [],
  expenses = [],
  isLoading,
  onOpenCreateExpense,
  monthRange,
  onMonthRangeChange,
}: OwnerEqualProfitSettlementProps) {
  // Aggregate data for the 4 core buildings & 2 clusters
  const financialData = useMemo(() => {
    const buildingMap = new Map<string, any>();
    (buildingsData || []).forEach((item: any) => {
      if (item?.building?.code) {
        buildingMap.set(item.building.code.toUpperCase(), item);
      }
    });

    // 1. Classify expenses: direct to building vs cluster incidental (phát sinh)
    let clusterLK01Incidental = 0;
    let clusterLK08Incidental = 0;
    let commonIncidental = 0;
    const directExpensesByBuilding = new Map<string, number>();
    const classifiedExpenses: any[] = [];

    (expenses || []).forEach((exp: any) => {
      if (exp.status === "CANCELLED") return;
      const amount = Number(exp.amount || 0);
      const bldCode = (exp.building?.code || exp.costCenter?.code || "").toUpperCase();
      const desc = (exp.description || "").toUpperCase();

      // Check if cluster incidental
      const isClusterLK01 =
        desc.includes("LK01.31+32") ||
        desc.includes("LK01.31+LK01.32") ||
        desc.includes("LK01-31+32") ||
        desc.includes("CỤM LK01") ||
        desc.includes("CUM LK01") ||
        (desc.includes("LK01") && !desc.includes("LK01.31") && !desc.includes("LK01.32"));

      const isClusterLK08 =
        desc.includes("LK08.24+25") ||
        desc.includes("LK08.24+LK08.25") ||
        desc.includes("LK08-24+25") ||
        desc.includes("CỤM LK08") ||
        desc.includes("CUM LK08") ||
        (desc.includes("LK08") && !desc.includes("LK08.24") && !desc.includes("LK08.25"));

      let targetType = "DIRECT";
      let targetLabel = bldCode || "Chung";

      if (isClusterLK01) {
        clusterLK01Incidental += amount;
        targetType = "CLUSTER_LK01";
        targetLabel = "Phát sinh Cụm LK01 (31+32)";
      } else if (isClusterLK08) {
        clusterLK08Incidental += amount;
        targetType = "CLUSTER_LK08";
        targetLabel = "Phát sinh Cụm LK08 (24+25)";
      } else if (bldCode === "LK01.31" || bldCode === "LK01.32" || bldCode === "LK08.24" || bldCode === "LK08.25") {
        targetType = "DIRECT";
        targetLabel = `Tòa ${bldCode}`;
        directExpensesByBuilding.set(bldCode, (directExpensesByBuilding.get(bldCode) || 0) + amount);
      } else {
        commonIncidental += amount;
        targetType = "COMMON";
        targetLabel = "Phát sinh chung hệ thống";
      }

      classifiedExpenses.push({
        ...exp,
        amount,
        targetType,
        targetLabel,
      });
    });

    // 2. Process 4 buildings revenue and direct expenses
    const buildingsSummary = MANAGED_BUILDINGS_CONFIG.map((cfg) => {
      const live = buildingMap.get(cfg.code.toUpperCase());
      const revenue = Number(live?.revenue || 0);
      const directExpense = Math.max(
        Number(live?.expense || 0),
        directExpensesByBuilding.get(cfg.code.toUpperCase()) || 0
      );
      const baseProfit = revenue - directExpense;
      const occupiedRooms = Number(live?.building?.occupiedRooms || 0);
      const totalRooms = Number(live?.building?.roomCount || 0);

      return {
        ...cfg,
        revenue,
        directExpense,
        baseProfit,
        occupiedRooms,
        totalRooms,
      };
    });

    const totalRevenue = buildingsSummary.reduce((sum, b) => sum + b.revenue, 0);
    const totalDirectExpenses = buildingsSummary.reduce((sum, b) => sum + b.directExpense, 0);
    const totalIncidental = clusterLK01Incidental + clusterLK08Incidental + commonIncidental;
    const netProfit = totalRevenue - totalDirectExpenses - totalIncidental;

    // Equal 50/50 split
    const halfProfit = Math.round(netProfit / 2);

    return {
      buildingsSummary,
      clusterLK01Incidental,
      clusterLK08Incidental,
      commonIncidental,
      totalIncidental,
      totalRevenue,
      totalDirectExpenses,
      netProfit,
      tinhShare: halfProfit,
      theShare: halfProfit,
      classifiedExpenses,
    };
  }, [buildingsData, expenses]);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [tempStartMonth, setTempStartMonth] = useState(monthRange?.startMonth || 7);
  const [tempStartYear, setTempStartYear] = useState(monthRange?.startYear || 2026);
  const [tempEndMonth, setTempEndMonth] = useState(monthRange?.endMonth || 9);
  const [tempEndYear, setTempEndYear] = useState(monthRange?.endYear || 2026);
  const [calendarYear, setCalendarYear] = useState(monthRange?.startYear || 2026);
  const [activePreset, setActivePreset] = useState<string>("last_3_months");
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (monthRange) {
      setTempStartMonth(monthRange.startMonth);
      setTempStartYear(monthRange.startYear);
      setTempEndMonth(monthRange.endMonth);
      setTempEndYear(monthRange.endYear);
      setCalendarYear(monthRange.startYear);
      setIsSelectingEnd(false);

      if (
        monthRange.startMonth === 10 &&
        monthRange.startYear === 2026 &&
        monthRange.endMonth === 10 &&
        monthRange.endYear === 2026
      ) {
        setActivePreset("this_month");
      } else if (
        monthRange.startMonth === 7 &&
        monthRange.startYear === 2026 &&
        monthRange.endMonth === 9 &&
        monthRange.endYear === 2026
      ) {
        setActivePreset("last_3_months");
      } else if (
        monthRange.startMonth === 4 &&
        monthRange.startYear === 2026 &&
        monthRange.endMonth === 9 &&
        monthRange.endYear === 2026
      ) {
        setActivePreset("last_6_months");
      } else if (
        monthRange.startMonth === 1 &&
        monthRange.startYear === 2026 &&
        monthRange.endMonth === 12 &&
        monthRange.endYear === 2026
      ) {
        setActivePreset("last_12_months");
      } else {
        setActivePreset("custom");
      }
    }
  }, [monthRange, isPickerOpen]);

  const handleCancel = () => {
    if (monthRange) {
      setTempStartMonth(monthRange.startMonth);
      setTempStartYear(monthRange.startYear);
      setTempEndMonth(monthRange.endMonth);
      setTempEndYear(monthRange.endYear);
      setCalendarYear(monthRange.startYear);
    }
    setIsSelectingEnd(false);
    setHoverMonth(null);
    setIsPickerOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (monthRange) {
          setTempStartMonth(monthRange.startMonth);
          setTempStartYear(monthRange.startYear);
          setTempEndMonth(monthRange.endMonth);
          setTempEndYear(monthRange.endYear);
          setCalendarYear(monthRange.startYear);
        }
        setIsSelectingEnd(false);
        setHoverMonth(null);
        setIsPickerOpen(false);
      }
    };
    if (isPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPickerOpen, monthRange]);

  const handleSelectPreset = (presetId: string) => {
    setActivePreset(presetId);
    setIsSelectingEnd(false);
    setHoverMonth(null);
    if (presetId === "this_month") {
      setTempStartMonth(10);
      setTempStartYear(2026);
      setTempEndMonth(10);
      setTempEndYear(2026);
      setCalendarYear(2026);
    } else if (presetId === "last_3_months") {
      setTempStartMonth(7);
      setTempStartYear(2026);
      setTempEndMonth(9);
      setTempEndYear(2026);
      setCalendarYear(2026);
    } else if (presetId === "last_6_months") {
      setTempStartMonth(4);
      setTempStartYear(2026);
      setTempEndMonth(9);
      setTempEndYear(2026);
      setCalendarYear(2026);
    } else if (presetId === "last_12_months") {
      setTempStartMonth(1);
      setTempStartYear(2026);
      setTempEndMonth(12);
      setTempEndYear(2026);
      setCalendarYear(2026);
    }
  };

  const handleMonthClick = (m: number) => {
    setActivePreset("custom");
    setHoverMonth(null);
    const clickedVal = calendarYear * 12 + m;
    const startVal = tempStartYear * 12 + tempStartMonth;

    if (!isSelectingEnd) {
      setTempStartMonth(m);
      setTempStartYear(calendarYear);
      setTempEndMonth(m);
      setTempEndYear(calendarYear);
      setIsSelectingEnd(true);
    } else {
      if (clickedVal < startVal) {
        setTempStartMonth(m);
        setTempStartYear(calendarYear);
        setTempEndMonth(m);
        setTempEndYear(calendarYear);
        setIsSelectingEnd(true);
      } else {
        setTempEndMonth(m);
        setTempEndYear(calendarYear);
        setIsSelectingEnd(false);
      }
    }
  };

  const handleApply = () => {
    if (!onMonthRangeChange) return;
    let sy = tempStartYear;
    let sm = tempStartMonth;
    let ey = tempEndYear;
    let em = tempEndMonth;

    if (ey < sy || (ey === sy && em < sm)) {
      ey = sy;
      em = sm;
    }
    onMonthRangeChange({ startYear: sy, startMonth: sm, endYear: ey, endMonth: em });
    setIsPickerOpen(false);
  };

  // Real-time dynamic preview cho nút "Kỳ báo cáo": Di chuyển theo picker
  const previewStartMonth = isPickerOpen ? tempStartMonth : (monthRange?.startMonth ?? 1);
  const previewStartYear = isPickerOpen ? tempStartYear : (monthRange?.startYear ?? 2026);

  const isHoverValidEnd =
    isSelectingEnd &&
    hoverMonth !== null &&
    calendarYear * 12 + hoverMonth >= tempStartYear * 12 + tempStartMonth;

  const currentDynamicEndMonth = isHoverValidEnd
    ? hoverMonth
    : isSelectingEnd
    ? tempStartMonth
    : tempEndMonth;

  const currentDynamicEndYear = isHoverValidEnd
    ? calendarYear
    : isSelectingEnd
    ? tempStartYear
    : tempEndYear;

  const previewEndMonth = isPickerOpen ? currentDynamicEndMonth : (monthRange?.endMonth ?? 10);
  const previewEndYear = isPickerOpen ? currentDynamicEndYear : (monthRange?.endYear ?? 2026);

  return (
    <div className="space-y-4">
      {/* KHỐI 1: CÔNG THỨC THÁC NƯỚC DÒNG TIỀN (WATERFALL CASHFLOW KPI) */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Scale size={16} />
            </span>
            <div>
              <h3 className="text-sm font-black text-foreground">
                Dòng Tiền Quyết Toán Hợp Nhất 4 Tòa (Công thức Doanh thu − Chi phí − Phát sinh)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Tổng doanh thu thực thu trừ toàn bộ chi phí trực tiếp và phát sinh cụm tòa trước khi chia lợi nhuận
              </p>
            </div>
          </div>

          {/* Single Clickable Month-Range Input */}
          {monthRange && onMonthRangeChange && (
            <div className="relative" ref={dropdownRef}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsPickerOpen(!isPickerOpen);
                  }
                }}
                className={`flex items-center gap-2 rounded-xl border bg-card px-3.5 py-1.5 text-xs text-slate-700 shadow-2xs transition cursor-pointer select-none dark:text-slate-200 ${
                  isPickerOpen
                    ? "border-indigo-500 ring-2 ring-indigo-500/10"
                    : "border-border/80 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-surface/50"
                }`}
                title="Bấm để chọn kỳ báo cáo"
              >
                <Calendar size={15} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap font-normal">
                  Kỳ báo cáo:
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  {String(previewStartMonth).padStart(2, "0")}/{previewStartYear} → {String(previewEndMonth).padStart(2, "0")}/{previewEndYear}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform duration-200 ${
                    isPickerOpen ? "rotate-180" : ""
                  }`}
                />
              </div>

              {/* Floating Dropdown Popover */}
              {isPickerOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200/90 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
                  {/* Arrow pointer */}
                  <div className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-l border-t border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900" />

                  {/* Body: 2 columns */}
                  <div className="flex">
                    {/* Left Sidebar */}
                    <div className="w-[145px] shrink-0 p-2.5 space-y-1">
                      {PRESET_OPTIONS.map((opt) => {
                        const isSelected = activePreset === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectPreset(opt.id)}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors rounded-lg relative cursor-pointer ${
                              isSelected
                                ? "bg-indigo-50/80 text-indigo-600 font-semibold dark:bg-indigo-950/60 dark:text-indigo-400"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60"
                            }`}
                          >
                            {isSelected && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-600 rounded-r dark:bg-indigo-500" />
                            )}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Vertical divider */}
                    <div className="w-px bg-slate-200/80 dark:bg-slate-800" />

                    {/* Right Calendar Panel */}
                    <div className="w-[235px] p-3">
                      {/* Year Header */}
                      <div className="flex items-center justify-between px-1 pb-2.5">
                        <button
                          type="button"
                          onClick={() => setCalendarYear((y) => y - 1)}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                          title="Năm trước"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {calendarYear}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCalendarYear((y) => y + 1)}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                          title="Năm sau"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>

                      {/* 12 Months Grid: 3 cols x 4 rows */}
                      <div
                        className="grid grid-cols-3 gap-2"
                        onMouseLeave={() => setHoverMonth(null)}
                      >
                        {MONTHS.map((m) => {
                          const effectiveEndMonth =
                            isSelectingEnd && hoverMonth !== null && hoverMonth >= tempStartMonth
                              ? hoverMonth
                              : tempEndMonth;
                          const effectiveEndYear =
                            isSelectingEnd && hoverMonth !== null && hoverMonth >= tempStartMonth
                              ? calendarYear
                              : tempEndYear;

                          const startVal = tempStartYear * 12 + tempStartMonth;
                          const endVal = effectiveEndYear * 12 + effectiveEndMonth;
                          const currentVal = calendarYear * 12 + m.value;

                          const isStart = currentVal === startVal;
                          const isEnd = currentVal === endVal;
                          const isEndpoint = isStart || isEnd;
                          const isInRange = currentVal >= startVal && currentVal <= endVal;

                          return (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => handleMonthClick(m.value)}
                              onMouseEnter={() => {
                                if (isSelectingEnd) setHoverMonth(m.value);
                              }}
                              className={`py-2 text-center text-xs rounded-lg transition cursor-pointer ${
                                isEndpoint
                                  ? "bg-indigo-600 text-white font-bold shadow-xs ring-2 ring-indigo-600/20"
                                  : isInRange
                                  ? "bg-indigo-100/90 text-indigo-900 border border-indigo-200/80 font-semibold dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-800/60"
                                  : "border border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 font-medium dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                              }`}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleApply}
                        className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
                      >
                        Áp dụng
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4 Cards Waterfall Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          {/* Card 1: Tổng Doanh Thu */}
          <div className="relative rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Building2 size={14} /> (1) Tổng Doanh Thu
              </span>
              <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px]">
                4 tòa
              </span>
            </div>
            <div className="my-2">
              <div className="font-mono text-xl font-black text-emerald-700 dark:text-emerald-300">
                {isLoading ? "Đang tính..." : formatVnd(financialData.totalRevenue)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Tiền phòng, điện nước & dịch vụ thực thu
              </p>
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold border-t border-emerald-500/20 pt-1.5 flex items-center justify-between">
              <span>LK01 (31, 32) + LK08 (24, 25)</span>
              <span>100%</span>
            </div>
          </div>

          {/* Card 2: Tổng Chi Phí Trực Tiếp */}
          <div className="relative rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Minus size={14} /> (2) Chi Phí Trực Tiếp
              </span>
              <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px]">
                Theo từng tòa
              </span>
            </div>
            <div className="my-2">
              <div className="font-mono text-xl font-black text-amber-700 dark:text-amber-300">
                {isLoading ? "Đang tính..." : formatVnd(financialData.totalDirectExpenses)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Bảo trì, sửa chữa, vệ sinh riêng tại từng tòa
              </p>
            </div>
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold border-t border-amber-500/20 pt-1.5 flex items-center justify-between">
              <span>Khấu trừ trực tiếp</span>
              <span>Trừ vào doanh thu</span>
            </div>
          </div>

          {/* Card 3: Chi Phí Phát Sinh Cụm Tòa */}
          <div className="relative rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Minus size={14} /> (3) Phát Sinh Cụm Tòa
              </span>
              <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px]">
                Dùng chung
              </span>
            </div>
            <div className="my-2">
              <div className="font-mono text-xl font-black text-rose-700 dark:text-rose-300">
                {isLoading ? "Đang tính..." : formatVnd(financialData.totalIncidental)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cụm LK01 (31+32) & Cụm LK08 (24+25)
              </p>
            </div>
            <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold border-t border-rose-500/20 pt-1.5 flex items-center justify-between">
              <span>Trừ chung trước khi chia lời</span>
              <span>Chia đều</span>
            </div>
          </div>

          {/* Card 4: Lợi Nhuận Ròng Sau Cùng */}
          <div className="relative rounded-xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-purple-500/10 p-3.5 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Sparkles size={14} className="text-amber-500" /> (=) Lợi Nhuận Ròng
              </span>
              <span className="rounded-md bg-indigo-600 text-white px-2 py-0.5 text-[10px] font-black shadow-2xs">
                Chia đôi 50/50
              </span>
            </div>
            <div className="my-2">
              <div className="font-mono text-xl font-black text-foreground">
                {isLoading ? "Đang tính..." : formatVnd(financialData.netProfit)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                = Doanh thu − Chi phí − Phát sinh
              </p>
            </div>
            <div className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold border-t border-indigo-500/20 pt-1.5 flex items-center justify-between">
              <span>Mỗi chủ nhận đúng:</span>
              <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                {isLoading ? "..." : formatVnd(financialData.tinhShare)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KHỐI 2: QUYẾT TOÁN CHIA ĐÔI 2 CHỦ SỞ HỮU (50% / 50%) */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <HandCoins size={16} />
            </span>
            <div>
              <h3 className="text-sm font-black text-foreground">
                Bảng Quyết Toán Lợi Nhuận Thực Nhận (Chia Đều 50% - 50%)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Lợi nhuận ròng sau cùng được chia đều chính xác cho 2 chủ sở hữu
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={13} />
            Thỏa thuận chia đôi 50% - 50%
          </span>
        </div>

        {/* 2 Hero Owner Cards Grid */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {/* Owner 1: Nguyễn Đức Tính */}
          <div className="rounded-xl border border-blue-500/30 bg-gradient-to-b from-blue-500/5 to-transparent p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-base shadow-sm">
                  T
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black text-foreground">
                      Nguyễn Đức Tính
                    </h4>
                    <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[11px] font-black text-blue-700 dark:text-blue-300">
                      Chủ sở hữu A
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tòa trực tiếp: <strong className="text-foreground">LK01.31</strong> & <strong className="text-foreground">LK08.25</strong>
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-black text-blue-700 dark:text-blue-300">
                50%
              </span>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-card p-3 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Số tiền quyết toán thực nhận kỳ này:
              </div>
              <div className="font-mono text-2xl font-black text-blue-700 dark:text-blue-300">
                {isLoading ? "Đang tính..." : formatVnd(financialData.tinhShare)}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
                <span>Công thức phân bổ:</span>
                <span className="font-medium text-foreground">
                  Tổng lợi nhuận ròng / 2
                </span>
              </div>
            </div>

            {/* Bank Info */}
            <div className="rounded-xl bg-muted/40 p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                <span className="flex items-center gap-1">
                  <CreditCard size={12} /> Tài khoản thụ hưởng:
                </span>
                <span className="font-mono font-bold text-foreground">BIDV - RLQJ</span>
              </div>
              <div className="text-[11px] font-bold text-foreground truncate">
                HỘ KINH DOANH NGUYEN DUC TINH
              </div>
            </div>
          </div>

          {/* Owner 2: Phan Văn Thể */}
          <div className="rounded-xl border border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600 text-white font-bold text-base shadow-sm">
                  Th
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black text-foreground">
                      Phan Văn Thể
                    </h4>
                    <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[11px] font-black text-purple-700 dark:text-purple-300">
                      Chủ sở hữu B
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tòa trực tiếp: <strong className="text-foreground">LK01.32</strong> & <strong className="text-foreground">LK08.24</strong>
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-purple-500/20 px-2.5 py-1 text-xs font-black text-purple-700 dark:text-purple-300">
                50%
              </span>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-card p-3 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Số tiền quyết toán thực nhận kỳ này:
              </div>
              <div className="font-mono text-2xl font-black text-purple-700 dark:text-purple-300">
                {isLoading ? "Đang tính..." : formatVnd(financialData.theShare)}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2">
                <span>Công thức phân bổ:</span>
                <span className="font-medium text-foreground">
                  Tổng lợi nhuận ròng / 2
                </span>
              </div>
            </div>

            {/* Bank Info */}
            <div className="rounded-xl bg-muted/40 p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                <span className="flex items-center gap-1">
                  <CreditCard size={12} /> Tài khoản thụ hưởng:
                </span>
                <span className="font-mono font-bold text-foreground">BIDV - QGPR</span>
              </div>
              <div className="text-[11px] font-bold text-foreground truncate">
                HỘ KINH DOANH PHAN VAN THE
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KHỐI 3: BẢNG BÓC TÁCH CHI TIẾT 4 TÒA & 2 CỤM PHÁT SINH */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-border/40 pb-2.5">
          <div>
            <h3 className="text-sm font-black text-foreground">
              Bảng Bóc Tách Chi Tiết 4 Tòa & Chi Phí Phát Sinh Cụm
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Xem rõ doanh thu thực thu, chi phí trực tiếp của từng tòa và các khoản phát sinh theo cụm (LK01 & LK08)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 px-3">Tòa nhà / Cụm phát sinh</th>
                <th className="py-2.5 px-3">Chủ quản lý</th>
                <th className="py-2.5 px-3 text-right">Doanh thu thực thu</th>
                <th className="py-2.5 px-3 text-right">Chi phí trực tiếp</th>
                <th className="py-2.5 px-3 text-right">Phát sinh trừ chung</th>
                <th className="py-2.5 px-3 text-right">Lợi nhuận cơ sở</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {/* NHÓM CỤM LK01 */}
              <tr className="bg-primary/5 font-bold text-primary text-[11px]">
                <td colSpan={6} className="py-2 px-3">
                  🏢 CỤM TÒA LK01 (LK01.31 & LK01.32)
                </td>
              </tr>
              {financialData.buildingsSummary
                .filter((b) => b.cluster === "LK01")
                .map((b) => (
                  <tr key={b.code} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{b.code}</span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {b.ownerName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatVnd(b.revenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {formatVnd(b.directExpense)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      —
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                      {formatVnd(b.baseProfit)}
                    </td>
                  </tr>
                ))}
              {/* Dòng phát sinh cụm LK01 */}
              <tr className="bg-rose-500/5 text-rose-700 dark:text-rose-400 italic">
                <td className="py-2 px-3 font-bold flex items-center gap-1.5" colSpan={4}>
                  <span>⚡ Chi phí phát sinh dùng chung Cụm LK01 (31+32)</span>
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold">
                  {financialData.clusterLK01Incidental > 0
                    ? `− ${formatVnd(financialData.clusterLK01Incidental)}`
                    : "0 đ"}
                </td>
                <td className="py-2 px-3 text-right font-mono text-muted-foreground text-[10px]">
                  Trừ vào lợi nhuận chung
                </td>
              </tr>

              {/* NHÓM CỤM LK08 */}
              <tr className="bg-primary/5 font-bold text-primary text-[11px]">
                <td colSpan={6} className="py-2 px-3">
                  🏢 CỤM TÒA LK08 (LK08.24 & LK08.25)
                </td>
              </tr>
              {financialData.buildingsSummary
                .filter((b) => b.cluster === "LK08")
                .map((b) => (
                  <tr key={b.code} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{b.code}</span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {b.ownerName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatVnd(b.revenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {formatVnd(b.directExpense)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      —
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                      {formatVnd(b.baseProfit)}
                    </td>
                  </tr>
                ))}
              {/* Dòng phát sinh cụm LK08 */}
              <tr className="bg-rose-500/5 text-rose-700 dark:text-rose-400 italic">
                <td className="py-2 px-3 font-bold flex items-center gap-1.5" colSpan={4}>
                  <span>⚡ Chi phí phát sinh dùng chung Cụm LK08 (24+25)</span>
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold">
                  {financialData.clusterLK08Incidental > 0
                    ? `− ${formatVnd(financialData.clusterLK08Incidental)}`
                    : "0 đ"}
                </td>
                <td className="py-2 px-3 text-right font-mono text-muted-foreground text-[10px]">
                  Trừ vào lợi nhuận chung
                </td>
              </tr>

              {/* Dòng phát sinh chung hệ thống nếu có */}
              {financialData.commonIncidental > 0 && (
                <tr className="bg-rose-500/5 text-rose-700 dark:text-rose-400 italic">
                  <td className="py-2 px-3 font-bold flex items-center gap-1.5" colSpan={4}>
                    <span>⚡ Chi phí phát sinh chung toàn hệ thống</span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold">
                    {`− ${formatVnd(financialData.commonIncidental)}`}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-muted-foreground text-[10px]">
                    Trừ vào lợi nhuận chung
                  </td>
                </tr>
              )}
            </tbody>

            {/* FOOTER TỔNG KẾT & PHÂN CHIA 50/50 */}
            <tfoot>
              <tr className="border-t-2 border-border font-bold bg-muted/40">
                <td className="py-3 px-3 uppercase text-[11px] text-foreground font-black" colSpan={2}>
                  TỔNG CỘNG HỆ THỐNG (4 TÒA)
                </td>
                <td className="py-3 px-3 text-right font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">
                  {formatVnd(financialData.totalRevenue)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-black text-sm text-amber-700 dark:text-amber-400">
                  {formatVnd(financialData.totalDirectExpenses)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-black text-sm text-rose-700 dark:text-rose-400">
                  {formatVnd(financialData.totalIncidental)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-black text-sm text-primary">
                  {formatVnd(financialData.netProfit)}
                </td>
              </tr>
              <tr className="bg-primary/10 text-primary font-black">
                <td colSpan={3} className="py-2.5 px-3 text-xs">
                  👉 LỢI NHUẬN SAU CÙNG CHIA ĐÔI CHO 2 CHỦ (50% / 50%):
                </td>
                <td colSpan={3} className="py-2.5 px-3 text-right font-mono text-sm">
                  Nguyễn Đức Tính: <span className="underline">{formatVnd(financialData.tinhShare)}</span> &nbsp;|&nbsp; Phan Văn Thể: <span className="underline">{formatVnd(financialData.theShare)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* KHỐI 4: DANH SÁCH CHI TIẾT CÁC KHOẢN CHI PHÍ & PHÁT SINH TRONG KỲ */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <Receipt size={16} />
            </span>
            <div>
              <h3 className="text-sm font-black text-foreground">
                Bảng Kê Chi Phí & Phát Sinh Trong Kỳ ({financialData.classifiedExpenses.length} khoản)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Toàn bộ các khoản chi phí trực tiếp của tòa hoặc phát sinh cụm đã được trừ trong kỳ này
              </p>
            </div>
          </div>
        </div>

        {financialData.classifiedExpenses.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <Receipt size={32} className="mx-auto text-muted/50 mb-2 stroke-1" />
            <p>Không có khoản chi phí hoặc phát sinh nào trong kỳ được chọn.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto hide-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card border-b border-border/60">
                <tr className="text-[11px] font-bold text-muted-foreground uppercase">
                  <th className="py-2 px-3">Mã phiếu</th>
                  <th className="py-2 px-3">Ngày</th>
                  <th className="py-2 px-3">Hạng mục áp dụng</th>
                  <th className="py-2 px-3">Mô tả chi phí</th>
                  <th className="py-2 px-3 text-right">Số tiền</th>
                  <th className="py-2 px-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {financialData.classifiedExpenses.map((exp: any) => (
                  <tr key={exp.id} className="hover:bg-muted/20">
                    <td className="py-2 px-3 font-mono font-bold text-foreground">
                      {exp.code}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {exp.date ? new Date(exp.date).toLocaleDateString("vi-VN") : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          exp.targetType === "CLUSTER_LK01"
                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                            : exp.targetType === "CLUSTER_LK08"
                            ? "bg-purple-500/15 text-purple-700 dark:text-purple-300"
                            : exp.targetType === "COMMON"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {exp.targetLabel}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-foreground font-medium max-w-[260px] truncate" title={exp.description}>
                      {exp.description || "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatVnd(exp.amount)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          exp.status === "PAID"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : exp.status === "APPROVED"
                            ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {exp.status === "PAID" ? "Đã trả" : exp.status === "APPROVED" ? "Đã duyệt" : "Chờ duyệt"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
