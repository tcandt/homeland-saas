"use client";

import React, { useMemo, useState } from "react";
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
  ChevronRight,
  Clock,
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
  PlugZap,
  RefreshCcw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
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

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa có";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
}

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

  const rawOverview = overviewRes as any;
  const overview = rawOverview?.data || rawOverview || {};
  const meters: any[] = Array.isArray(overview.meters) ? overview.meters : [];

  const buildings: string[] = useMemo(() => {
    const list = new Set<string>();
    meters.forEach((m) => {
      if (m.buildingCode) list.add(m.buildingCode);
    });
    return Array.from(list).sort();
  }, [meters]);

  const kpis = useMemo(() => {
    const total = meters.length;
    const online = meters.filter((m) => m.isOnline || m.status === "online").length;
    const totalKwh = meters.reduce(
      (acc, m) => acc + (Number(m.totalKwh || m.currentKwh || m.kwh || 0) - Number(m.startKwh || 0)),
      0,
    );
    const totalCost = meters.reduce((acc, m) => acc + Number(m.estimatedCost || m.amount || 0), 0);
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
        (m.name || m.meterName || "").toLowerCase().includes(q) ||
        (m.mac || m.deviceId || "").toLowerCase().includes(q);

      const matchBuilding = selectedBuilding === "ALL" || m.buildingCode === selectedBuilding;

      const isOnline = Boolean(m.isOnline || m.status === "online");
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ONLINE" && isOnline) ||
        (statusFilter === "OFFLINE" && !isOnline);

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
      "Mã MAC",
      "Trạng thái",
      "Chỉ số đầu kỳ (kWh)",
      "Chỉ số hiện tại (kWh)",
      "Tiêu thụ trong kỳ (kWh)",
      "Tiền điện tạm tính (VNĐ)",
      "Thời gian đọc gần nhất",
    ];

    const rows = filteredMeters.map((m) => {
      const isOnline = Boolean(m.isOnline || m.status === "online");
      const startKwh = Number(m.startKwh || 0);
      const currentKwh = Number(m.totalKwh || m.currentKwh || m.kwh || 0);
      const deltaKwh = Math.max(0, currentKwh - startKwh);
      const cost = Number(m.estimatedCost || m.amount || 0);

      return [
        `"${m.roomCode || ""}"`,
        `"${m.buildingCode || ""}"`,
        `"${m.name || m.meterName || ""}"`,
        `"${m.mac || m.deviceId || ""}"`,
        `"${isOnline ? "Online" : "Offline"}"`,
        startKwh,
        currentKwh,
        deltaKwh,
        cost,
        `"${formatDateTime(m.lastReadingAt)}"`,
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

  return (
    <AppShell>
      <div className="space-y-5 pb-24">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black shadow-sm">
                <PlugZap size={18} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-text">Công tơ điện & Chỉ số năng lượng</h1>
            </div>
            <p className="text-xs text-muted">
              Theo dõi realtime công tơ thông minh, thiết lập biểu giá, đối soát và chốt số điện tự động theo từng phòng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSync}
              isLoading={isSyncing}
              className="h-9 rounded-xl px-3.5 text-xs font-bold shadow-sm"
            >
              <RefreshCcw size={13} className="mr-1.5 text-emerald-600" /> Đồng bộ số liệu
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLockModalOpen(true)}
              className="h-9 rounded-xl px-3.5 text-xs font-bold shadow-sm"
            >
              <Lock size={13} className="mr-1.5 text-amber-500" /> Chốt kỳ số điện
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              className="h-9 rounded-xl px-3.5 text-xs font-bold shadow-sm"
            >
              <Download size={13} className="mr-1.5 text-primary" /> Xuất Excel
            </Button>

            <Link href="/settings?section=integrations">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl px-3.5 text-xs font-bold shadow-sm border-border hover:border-primary"
              >
                <Settings2 size={13} className="mr-1.5" /> Cài đặt kết nối
              </Button>
            </Link>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 border-border/80 bg-card shadow-sm flex flex-col justify-between hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
              <span>Tổng số công tơ</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PlugZap size={15} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-text">{kpis.total}</div>
              <div className="mt-1 text-[11px] text-muted flex items-center gap-1">
                <span>{buildings.length} tòa nhà đang kết nối</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition">
            <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
              <span>Trạng thái Online</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Wifi size={15} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {kpis.online}/{kpis.total}
              </div>
              <div className="mt-1 text-[11px] text-muted flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{kpis.offline > 0 ? `${kpis.offline} thiết bị offline` : "100% hoạt động tốt"}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card shadow-sm flex flex-col justify-between hover:border-amber-500/40 transition">
            <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
              <span>Điện năng trong kỳ</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Bolt size={15} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {formatKwh(kpis.totalKwh)}
              </div>
              <div className="mt-1 text-[11px] text-muted truncate">
                Cập nhật: {formatDateTime(overview.lastSyncAt)}
              </div>
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card shadow-sm flex flex-col justify-between hover:border-indigo-500/40 transition">
            <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
              <span>Tiền điện tạm tính</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                <Zap size={15} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {formatCurrency(kpis.totalCost)}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                Theo bậc thang & giá cố định
              </div>
            </div>
          </Card>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between shadow-sm">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo phòng (31.06), tòa nhà (LK01), mã công tơ, MAC..."
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-8 text-xs text-text placeholder-muted focus:border-primary focus:outline-none"
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Building filter */}
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary"
            >
              <option value="ALL">Tất cả tòa nhà ({buildings.length})</option>
              {buildings.map((b) => (
                <option key={b} value={b}>
                  Tòa {b}
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ONLINE">Đang Online</option>
              <option value="OFFLINE">Đang Offline</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition ${
                  viewMode === "table" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-text"
                }`}
                title="Dạng bảng chi tiết"
              >
                <LayoutList size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition ${
                  viewMode === "grid" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-text"
                }`}
                title="Dạng lưới thẻ"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedMeterIds.length > 0 && (
          <div className="sticky top-20 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 backdrop-blur-md p-3 px-4 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[11px]">
                {selectedMeterIds.length}
              </span>
              <span>Đang chọn {selectedMeterIds.length} công tơ</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => openRateModalForSelection()}
                className="h-8 rounded-xl bg-primary text-white text-xs font-bold shadow-sm"
              >
                <Zap size={13} className="mr-1" /> Áp dụng giá ({selectedMeterIds.length})
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsLockModalOpen(true)}
                className="h-8 rounded-xl bg-background text-xs font-bold shadow-sm"
              >
                <Lock size={13} className="mr-1 text-amber-500" /> Chốt kỳ ({selectedMeterIds.length})
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

        {/* View Mode: TABLE VIEW */}
        {viewMode === "table" && (
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 px-4 w-10 text-center">
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
                    <th className="py-3 px-4">Phòng / Tòa nhà</th>
                    <th className="py-3 px-4">Công tơ / Thiết bị</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Chỉ số đầu</th>
                    <th className="py-3 px-4 text-right">Chỉ số hiện tại</th>
                    <th className="py-3 px-4 text-right">Tiêu thụ</th>
                    <th className="py-3 px-4 text-right">Tạm tính</th>
                    <th className="py-3 px-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMeters.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-muted">
                        <PlugZap size={36} className="mx-auto text-muted/30 mb-2" />
                        <div className="font-bold text-sm text-text">Không tìm thấy công tơ điện phù hợp</div>
                        <div className="text-[11px] mt-1 text-muted">
                          Thử thay đổi bộ lọc hoặc bấm "Đồng bộ số liệu" để cập nhật danh sách mới nhất.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMeters.map((meter: any) => {
                      const meterId = meter.id || meter.deviceId || meter.mac;
                      const isSelected = selectedMeterIds.includes(meterId);
                      const isOnline = Boolean(meter.isOnline || meter.status === "online");
                      const startKwh = Number(meter.startKwh || 0);
                      const currentKwh = Number(meter.totalKwh || meter.currentKwh || meter.kwh || 0);
                      const deltaKwh = Math.max(0, currentKwh - startKwh);
                      const cost = Number(meter.estimatedCost || meter.amount || 0);

                      return (
                        <tr
                          key={meterId}
                          className={`transition-colors ${
                            isSelected ? "bg-primary/5" : "hover:bg-muted/10"
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectMeter(meterId)}
                              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-black text-text text-sm flex items-center gap-1.5">
                              <span>Phòng {meter.roomCode || "Chưa gán"}</span>
                            </div>
                            <div className="text-[11px] text-muted font-medium mt-0.5">
                              {meter.buildingCode ? `Tòa ${meter.buildingCode}` : "Chưa gắn tòa"}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-text truncate max-w-[190px]">
                              {meter.name || meter.meterName || "Công tơ Hunonic"}
                            </div>
                            <div className="text-[10px] font-mono text-muted mt-0.5">
                              MAC: {meter.mac || meter.deviceId || "-"}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                                <WifiOff size={11} /> Offline
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-muted">
                            {formatKwh(startKwh)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-black text-text">
                            {formatKwh(currentKwh)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                            {formatKwh(deltaKwh)}
                          </td>

                          <td className="py-3 px-4 text-right font-bold text-primary">
                            {formatCurrency(cost)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedRoomHistory(meter)}
                                className="h-7.5 rounded-lg px-2 text-[11px] font-bold text-muted hover:text-text shadow-none"
                                title="Xem lịch sử chỉ số"
                              >
                                <History size={12} className="mr-1 text-primary" /> Lịch sử
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openRateModalForSelection(meterId)}
                                className="h-7.5 rounded-lg px-2 text-[11px] font-bold text-muted hover:text-text shadow-none"
                                title="Đổi biểu giá"
                              >
                                <Zap size={12} className="mr-1 text-amber-500" /> Giá
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* View Mode: GRID CARD VIEW */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredMeters.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted">
                <PlugZap size={36} className="mx-auto text-muted/30 mb-2" />
                <div className="font-bold text-sm text-text">Không tìm thấy công tơ điện nào</div>
                <div className="text-[11px] mt-1 text-muted">Thay đổi bộ lọc tìm kiếm hoặc đồng bộ số liệu.</div>
              </div>
            ) : (
              filteredMeters.map((meter: any) => {
                const meterId = meter.id || meter.deviceId || meter.mac;
                const isSelected = selectedMeterIds.includes(meterId);
                const isOnline = Boolean(meter.isOnline || meter.status === "online");
                const startKwh = Number(meter.startKwh || 0);
                const currentKwh = Number(meter.totalKwh || meter.currentKwh || meter.kwh || 0);
                const deltaKwh = Math.max(0, currentKwh - startKwh);
                const cost = Number(meter.estimatedCost || meter.amount || 0);

                return (
                  <Card
                    key={meterId}
                    className={`p-4 transition-all relative flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "border-border hover:border-primary/40 bg-card"
                    }`}
                  >
                    {/* Top Row: Room & Checkbox */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectMeter(meterId)}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer mt-0.5"
                        />
                        <div>
                          <div className="text-base font-black text-text">Phòng {meter.roomCode || "-"}</div>
                          <div className="text-[11px] text-muted font-medium">Tòa {meter.buildingCode || "-"}</div>
                        </div>
                      </div>

                      <div>
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                            Offline
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meter Info Box */}
                    <div className="rounded-xl border border-border/80 bg-background/60 p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] text-muted">Chỉ số hiện tại:</span>
                        <span className="font-mono font-black text-text">{formatKwh(currentKwh)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] text-muted">Tiêu thụ trong kỳ:</span>
                        <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatKwh(deltaKwh)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <span className="text-[11px] text-muted font-bold">Tạm tính:</span>
                        <span className="font-black text-primary text-sm">{formatCurrency(cost)}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRoomHistory(meter)}
                        className="flex-1 h-8 rounded-xl text-xs font-bold text-muted hover:text-text"
                      >
                        <History size={12} className="mr-1 text-primary" /> Lịch sử
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openRateModalForSelection(meterId)}
                        className="flex-1 h-8 rounded-xl text-xs font-bold text-muted hover:text-text"
                      >
                        <Zap size={12} className="mr-1 text-amber-500" /> Giá điện
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Modal: Cấu hình biểu giá */}
        <Modal
          isOpen={isRateModalOpen}
          onClose={() => setIsRateModalOpen(false)}
          title="Cấu hình biểu giá điện"
          maxWidth="max-w-[560px]"
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
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-background p-3 text-xs">
              <div className="font-bold text-text">
                Đang chọn: {selectedMeterIds.length > 0 ? selectedMeterIds.length : allFilteredIds.length} công tơ
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                Biểu giá được lưu và tự động áp dụng khi tính toán chi phí điện theo từng phòng.
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text">Phương thức tính tiền điện</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRateMode("residential")}
                  className={`rounded-xl border p-3 text-left transition ${
                    rateMode === "residential"
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                      : "border-border bg-card text-text hover:border-primary/40"
                  }`}
                >
                  <div className="font-bold text-xs">Bậc thang EVN</div>
                  <div className="text-[11px] text-muted mt-0.5">Tính theo 6 bậc giá sinh hoạt nhà nước</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRateMode("custom")}
                  className={`rounded-xl border p-3 text-left transition ${
                    rateMode === "custom"
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                      : "border-border bg-card text-text hover:border-primary/40"
                  }`}
                >
                  <div className="font-bold text-xs">Giá cố định (VND/kWh)</div>
                  <div className="text-[11px] text-muted mt-0.5">Áp dụng một mức giá đồng giá cho mỗi số điện</div>
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
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>
            )}
          </div>
        </Modal>

        {/* Modal: Chốt kỳ số điện */}
        <Modal
          isOpen={isLockModalOpen}
          onClose={() => setIsLockModalOpen(false)}
          title="Chốt kỳ số điện cho hóa đơn"
          maxWidth="max-w-[560px]"
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
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="font-bold flex items-center gap-1.5">
                <Lock size={14} className="text-amber-500" /> Chốt số liệu điện
              </div>
              <div className="text-[11px] mt-1 leading-relaxed">
                Khi chốt kỳ, chỉ số điện hiện tại sẽ được đóng băng và liên kết trực tiếp vào hóa đơn tiền phòng tháng được chọn.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Kỳ hóa đơn (Năm-Tháng)</label>
              <Input
                type="month"
                value={lockPeriod}
                onChange={(e) => setLockPeriod(e.target.value)}
                className="h-10 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Ghi chú chốt kỳ</label>
              <Input
                value={lockNote}
                onChange={(e) => setLockNote(e.target.value)}
                placeholder="Ví dụ: Chốt số điện đợt 1 tháng 08"
                className="h-10 text-xs font-bold"
              />
            </div>

            <div className="text-xs text-muted">
              Áp dụng cho: <b>{selectedMeterIds.length > 0 ? `${selectedMeterIds.length} công tơ đã chọn` : `Tất cả ${filteredMeters.length} công tơ đang lọc`}</b>
            </div>
          </div>
        </Modal>

        {/* Modal: Lịch sử chỉ số điện */}
        <Modal
          isOpen={Boolean(selectedRoomHistory)}
          onClose={() => setSelectedRoomHistory(null)}
          title={`Lịch sử chỉ số điện • Phòng ${selectedRoomHistory?.roomCode || ""}`}
          maxWidth="max-w-[760px]"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSelectedRoomHistory(null)}>
                Đóng
              </Button>
            </div>
          }
        >
          {selectedRoomHistory && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div>
                  <div className="text-xs font-black text-text">
                    Phòng {selectedRoomHistory.roomCode} • Tòa {selectedRoomHistory.buildingCode}
                  </div>
                  <div className="text-[11px] text-muted font-mono mt-0.5">
                    Công tơ: {selectedRoomHistory.name || selectedRoomHistory.meterName} ({selectedRoomHistory.mac})
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-bold text-text"
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
                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-bold text-text"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={String(y)}>
                        Năm {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* History records table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 text-[11px] font-bold text-muted uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Thời gian ghi</th>
                      <th className="py-2.5 px-3 text-right">Chỉ số (kWh)</th>
                      <th className="py-2.5 px-3 text-right">Tiêu thụ</th>
                      <th className="py-2.5 px-3 text-center">Trạng thái chốt</th>
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
                        <td className="py-2.5 px-3 font-mono">
                          {formatDateTime(selectedRoomHistory.lastReadingAt || new Date().toISOString())}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-text">
                          {formatKwh(selectedRoomHistory.totalKwh || selectedRoomHistory.currentKwh)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                          {formatKwh(
                            Number(selectedRoomHistory.totalKwh || selectedRoomHistory.currentKwh || 0) -
                              Number(selectedRoomHistory.startKwh || 0),
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={12} /> Tự động
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
