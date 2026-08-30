"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Bolt,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Grid3X3,
  History,
  Info,
  LayoutGrid,
  LayoutList,
  Lock,
  MoreHorizontal,
  PlugZap,
  RefreshCcw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Unlock,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { hunonicApi, HunonicLockedPeriodRow, HunonicRateApplyPayload } from "@/lib/api/hunonic.api";
import toast from "react-hot-toast";

function formatCurrency(value?: number | string | null) {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat("vi-VN").format(number)}đ`;
}

function formatKwh(value?: number | string | null) {
  const number = Number(value || 0);
  return `${number.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kWh`;
}

function formatWatts(value?: number | string | null) {
  const number = Number(value || 0);
  return `${number.toLocaleString("vi-VN")} W`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa có";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
}

function isMeterOnline(meter: any): boolean {
  const statusStr = String(meter.status || meter.lastStatus || "").trim().toLowerCase();
  if (statusStr === "on" || statusStr === "online" || statusStr === "active" || statusStr === "1") {
    return true;
  }
  if (meter.isOnline === true) return true;
  if (meter.lastSyncedAt) {
    const diffHours = (Date.now() - new Date(meter.lastSyncedAt).getTime()) / (1000 * 60 * 60);
    if (diffHours < 2) return true;
  }
  return false;
}

// Column Visibility keys
type ColumnKey =
  | "room"
  | "device"
  | "status"
  | "rateMode"
  | "power"
  | "energy"
  | "cost"
  | "lastSync"
  | "actions";

const defaultVisibleColumns: Record<ColumnKey, boolean> = {
  room: true,
  device: true,
  status: true,
  rateMode: true,
  power: true,
  energy: true,
  cost: true,
  lastSync: true,
  actions: true,
};

const columnLabels: Record<ColumnKey, string> = {
  room: "Phòng / Căn hộ",
  device: "Công tơ / Thiết bị",
  status: "Trạng thái",
  rateMode: "Phương thức tính giá",
  power: "Công suất (W)",
  energy: "Tiêu thụ tháng (kWh)",
  cost: "Tiền tạm tính",
  lastSync: "Cập nhật",
  actions: "Thao tác",
};

export default function ElectricityManagementPage() {
  const { data: overviewRes, mutate: mutateOverview, isLoading: isLoadingOverview } = useSWR(
    ["hunonic-overview"],
    () => hunonicApi.overview(),
    { revalidateOnFocus: false, refreshInterval: 30000 },
  );

  const { data: ratesRes, mutate: mutateRates } = useSWR(
    ["hunonic-rates"],
    () => hunonicApi.rates(),
    { revalidateOnFocus: false },
  );

  // View & UI states
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(defaultVisibleColumns);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  // Row Action dropdown menu state
  const [openActionRowId, setOpenActionRowId] = useState<string | null>(null);
  const actionDropdownRef = useRef<HTMLDivElement>(null);

  // Selection states for Bulk Actions
  const [selectedMeterIds, setSelectedMeterIds] = useState<string[]>([]);

  // Action modals states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [rateMode, setRateMode] = useState<"residential" | "custom">("residential");
  const [customRate, setCustomRate] = useState("3500");
  const [isApplyingRate, setIsApplyingRate] = useState(false);

  // Lock Period Modal
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [lockPeriod, setLockPeriod] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  );
  const [lockNote, setLockNote] = useState("Chốt số điện kỳ hóa đơn");
  const [isLocking, setIsLocking] = useState(false);

  // History modal state
  const [selectedRoomHistory, setSelectedRoomHistory] = useState<any | null>(null);
  const [historyYear, setHistoryYear] = useState<string>(String(new Date().getFullYear()));
  const [historyMonth, setHistoryMonth] = useState<string>(String(new Date().getMonth() + 1));
  const { data: historyRes, isLoading: isLoadingHistory } = useSWR(
    selectedRoomHistory ? ["hunonic-history", selectedRoomHistory.roomId, historyYear, historyMonth] : null,
    () =>
      hunonicApi.history({
        roomCode: selectedRoomHistory?.roomCode,
        buildingCode: selectedRoomHistory?.buildingCode,
        year: historyYear,
        month: historyMonth,
      }),
    { revalidateOnFocus: false },
  );

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(event.target as Node)) {
        setOpenActionRowId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const rawOverview = overviewRes as any;
  const overview = rawOverview?.data || rawOverview || {};
  const meters: any[] = Array.isArray(overview.meters) ? overview.meters : [];

  const rawRates = (ratesRes as any)?.data || ratesRes || {};
  const ratesList: any[] = Array.isArray(rawRates?.rows)
    ? rawRates.rows
    : Array.isArray(rawRates)
      ? rawRates
      : [];

  const rateByRoomKey = useMemo(() => {
    const map = new Map<string, any>();
    ratesList.forEach((r: any) => {
      if (r.id) map.set(r.id, r);
      if (r.providerRootId) map.set(r.providerRootId, r);
      if (r.providerMeterId) map.set(r.providerMeterId, r);
      if (r.buildingCode && r.roomCode) {
        map.set(`${r.buildingCode}::${r.roomCode}`, r);
        map.set(`${r.buildingCode}:${r.roomCode}`, r);
      }
    });
    return map;
  }, [ratesList]);

  const buildings: string[] = useMemo(() => {
    const list = new Set<string>();
    meters.forEach((m) => {
      if (m.buildingCode) list.add(m.buildingCode);
    });
    return Array.from(list).sort();
  }, [meters]);

  const kpis = useMemo(() => {
    const total = meters.length;
    const online = meters.filter((m) => isMeterOnline(m)).length;
    const totalKwh = meters.reduce(
      (acc, m) => acc + Number(m.energyMonthKwh || m.totalKwh || m.currentKwh || m.kwh || 0),
      0,
    );
    const totalCost = meters.reduce(
      (acc, m) => acc + Number(m.moneyMonthVnd || m.estimatedCost || m.amount || 0),
      0,
    );
    return {
      total,
      online,
      offline: total - online,
      totalKwh: Math.max(0, totalKwh),
      totalCost,
    };
  }, [meters]);

  const filteredMeters = useMemo(() => {
    return meters.filter((m) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (m.roomCode || "").toLowerCase().includes(q) ||
        (m.buildingCode || "").toLowerCase().includes(q) ||
        (m.displayName || m.name || m.meterName || "").toLowerCase().includes(q) ||
        (m.providerDeviceId || m.mac || m.deviceId || "").toLowerCase().includes(q);

      const matchBuilding = selectedBuilding === "ALL" || m.buildingCode === selectedBuilding;

      const online = isMeterOnline(m);
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ONLINE" && online) ||
        (statusFilter === "OFFLINE" && !online);

      return matchSearch && matchBuilding && matchStatus;
    });
  }, [meters, searchQuery, selectedBuilding, statusFilter]);

  // Bulk selection helpers
  const allFilteredIds = useMemo(() => {
    return filteredMeters.map((m) => m.id || m.deviceId || m.mac);
  }, [filteredMeters]);

  const isAllSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedMeterIds.includes(id));
  const isSomeSelected =
    selectedMeterIds.length > 0 && !isAllSelected && allFilteredIds.some((id) => selectedMeterIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedMeterIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedMeterIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const toggleSelectMeter = (id: string) => {
    setSelectedMeterIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result: any = await hunonicApi.sync();
      await mutateOverview();
      toast.success(`Đồng bộ chỉ số thành công (${result?.data?.syncedCount ?? "toàn bộ"} công tơ)`);
    } catch (error: any) {
      toast.error(error?.message || "Không thể đồng bộ chỉ số từ Hunonic");
    } finally {
      setIsSyncing(false);
    }
  };

  const openRateModalForSelection = (meterId?: string) => {
    if (meterId) {
      setSelectedMeterIds([meterId]);
    }
    setOpenActionRowId(null);
    setIsRateModalOpen(true);
  };

  const handleApplyRate = async () => {
    const targets = selectedMeterIds.length > 0 ? selectedMeterIds : allFilteredIds;
    if (targets.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 công tơ");
      return;
    }
    setIsApplyingRate(true);
    try {
      const payload: HunonicRateApplyPayload = {
        meterIds: targets,
        mode: rateMode,
        customRateVnd: rateMode === "custom" ? Number(customRate || 0) : undefined,
      };
      await hunonicApi.applyRates(payload);
      await mutateRates();
      await mutateOverview();
      setIsRateModalOpen(false);
      toast.success(`Đã áp dụng biểu giá cho ${targets.length} công tơ!`);
    } catch (error: any) {
      toast.error(error?.message || "Lỗi khi áp dụng biểu giá");
    } finally {
      setIsApplyingRate(false);
    }
  };

  const handleLockPeriods = async () => {
    const targets = selectedMeterIds.length > 0
      ? meters.filter((m) => selectedMeterIds.includes(m.id || m.deviceId || m.mac))
      : filteredMeters;

    if (targets.length === 0) {
      toast.error("Không có công tơ nào được chọn để chốt kỳ");
      return;
    }

    setIsLocking(true);
    try {
      const rows: HunonicLockedPeriodRow[] = targets.map((m) => ({
        buildingCode: m.buildingCode || "DEFAULT",
        roomCode: m.roomCode || "UNKNOWN",
        period: lockPeriod,
        note: lockNote,
      }));

      await hunonicApi.lockPeriods(rows);
      await mutateOverview();
      setIsLockModalOpen(false);
      toast.success(`Đã chốt kỳ số điện (${lockPeriod}) cho ${rows.length} phòng!`);
    } catch (error: any) {
      toast.error(error?.message || "Lỗi khi chốt kỳ số điện");
    } finally {
      setIsLocking(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredMeters.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    const headers = [
      "Mã phòng",
      "Tòa nhà",
      "Tên công tơ",
      "Mã MAC/Device",
      "Trạng thái",
      "Phương thức giá",
      "Công suất tức thời (W)",
      "Điện tiêu thụ tháng (kWh)",
      "Tiền điện tạm tính (VNĐ)",
      "Thời gian đọc gần nhất",
    ];

    const rows = filteredMeters.map((m) => {
      const isOnline = isMeterOnline(m);
      const energyKwh = Number(m.energyMonthKwh || m.totalKwh || m.currentKwh || 0);
      const cost = Number(m.moneyMonthVnd || m.estimatedCost || m.amount || 0);
      const powerW = Number(m.powerCurrentW || 0);
      const rateInfo = rateByRoomKey.get(m.id) || rateByRoomKey.get(`${m.buildingCode}::${m.roomCode}`);
      const isCustomRate = rateInfo?.currentMode === "custom" || m.rateMode === "custom";
      const customPrice = rateInfo?.customRateVnd || m.customRateVnd || 3500;
      const rateLabel = isCustomRate ? `Tự thiết lập (${customPrice}đ/kWh)` : "Bậc thang EVN";

      return [
        `"${m.roomCode || ""}"`,
        `"${m.buildingCode || ""}"`,
        `"${m.displayName || m.deviceName || m.name || ""}"`,
        `"${m.providerDeviceId || m.mac || m.deviceId || ""}"`,
        `"${isOnline ? "Online" : "Offline"}"`,
        `"${rateLabel}"`,
        powerW,
        energyKwh,
        cost,
        `"${formatDateTime(m.lastSyncedAt || m.lastReadingAt)}"`,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bao-cao-cong-to-dien-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đã xuất file báo cáo CSV thành công!");
  };

  const toggleColumnVisibility = (key: ColumnKey) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <AppShell>
      <div className="space-y-3.5 pb-20">
        {/* COMPACT STATS BAR: Tinh gọn, hiện đại, không chiếm diện tích */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-2.5 px-3.5 shadow-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
              <PlugZap size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Tổng công tơ</div>
              <div className="text-lg font-black text-text leading-tight">{kpis.total}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-2.5 px-3.5 shadow-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold">
              <Wifi size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Trạng thái Online</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                {kpis.online}/{kpis.total}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-2.5 px-3.5 shadow-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 font-bold">
              <Bolt size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Tiêu thụ tháng</div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 leading-tight truncate">
                {formatKwh(kpis.totalKwh)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-2.5 px-3.5 shadow-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 font-bold">
              <Zap size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Tạm tính tiền điện</div>
              <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-tight truncate">
                {formatCurrency(kpis.totalCost)}
              </div>
            </div>
          </div>
        </div>

        {/* TOOLBAR RỘNG RÃI, THOÁNG ĐÃNG: Bố cục 2 nhóm rõ ràng, không bị bí bách */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          {/* Nhóm trái: Ô tìm kiếm rộng rãi + Dropdowns bộ lọc */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[240px] flex-1 sm:max-w-xs md:max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo phòng (31.06), tòa nhà, MAC..."
                className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-8 text-xs text-text placeholder-muted focus:border-primary focus:outline-none shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Lọc Tòa nhà */}
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary shadow-sm"
            >
              <option value="ALL">Tất cả tòa nhà ({buildings.length})</option>
              {buildings.map((b) => (
                <option key={b} value={b}>
                  Tòa {b}
                </option>
              ))}
            </select>

            {/* Lọc Trạng thái */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary shadow-sm"
            >
              <option value="ALL">Trạng thái: Tất cả</option>
              <option value="ONLINE">Đang Online</option>
              <option value="OFFLINE">Đang Offline</option>
            </select>
          </div>

          {/* Nhóm phải: Các nút Thao tác & View mode switch */}
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            {/* Nút Đồng bộ */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSync}
              isLoading={isSyncing}
              className="h-9 rounded-xl px-3 text-xs font-bold shadow-sm"
              title="Đồng bộ số liệu từ Hunonic"
            >
              <RefreshCcw size={13} className="mr-1.5 text-emerald-600" /> Đồng bộ
            </Button>

            {/* Nút Chốt kỳ */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLockModalOpen(true)}
              className="h-9 rounded-xl px-3 text-xs font-bold shadow-sm"
              title="Chốt kỳ số điện"
            >
              <Lock size={13} className="mr-1.5 text-amber-500" /> Chốt kỳ
            </Button>

            {/* Nút Xuất Excel */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-9 rounded-xl px-3 text-xs font-bold shadow-sm"
              title="Xuất file CSV"
            >
              <Download size={13} className="mr-1.5 text-primary" /> Xuất Excel
            </Button>

            {/* Nút Tùy chọn Ẩn/Hiện Cột */}
            <div className="relative" ref={columnDropdownRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                className={`h-9 rounded-xl px-3 text-xs font-bold shadow-sm ${
                  isColumnDropdownOpen ? "border-primary bg-primary/5 text-primary" : ""
                }`}
                title="Tùy chỉnh cột hiển thị"
              >
                <Columns size={13} className="mr-1.5" /> Cột <ChevronDown size={11} className="ml-1 opacity-60" />
              </Button>

              {isColumnDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-40 w-52 rounded-xl border border-border bg-card p-2 shadow-xl animate-in fade-in zoom-in-95">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 py-1 border-b border-border/60">
                    Cột hiển thị
                  </div>
                  <div className="space-y-1 py-1">
                    {(Object.keys(columnLabels) as ColumnKey[]).map((colKey) => (
                      <label
                        key={colKey}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-text hover:bg-muted/20 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns[colKey]}
                          onChange={() => toggleColumnVisibility(colKey)}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>{columnLabels[colKey]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Nút Cài đặt */}
            <Link href="/settings?section=integrations">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl px-3 text-xs font-bold shadow-sm border-border"
                title="Cài đặt kết nối Hunonic"
              >
                <Settings2 size={13} className="mr-1.5" /> Cài đặt
              </Button>
            </Link>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-border bg-background p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition ${
                  viewMode === "table" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-text"
                }`}
                title="Dạng danh sách bảng"
              >
                <LayoutList size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition ${
                  viewMode === "grid" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-text"
                }`}
                title="Dạng thẻ lưới"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* FLOATING BULK ACTIONS BAR: Khi có chọn nhiều công tơ */}
        {selectedMeterIds.length > 0 && (
          <div className="sticky top-20 z-30 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-primary/40 bg-primary/10 backdrop-blur-md p-2.5 px-4 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[11px]">
                {selectedMeterIds.length}
              </span>
              <span>Đã chọn {selectedMeterIds.length} công tơ</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={() => openRateModalForSelection()}
                className="h-8 rounded-xl bg-primary text-white text-xs font-bold shadow-sm"
              >
                <Zap size={12} className="mr-1" /> Đổi giá ({selectedMeterIds.length})
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsLockModalOpen(true)}
                className="h-8 rounded-xl bg-background text-xs font-bold shadow-sm"
              >
                <Lock size={12} className="mr-1 text-amber-500" /> Chốt kỳ ({selectedMeterIds.length})
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedMeterIds([])}
                className="h-8 rounded-xl text-xs font-bold text-muted hover:text-text"
              >
                Bỏ chọn
              </Button>
            </div>
          </div>
        )}

        {/* VIEW MODE: TABLE VIEW */}
        {viewMode === "table" && (
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-2.5 px-3 w-8 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                      />
                    </th>
                    {visibleColumns.room && <th className="py-2.5 px-3">Phòng / Tòa</th>}
                    {visibleColumns.device && <th className="py-2.5 px-3">Công tơ / Thiết bị</th>}
                    {visibleColumns.status && <th className="py-2.5 px-3 text-center">Trạng thái</th>}
                    {visibleColumns.rateMode && <th className="py-2.5 px-3">Phương thức tính giá</th>}
                    {visibleColumns.power && <th className="py-2.5 px-3 text-right">Công suất</th>}
                    {visibleColumns.energy && <th className="py-2.5 px-3 text-right">Tiêu thụ tháng</th>}
                    {visibleColumns.cost && <th className="py-2.5 px-3 text-right">Tạm tính</th>}
                    {visibleColumns.lastSync && <th className="py-2.5 px-3 text-center">Cập nhật</th>}
                    {visibleColumns.actions && <th className="py-2.5 px-3 w-12 text-center">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMeters.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted">
                        <PlugZap size={32} className="mx-auto text-muted/30 mb-2" />
                        <div className="font-bold text-xs text-text">Không tìm thấy công tơ nào</div>
                        <div className="text-[11px] mt-0.5 text-muted">Thử thay đổi bộ lọc hoặc bấm Đồng bộ.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredMeters.map((meter: any) => {
                      const meterId = meter.id || meter.deviceId || meter.mac;
                      const isSelected = selectedMeterIds.includes(meterId);
                      const isOnline = isMeterOnline(meter);
                      const energyKwh = Number(meter.energyMonthKwh || meter.totalKwh || meter.currentKwh || 0);
                      const cost = Number(meter.moneyMonthVnd || meter.estimatedCost || meter.amount || 0);
                      const powerW = Number(meter.powerCurrentW || 0);
                      const rateInfo =
                        rateByRoomKey.get(meter.id) ||
                        rateByRoomKey.get(meter.providerRootId) ||
                        rateByRoomKey.get(meter.providerMeterId) ||
                        rateByRoomKey.get(`${meter.buildingCode}::${meter.roomCode}`) ||
                        rateByRoomKey.get(`${meter.buildingCode}:${meter.roomCode}`);

                      const currentMode = rateInfo?.currentMode || meter.rateMode || "residential";
                      const isCustomRate = currentMode === "custom";
                      const customPrice = rateInfo?.customRateVnd || meter.customRateVnd || 3500;
                      const isActionOpen = openActionRowId === meterId;

                      return (
                        <tr
                          key={meterId}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest("button") || target.closest("select") || target.closest("input") || target.closest("a")) {
                              return;
                            }
                            toggleSelectMeter(meterId);
                          }}
                          className={`transition-colors cursor-pointer select-none ${
                            isSelected ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/10"
                          }`}
                        >
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectMeter(meterId)}
                              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>

                          {visibleColumns.room && (
                            <td className="py-2 px-3">
                              <div className="font-black text-text text-xs">
                                {meter.roomCode ? `Phòng ${meter.roomCode}` : "Chưa gán"}
                              </div>
                              <div className="text-[10px] text-muted font-medium">
                                {meter.buildingCode ? `Tòa ${meter.buildingCode}` : "-"}
                              </div>
                            </td>
                          )}

                          {visibleColumns.device && (
                            <td className="py-2 px-3">
                              <div className="font-bold text-text truncate max-w-[170px]">
                                {meter.displayName || meter.deviceName || meter.name || "Công tơ Hunonic"}
                              </div>
                              <div className="text-[10px] font-mono text-muted">
                                MAC: {meter.providerDeviceId || meter.mac || meter.deviceId || "-"}
                              </div>
                            </td>
                          )}

                          {visibleColumns.status && (
                            <td className="py-2 px-3 text-center">
                              {isOnline ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Online
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                                  <WifiOff size={10} /> Offline
                                </span>
                              )}
                            </td>
                          )}

                          {visibleColumns.rateMode && (
                            <td className="py-2 px-3">
                              {isCustomRate ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  <Zap size={10} /> Tự thiết lập ({formatCurrency(customPrice)}/kWh)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                  <Bolt size={10} /> Bậc thang EVN
                                </span>
                              )}
                            </td>
                          )}

                          {visibleColumns.power && (
                            <td className="py-2 px-3 text-right font-mono font-bold text-muted">
                              {formatWatts(powerW)}
                            </td>
                          )}

                          {visibleColumns.energy && (
                            <td className="py-2 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                              {formatKwh(energyKwh)}
                            </td>
                          )}

                          {visibleColumns.cost && (
                            <td className="py-2 px-3 text-right font-bold text-primary">
                              {formatCurrency(cost)}
                            </td>
                          )}

                          {visibleColumns.lastSync && (
                            <td className="py-2 px-3 text-center text-[10px] text-muted truncate max-w-[120px]">
                              {formatDateTime(meter.lastSyncedAt || meter.lastReadingAt)}
                            </td>
                          )}

                          {visibleColumns.actions && (
                            <td className="py-2 px-3 text-center relative" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setOpenActionRowId(isActionOpen ? null : meterId)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-muted/20 hover:text-text mx-auto transition"
                                title="Thao tác"
                              >
                                <MoreHorizontal size={15} />
                              </button>

                              {/* Action Dropdown Menu 3 chấm */}
                              {isActionOpen && (
                                <div
                                  ref={actionDropdownRef}
                                  className="absolute right-3 top-full mt-1 z-50 w-44 rounded-xl border border-border bg-card p-1 shadow-xl animate-in fade-in zoom-in-95 text-left"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedRoomHistory(meter);
                                      setOpenActionRowId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-text hover:bg-muted/20 transition"
                                  >
                                    <History size={13} className="text-primary" /> Xem lịch sử chỉ số
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => openRateModalForSelection(meterId)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-text hover:bg-muted/20 transition"
                                  >
                                    <Zap size={13} className="text-amber-500" /> Cấu hình giá điện
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedMeterIds([meterId]);
                                      setIsLockModalOpen(true);
                                      setOpenActionRowId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-text hover:bg-muted/20 transition"
                                  >
                                    <Lock size={13} className="text-rose-500" /> Chốt kỳ phòng này
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* VIEW MODE: GRID CARD VIEW */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredMeters.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted">
                <PlugZap size={32} className="mx-auto text-muted/30 mb-2" />
                <div className="font-bold text-xs text-text">Không tìm thấy công tơ nào</div>
                <div className="text-[11px] mt-0.5 text-muted">Thay đổi bộ lọc hoặc bấm Đồng bộ.</div>
              </div>
            ) : (
              filteredMeters.map((meter: any) => {
                const meterId = meter.id || meter.deviceId || meter.mac;
                const isSelected = selectedMeterIds.includes(meterId);
                const isOnline = isMeterOnline(meter);
                const energyKwh = Number(meter.energyMonthKwh || meter.totalKwh || meter.currentKwh || 0);
                const cost = Number(meter.moneyMonthVnd || meter.estimatedCost || meter.amount || 0);
                const powerW = Number(meter.powerCurrentW || 0);
                const rateInfo =
                  rateByRoomKey.get(meter.id) ||
                  rateByRoomKey.get(meter.providerRootId) ||
                  rateByRoomKey.get(meter.providerMeterId) ||
                  rateByRoomKey.get(`${meter.buildingCode}::${meter.roomCode}`) ||
                  rateByRoomKey.get(`${meter.buildingCode}:${meter.roomCode}`);

                const currentMode = rateInfo?.currentMode || meter.rateMode || "residential";
                const isCustomRate = currentMode === "custom";
                const customPrice = rateInfo?.customRateVnd || meter.customRateVnd || 3500;

                return (
                  <Card
                    key={meterId}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("button") || target.closest("select") || target.closest("input") || target.closest("a")) {
                        return;
                      }
                      toggleSelectMeter(meterId);
                    }}
                    className={`p-3 transition-all relative flex flex-col justify-between gap-2.5 cursor-pointer select-none ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "border-border hover:border-primary/40 bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectMeter(meterId)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-black text-text">Phòng {meter.roomCode || "-"}</div>
                          <div className="text-[10px] text-muted font-medium">Tòa {meter.buildingCode || "-"}</div>
                        </div>
                      </div>

                      <div>
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                            Offline
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/50 p-2 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted">Phương thức:</span>
                        <span className="font-bold text-[10px] text-text">
                          {isCustomRate ? `Tự lập (${customPrice}đ)` : "Bậc thang EVN"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted">Công suất:</span>
                        <span className="font-mono font-bold text-text">{formatWatts(powerW)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted">Tiêu thụ tháng:</span>
                        <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatKwh(energyKwh)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-[10px] text-muted font-bold">Tạm tính:</span>
                        <span className="font-black text-primary text-xs">{formatCurrency(cost)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRoomHistory(meter)}
                        className="flex-1 h-7 rounded-lg text-[11px] font-bold text-muted hover:text-text shadow-none"
                      >
                        <History size={11} className="mr-1 text-primary" /> Lịch sử
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openRateModalForSelection(meterId)}
                        className="flex-1 h-7 rounded-lg text-[11px] font-bold text-muted hover:text-text shadow-none"
                      >
                        <Zap size={11} className="mr-1 text-amber-500" /> Giá điện
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* MODAL: Cấu hình biểu giá */}
        <Modal
          isOpen={isRateModalOpen}
          onClose={() => setIsRateModalOpen(false)}
          title="Cấu hình biểu giá điện"
          maxWidth="max-w-[520px]"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsRateModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                type="button"
                onClick={handleApplyRate}
                isLoading={isApplyingRate}
                className="bg-primary text-white font-bold"
              >
                Áp dụng biểu giá
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5">
            <div className="rounded-xl border border-border bg-background p-2.5 text-xs">
              <div className="font-bold text-text">
                Đang chọn: {selectedMeterIds.length > 0 ? selectedMeterIds.length : allFilteredIds.length} công tơ
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                Biểu giá được tự động lưu và áp dụng tính tiền điện theo từng phòng.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text">Phương thức tính tiền điện</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRateMode("residential")}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    rateMode === "residential"
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                      : "border-border bg-card text-text hover:border-primary/40"
                  }`}
                >
                  <div className="font-bold text-xs">Bậc thang EVN</div>
                  <div className="text-[10px] text-muted mt-0.5">Tính theo 6 bậc giá sinh hoạt nhà nước</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRateMode("custom")}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    rateMode === "custom"
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                      : "border-border bg-card text-text hover:border-primary/40"
                  }`}
                >
                  <div className="font-bold text-xs">Giá cố định (VND/kWh)</div>
                  <div className="text-[10px] text-muted mt-0.5">Áp dụng một mức giá đồng giá mỗi số điện</div>
                </button>
              </div>
            </div>

            {rateMode === "custom" && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Đơn giá điện cố định (VNĐ / kWh)</label>
                <Input
                  type="number"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  placeholder="3500"
                  className="h-9 text-xs font-mono font-bold"
                />
              </div>
            )}
          </div>
        </Modal>

        {/* MODAL: Chốt kỳ số điện */}
        <Modal
          isOpen={isLockModalOpen}
          onClose={() => setIsLockModalOpen(false)}
          title="Chốt kỳ số điện cho hóa đơn"
          maxWidth="max-w-[520px]"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsLockModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                type="button"
                onClick={handleLockPeriods}
                isLoading={isLocking}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Xác nhận chốt kỳ
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
              <div className="font-bold flex items-center gap-1.5">
                <Lock size={13} className="text-amber-500" /> Chốt số liệu điện
              </div>
              <div className="text-[11px] mt-0.5 leading-relaxed">
                Số điện hiện tại sẽ được đóng băng và liên kết trực tiếp vào hóa đơn tiền phòng tháng được chọn.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Kỳ hóa đơn (Năm-Tháng)</label>
              <Input
                type="month"
                value={lockPeriod}
                onChange={(e) => setLockPeriod(e.target.value)}
                className="h-9 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Ghi chú chốt kỳ</label>
              <Input
                value={lockNote}
                onChange={(e) => setLockNote(e.target.value)}
                placeholder="Ví dụ: Chốt số điện đợt 1 tháng 08"
                className="h-9 text-xs font-bold"
              />
            </div>

            <div className="text-xs text-muted">
              Áp dụng cho: <b>{selectedMeterIds.length > 0 ? `${selectedMeterIds.length} công tơ đã chọn` : `Tất cả ${filteredMeters.length} công tơ đang lọc`}</b>
            </div>
          </div>
        </Modal>

        {/* MODAL: Lịch sử chỉ số điện */}
        <Modal
          isOpen={Boolean(selectedRoomHistory)}
          onClose={() => setSelectedRoomHistory(null)}
          title={`Lịch sử chỉ số điện • Phòng ${selectedRoomHistory?.roomCode || ""}`}
          maxWidth="max-w-[700px]"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSelectedRoomHistory(null)}>
                Đóng
              </Button>
            </div>
          }
        >
          {selectedRoomHistory && (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border bg-card p-2.5">
                <div>
                  <div className="text-xs font-black text-text">
                    Phòng {selectedRoomHistory.roomCode} • Tòa {selectedRoomHistory.buildingCode}
                  </div>
                  <div className="text-[10px] text-muted font-mono mt-0.5">
                    Công tơ: {selectedRoomHistory.displayName || selectedRoomHistory.deviceName || selectedRoomHistory.name} (
                    {selectedRoomHistory.providerDeviceId || selectedRoomHistory.mac})
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                    className="h-7.5 rounded-lg border border-border bg-background px-2 text-xs font-bold text-text"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={String(m)}>
                        Tháng {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={historyYear}
                    onChange={(e) => setHistoryYear(e.target.value)}
                    className="h-7.5 rounded-lg border border-border bg-background px-2 text-xs font-bold text-text"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={String(y)}>
                        Năm {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 text-[10px] font-bold text-muted uppercase">
                    <tr>
                      <th className="py-2 px-3">Thời gian ghi</th>
                      <th className="py-2 px-3 text-right">Công suất (W)</th>
                      <th className="py-2 px-3 text-right">Tiêu thụ tháng (kWh)</th>
                      <th className="py-2 px-3 text-center">Trạng thái chốt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoadingHistory ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-muted">
                          Đang tải lịch sử chỉ số...
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td className="py-2 px-3 font-mono text-[11px]">
                          {formatDateTime(selectedRoomHistory.lastSyncedAt || selectedRoomHistory.lastReadingAt || new Date().toISOString())}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-text">
                          {formatWatts(selectedRoomHistory.powerCurrentW)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatKwh(selectedRoomHistory.energyMonthKwh || selectedRoomHistory.totalKwh || selectedRoomHistory.currentKwh)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} /> Tự động
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
}
