"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";

export type MonthRange = {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
};

interface MonthRangePickerProps {
  value: MonthRange;
  onChange: (range: MonthRange) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const MONTHS = [
  { value: 1, label: "Tháng 01" },
  { value: 2, label: "Tháng 02" },
  { value: 3, label: "Tháng 03" },
  { value: 4, label: "Tháng 04" },
  { value: 5, label: "Tháng 05" },
  { value: 6, label: "Tháng 06" },
  { value: 7, label: "Tháng 07" },
  { value: 8, label: "Tháng 08" },
  { value: 9, label: "Tháng 09" },
  { value: 10, label: "Tháng 10" },
  { value: 11, label: "Tháng 11" },
  { value: 12, label: "Tháng 12" },
];

const YEARS = [2024, 2025, 2026, 2027];

export default function MonthRangePicker({
  value,
  onChange,
  onRefresh,
  isRefreshing = false,
}: MonthRangePickerProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [tempRange, setTempRange] = useState<MonthRange>(value);

  const popoverRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  // Sync tempRange when value prop changes or popover opens
  useEffect(() => {
    setTempRange(value);
  }, [value, isCustomOpen]);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(e.target as Node)
      ) {
        setIsCustomOpen(false);
      }
    };

    if (isCustomOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCustomOpen]);

  const currentYear = 2026;

  const presets = useMemo(
    () => [
      {
        id: "cur-month",
        label: "Tháng này (T10)",
        range: { startMonth: 10, startYear: currentYear, endMonth: 10, endYear: currentYear },
      },
      {
        id: "prev-month",
        label: "Tháng trước (T09)",
        range: { startMonth: 9, startYear: currentYear, endMonth: 9, endYear: currentYear },
      },
      {
        id: "q3",
        label: "Quý 3 (T07 - T09)",
        range: { startMonth: 7, startYear: currentYear, endMonth: 9, endYear: currentYear },
      },
      {
        id: "q2",
        label: "Quý 2 (T04 - T06)",
        range: { startMonth: 4, startYear: currentYear, endMonth: 6, endYear: currentYear },
      },
      {
        id: "year",
        label: `Cả năm ${currentYear}`,
        range: { startMonth: 1, startYear: currentYear, endMonth: 12, endYear: currentYear },
      },
    ],
    [currentYear]
  );

  const isPresetActive = (
    sm: number,
    sy: number,
    em: number,
    ey: number
  ) =>
    value.startMonth === sm &&
    value.startYear === sy &&
    value.endMonth === em &&
    value.endYear === ey;

  // Determine if active range matches one of the presets
  const activePreset = presets.find((p) =>
    isPresetActive(
      p.range.startMonth,
      p.range.startYear,
      p.range.endMonth,
      p.range.endYear
    )
  );

  const isCustomRangeActive = !activePreset;

  // Formatted period text and duration tag
  const { periodLabel, durationLabel } = useMemo(() => {
    const sm = String(value.startMonth).padStart(2, "0");
    const em = String(value.endMonth).padStart(2, "0");
    const countMonths =
      (value.endYear - value.startYear) * 12 + (value.endMonth - value.startMonth) + 1;

    let period = "";
    if (value.startMonth === value.endMonth && value.startYear === value.endYear) {
      period = `Tháng ${sm}/${value.startYear}`;
    } else if (value.startYear === value.endYear) {
      period = `Tháng ${sm} ➔ Tháng ${em}, ${value.startYear}`;
    } else {
      period = `Tháng ${sm}/${value.startYear} ➔ Tháng ${em}/${value.endYear}`;
    }

    let duration = `${countMonths} tháng`;
    if (countMonths === 3) {
      if (value.startMonth === 7 && value.endMonth === 9) duration = "Quý 3 (3 tháng)";
      else if (value.startMonth === 4 && value.endMonth === 6) duration = "Quý 2 (3 tháng)";
      else if (value.startMonth === 1 && value.endMonth === 3) duration = "Quý 1 (3 tháng)";
      else if (value.startMonth === 10 && value.endMonth === 12) duration = "Quý 4 (3 tháng)";
    } else if (countMonths === 12) {
      duration = "Cả năm";
    }

    return { periodLabel: period, durationLabel: duration };
  }, [value]);

  const handleApplyCustom = () => {
    let { startMonth, startYear, endMonth, endYear } = tempRange;
    if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
      endYear = startYear;
      endMonth = startMonth;
    }
    onChange({ startMonth, startYear, endMonth, endYear });
    setIsCustomOpen(false);
  };

  return (
    <div className="relative flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-border/80 bg-card/90 p-2.5 shadow-sm backdrop-blur-md lg:flex-row lg:items-center">
      {/* Group 1: Segmented Preset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-muted/50 p-1 border border-border/40">
          {presets.map((preset) => {
            const active = isPresetActive(
              preset.range.startMonth,
              preset.range.startYear,
              preset.range.endMonth,
              preset.range.endYear
            );
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onChange(preset.range);
                  setIsCustomOpen(false);
                }}
                className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? "bg-background text-foreground shadow-xs ring-1 ring-border/60"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                <span>{preset.label}</span>
              </button>
            );
          })}

          <div className="h-4 w-[1px] bg-border/60 mx-0.5" />

          {/* Custom Date Range Toggle Button */}
          <button
            ref={toggleBtnRef}
            type="button"
            onClick={() => setIsCustomOpen(!isCustomOpen)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              isCustomRangeActive || isCustomOpen
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>Tùy chọn khoảng tháng</span>
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${
                isCustomOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Group 2: Unified Active Period Pill & Refresh Action */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:justify-end">
        {/* Active Period Pill (Clean, Non-repetitive) */}
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
          <Calendar size={14} className="shrink-0 text-primary" />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-extrabold text-foreground">{periodLabel}</span>
            <span className="rounded-full bg-primary/15 px-2 py-0.2 text-[10px] font-black uppercase tracking-wide text-primary">
              {durationLabel}
            </span>
          </div>
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs transition-all hover:border-primary hover:text-primary active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Làm mới dữ liệu số liệu"
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}
            />
            <span>{isRefreshing ? "Đang tải..." : "Làm mới"}</span>
          </button>
        )}
      </div>

      {/* Floating Popover: Custom Month Range Selector */}
      {isCustomOpen && (
        <div
          ref={popoverRef}
          className="absolute left-2.5 top-[calc(100%+8px)] z-50 w-full max-w-[420px] rounded-2xl border border-border bg-card p-4 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Popover Header */}
          <div className="mb-3.5 flex items-center justify-between border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calendar size={14} />
              </span>
              <div>
                <h4 className="text-xs font-black text-foreground">
                  Chọn Khoảng Tháng Tùy Chỉnh
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  Lọc số liệu theo bất kỳ giai đoạn nào
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCustomOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>

          {/* Selectors Grid: From -> To */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* From */}
            <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface/50 p-2.5">
              <label className="text-[11px] font-bold text-muted-foreground">
                Từ tháng:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={tempRange.startMonth}
                  onChange={(e) =>
                    setTempRange((prev) => ({
                      ...prev,
                      startMonth: Number(e.target.value),
                    }))
                  }
                  className="rounded-lg border border-border/80 bg-background px-2 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary cursor-pointer"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={tempRange.startYear}
                  onChange={(e) =>
                    setTempRange((prev) => ({
                      ...prev,
                      startYear: Number(e.target.value),
                    }))
                  }
                  className="rounded-lg border border-border/80 bg-background px-2 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary cursor-pointer"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* To */}
            <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface/50 p-2.5">
              <label className="text-[11px] font-bold text-muted-foreground">
                Đến tháng:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={tempRange.endMonth}
                  onChange={(e) =>
                    setTempRange((prev) => ({
                      ...prev,
                      endMonth: Number(e.target.value),
                    }))
                  }
                  className="rounded-lg border border-border/80 bg-background px-2 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary cursor-pointer"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={tempRange.endYear}
                  onChange={(e) =>
                    setTempRange((prev) => ({
                      ...prev,
                      endYear: Number(e.target.value),
                    }))
                  }
                  className="rounded-lg border border-border/80 bg-background px-2 py-1.5 text-xs font-bold text-foreground outline-none focus:border-primary cursor-pointer"
                >
                  {YEARS.filter((y) => y >= tempRange.startYear).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Popover Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3">
            <button
              type="button"
              onClick={() => setIsCustomOpen(false)}
              className="rounded-xl border border-border/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-surface hover:text-foreground cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-xs transition hover:opacity-90 active:scale-95 cursor-pointer"
            >
              <Check size={13} />
              <span>Áp dụng kỳ lọc</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
