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
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  History,
  Info,
  Lock,
  PlugZap,
  RefreshCcw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Unlock,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { hunonicApi, HunonicRateApplyPayload } from "@/lib/api/hunonic.api";
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

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");

  // Actions states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [rateMode, setRateMode] = useState<"residential" | "custom">("residential");
  const [customRate, setCustomRate] = useState("3500");
  const [selectedMeterIds, setSelectedMeterIds] = useState<string[]>([]);
  const [isApplyingRate, setIsApplyingRate] = useState(false);

  // History modal
  const [selectedRoomHistory, setSelectedRoomHistory] = useState<any | null>(null);
  const [historyYear, setHistoryYear] = useState<string>(String(new Date().getFullYear()));
  const [historyMonth, setHistoryMonth] = useState<string>(String(new Date().getMonth() + 1));
  const { data: historyRes, mutate: mutateHistory, isLoading: isLoadingHistory } = useSWR(
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
    const totalKwh = meters.reduce((acc, m) => acc + (Number(m.totalKwh || m.currentKwh || m.kwh || 0) - Number(m.startKwh || 0)), 0);
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

  const handleOpenRateModal = (meterId?: string) => {
    if (meterId) {
      setSelectedMeterIds([meterId]);
    } else {
      setSelectedMeterIds(filteredMeters.map((m) => m.id || m.deviceId || m.mac));
    }
    setIsRateModalOpen(true);
  };

  const handleApplyRate = async () => {
    if (selectedMeterIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 công tơ");
      return;
    }
    setIsApplyingRate(true);
    try {
      const payload: HunonicRateApplyPayload = {
        meterIds: selectedMeterIds,
        mode: rateMode,
        customRateVnd: rateMode === "custom" ? Number(customRate || 0) : undefined,
      };
      await hunonicApi.applyRates(payload);
      await mutateRates();
      await mutateOverview();
      setIsRateModalOpen(false);
      toast.success(`Đã áp dụng biểu giá cho ${selectedMeterIds.length} công tơ!`);
    } catch (error: any) {
      toast.error(error?.message || "Lỗi khi áp dụng biểu giá");
    } finally {
      setIsApplyingRate(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black">
                <PlugZap size={18} />
              </span>
              <h1 className="text-2xl font-black tracking-tight text-text">Công tơ điện & Chỉ số năng lượng</h1>
            </div>
            <p className="text-xs text-muted mt-1">
              Theo dõi trực tiếp chỉ số công tơ điện thông minh, biểu đồ tiêu thụ và chốt số điện theo từng phòng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleSync}
              isLoading={isSyncing}
              className="h-10 rounded-xl px-4 text-xs font-bold shadow-sm"
            >
              <RefreshCcw size={14} className="mr-1.5 text-emerald-600" /> Đồng bộ số liệu
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenRateModal()}
              className="h-10 rounded-xl px-4 text-xs font-bold shadow-sm"
            >
              <Zap size={14} className="mr-1.5 text-amber-500" /> Cấu hình giá điện
            </Button>
            <Link href="/settings?section=integrations">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl px-4 text-xs font-bold shadow-sm border-border hover:border-primary"
              >
                <Settings2 size={14} className="mr-1.5" /> Cài đặt kết nối
              </Button>
            </Link>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 border-border/80 bg-card/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
              <span>Tổng số công tơ</span>
              <PlugZap size={15} className="text-primary" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-text">{kpis.total}</div>
              <div className="mt-1 text-[11px] text-muted flex items-center gap-1">
                <span>{buildings.length} tòa nhà đã kết nối</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
              <span>Trạng thái Online</span>
              <Wifi size={15} className="text-emerald-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {kpis.online}/{kpis.total}
              </div>
              <div className="mt-1 text-[11px] text-muted flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{kpis.offline > 0 ? `${kpis.offline} thiết bị đang offline` : "Tất cả đang hoạt động tốt"}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
              <span>Điện năng trong kỳ</span>
              <Bolt size={15} className="text-amber-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {formatKwh(kpis.totalKwh)}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                Cập nhật: {formatDateTime(overview.lastSyncAt)}
              </div>
            </div>
          </Card>

          <Card className="p-4 border-border/80 bg-card/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted text-xs font-bold uppercase tracking-wider">
              <span>Tiền điện tạm tính</span>
              <Zap size={15} className="text-indigo-500" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {formatCurrency(kpis.totalCost)}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                Theo biểu giá phòng & bậc thang
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã phòng, tòa nhà, mã công tơ..."
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs text-text placeholder-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Building filter */}
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary"
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
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ONLINE">Đang Online</option>
              <option value="OFFLINE">Đang Offline</option>
            </select>
          </div>
        </div>

        {/* Meters Table */}
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-3 px-4">Phòng / Tòa nhà</th>
                  <th className="py-3 px-4">Công tơ / Thiết bị</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Chỉ số đầu kỳ</th>
                  <th className="py-3 px-4 text-right">Chỉ số hiện tại</th>
                  <th className="py-3 px-4 text-right">Điện tiêu thụ</th>
                  <th className="py-3 px-4 text-right">Tạm tính</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMeters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      <PlugZap size={32} className="mx-auto text-muted/40 mb-2" />
                      <div className="font-bold">Không tìm thấy công tơ điện nào</div>
                      <div className="text-[11px] mt-0.5">
                        Hãy kiểm tra kết nối Hunonic hoặc thay đổi bộ lọc tìm kiếm.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMeters.map((meter: any) => {
                    const isOnline = Boolean(meter.isOnline || meter.status === "online");
                    const startKwh = Number(meter.startKwh || 0);
                    const currentKwh = Number(meter.totalKwh || meter.currentKwh || meter.kwh || 0);
                    const deltaKwh = Math.max(0, currentKwh - startKwh);
                    const cost = Number(meter.estimatedCost || meter.amount || 0);

                    return (
                      <tr key={meter.id || meter.mac || meter.deviceId} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-black text-text text-sm">
                            {meter.roomCode || "Chưa gắn phòng"}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5">
                            {meter.buildingName || meter.buildingCode ? `Tòa ${meter.buildingCode}` : "Chưa gắn tòa"}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-text truncate max-w-[180px]">
                            {meter.name || meter.meterName || "Công tơ điện"}
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
                              className="h-8 rounded-lg px-2.5 text-xs font-bold text-muted hover:text-text"
                              title="Xem lịch sử chỉ số"
                            >
                              <History size={13} className="mr-1 text-primary" /> Lịch sử
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRateModal(meter.id || meter.deviceId || meter.mac)}
                              className="h-8 rounded-lg px-2.5 text-xs font-bold text-muted hover:text-text"
                              title="Đổi biểu giá phòng"
                            >
                              <Zap size={13} className="mr-1 text-amber-500" /> Giá
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
              <Button type="button" onClick={handleApplyRate} isLoading={isApplyingRate} className="bg-primary text-white font-bold">
                Áp dụng biểu giá
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-background p-3 text-xs">
              <div className="font-bold text-text">Đang chọn: {selectedMeterIds.length} công tơ</div>
              <div className="text-[11px] text-muted mt-0.5">Biểu giá sẽ được áp dụng khi tính toán tiền điện hàng tháng.</div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text">Phương thức tính tiền điện</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRateMode("residential")}
                  className={`rounded-xl border p-3 text-left transition ${
                    rateMode === "residential"
                      ? "border-primary bg-primary/5 text-primary"
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
                      ? "border-primary bg-primary/5 text-primary"
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
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
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
                        <td className="py-2.5 px-3 font-mono">{formatDateTime(selectedRoomHistory.lastReadingAt || new Date().toISOString())}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {formatKwh(selectedRoomHistory.totalKwh || selectedRoomHistory.currentKwh)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-amber-600">
                          {formatKwh(Number(selectedRoomHistory.totalKwh || selectedRoomHistory.currentKwh || 0) - Number(selectedRoomHistory.startKwh || 0))}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
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
