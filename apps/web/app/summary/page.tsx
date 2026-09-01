"use client";

import React, { useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  AlertCircle,
  ArrowRight,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  LayoutGrid,
  Lock,
  MessageSquare,
  PlugZap,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  useMonthlySettlementOverviewQuery,
  useCloseMonthMutation,
  useSendMonthlyNotificationsMutation,
  useResendSingleNotificationMutation,
} from "@/lib/queries/monthly-settlement.queries";
import { RoomSettlementItem } from "@/lib/api/monthly-settlement.api";
import MonthlySettlementTable from "@/components/summary/MonthlySettlementTable";
import RoomSettlementDetailDrawer from "@/components/summary/RoomSettlementDetailDrawer";
import SettlementSettingsModal from "@/components/summary/SettlementSettingsModal";
import { ElectricityManagerContent } from "@/app/electricity/page";
import toast from "react-hot-toast";

function formatVnd(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function getVietnamCurrentPeriod() {
  const utc = Date.now() + new Date().getTimezoneOffset() * 60000;
  const vn = new Date(utc + 7 * 3600000);
  const y = vn.getFullYear();
  const m = String(vn.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function OperationsSummaryPage() {
  // Main Sub-Tab: "management" (Quản lý) | "meters" (Công tơ điện)
  const [activeMainTab, setActiveMainTab] = useState<"management" | "meters">("management");

  // Filters state
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getVietnamCurrentPeriod());
  const [selectedBuilding, setSelectedBuilding] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<string>("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("ALL");

  // Selection & Detail Drawer
  const [selectedRoomItem, setSelectedRoomItem] = useState<RoomSettlementItem | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Settings Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Confirmation Modals
  const [isCloseMonthModalOpen, setIsCloseMonthModalOpen] = useState(false);
  const [closeMonthAutoSend, setCloseMonthAutoSend] = useState(false);

  // Queries & Mutations
  const { data: overviewData, isLoading: isLoadingOverview, refetch } = useMonthlySettlementOverviewQuery({
    period: selectedPeriod,
    buildingId: selectedBuilding,
    search: searchQuery,
    notificationStatus: notificationStatusFilter,
    paymentStatus: paymentStatusFilter,
  });

  const closeMonthMutation = useCloseMonthMutation();
  const sendNotificationsMutation = useSendMonthlyNotificationsMutation();
  const resendSingleMutation = useResendSingleNotificationMutation();

  const [resendingRoomId, setResendingRoomId] = useState<string | null>(null);

  const buildings = overviewData?.buildings || [];
  const stats = overviewData?.stats || {
    totalRooms: 0,
    occupiedRooms: 0,
    totalAmount: 0,
    sentZaloCount: 0,
    pendingCount: 0,
    failedCount: 0,
    paidCount: 0,
    totalPaidAmount: 0,
    collectionRate: 0,
  };
  const items = overviewData?.items || [];

  // Generate Year & Month Options
  const periodOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    for (let y = currentYear; y >= currentYear - 1; y--) {
      for (let m = 12; m >= 1; m--) {
        const p = `${y}-${String(m).padStart(2, "0")}`;
        options.push({
          value: p,
          label: `Tháng ${String(m).padStart(2, "0")}/${y}`,
        });
      }
    }
    return options;
  }, []);

  const handleRowClick = (item: RoomSettlementItem) => {
    setSelectedRoomItem(item);
    setIsDetailDrawerOpen(true);
  };

  const handleResendSingle = async (roomId: string) => {
    setResendingRoomId(roomId);
    try {
      await resendSingleMutation.mutateAsync({
        roomId,
        period: selectedPeriod,
      });
      toast.success("Đã gửi thông báo thanh toán qua Zalo thành công!");
    } catch (err: any) {
      toast.error(err?.message || "Gửi thông báo Zalo thất bại.");
    } finally {
      setResendingRoomId(null);
    }
  };

  const handleConfirmCloseMonth = async () => {
    try {
      const res = await closeMonthMutation.mutateAsync({
        period: selectedPeriod,
        autoSend: closeMonthAutoSend,
      });
      toast.success(
        `Đã chốt kỳ ${selectedPeriod} cho ${res.settledCount} phòng!${
          res.sentCount > 0 ? ` (Đã gửi ${res.sentCount} thông báo Zalo)` : ""
        }`,
      );
      setIsCloseMonthModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Lỗi khi thực hiện chốt tháng.");
    }
  };

  const handleSendAllZalo = async () => {
    if (items.length === 0) {
      toast.error("Không có phòng nào để gửi thông báo.");
      return;
    }
    try {
      const res = await sendNotificationsMutation.mutateAsync({
        period: selectedPeriod,
      });
      toast.success(
        `Đã gửi thông báo qua Zalo: ${res.sentCount} thành công, ${res.failedCount} thất bại.`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Lỗi khi gửi thông báo Zalo hàng loạt.");
    }
  };

  const handleExportCsv = () => {
    if (items.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    const headers = [
      "STT",
      "Mã phòng",
      "Tòa nhà",
      "Tầng",
      "Khách đại diện",
      "Số điện thoại",
      "Số thành viên",
      "Tiền phòng",
      "Điện tiêu thụ (kWh)",
      "Tiền điện",
      "Nước & Dịch vụ",
      "Tổng tiền",
      "Trạng thái gửi Zalo",
      "Trạng thái thanh toán",
      "Mã hóa đơn",
    ];

    const rows = items.map((item: RoomSettlementItem, idx: number) => [
      idx + 1,
      `"${item.roomCode}"`,
      `"${item.buildingName}"`,
      item.floorLevel,
      `"${item.representative?.fullName || "Chưa có"}"`,
      `"${item.representative?.phone || ""}"`,
      item.membersCount,
      item.roomPrice,
      item.electricityKwh,
      item.electricityAmount,
      item.waterAmount + item.serviceAmount,
      item.totalAmount,
      `"${item.notificationStatus === "SENT_ZALO" ? "Đã gửi qua Zalo" : item.notificationStatus === "FAILED" ? "Gửi thất bại" : "Chưa gửi"}"`,
      `"${item.paymentStatus === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"}"`,
      `"${item.invoiceCode}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `chot-thang-tong-hop-${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đã xuất file báo cáo tổng hợp CSV thành công!");
  };

  return (
    <AppShell>
      <div className="space-y-4 pb-20">
        {/* HEADER TAB SWITCHER: Quản lý vs Công tơ điện */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-xs">
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/80">
            <button
              type="button"
              onClick={() => setActiveMainTab("management")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeMainTab === "management"
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <FileSpreadsheet size={15} />
              Quản lý Chốt tháng & Thông báo
            </button>
            <button
              type="button"
              onClick={() => setActiveMainTab("meters")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeMainTab === "meters"
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <PlugZap size={15} />
              Công tơ điện thông minh
            </button>
          </div>

          {activeMainTab === "management" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsModalOpen(true)}
                className="h-9 rounded-xl font-bold text-xs gap-1.5 shadow-xs"
                title="Cài đặt lịch chốt ngày cuối tháng & gửi 08:00 ngày 01"
              >
                <Settings2 size={14} className="text-primary" />
                <span className="hidden sm:inline">Lịch chốt & gửi tự động (08:00 ngày 01)</span>
                <span className="sm:hidden">Cài đặt</span>
              </Button>
            </div>
          )}
        </div>

        {/* TAB 1: QUẢN LÝ CHỐT THÁNG & THÔNG BÁO THANH TOÁN */}
        {activeMainTab === "management" && (
          <div className="space-y-3.5">
            {/* KPI STATS CARDS: Đầy đủ, nổi bật, thông minh */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {/* Card 1: Tổng tiền chốt */}
              <div className="rounded-2xl border border-border bg-card p-3 shadow-xs">
                <div className="flex items-center justify-between text-muted mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Tổng tiền chốt kỳ</span>
                  <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Wallet size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-text truncate">
                  {formatVnd(stats.totalAmount)}
                </div>
                <div className="text-[10px] text-muted font-semibold mt-0.5">
                  {stats.occupiedRooms}/{stats.totalRooms} phòng có khách
                </div>
              </div>

              {/* Card 2: Đã gửi qua Zalo */}
              <div className="rounded-2xl border border-border bg-card p-3 shadow-xs">
                <div className="flex items-center justify-between text-muted mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Đã gửi qua Zalo
                  </span>
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {stats.sentZaloCount} phòng
                </div>
                <div className="text-[10px] text-muted font-semibold mt-0.5">
                  Đã nhận thông báo & QR
                </div>
              </div>

              {/* Card 3: Chưa gửi / Chờ gửi */}
              <div className="rounded-2xl border border-border bg-card p-3 shadow-xs">
                <div className="flex items-center justify-between text-muted mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Chưa gửi / Chờ gửi
                  </span>
                  <div className="h-6 w-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Clock size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                  {stats.pendingCount} phòng
                </div>
                <div className="text-[10px] text-muted font-semibold mt-0.5">
                  Hẹn gửi: 08:00 ngày 01
                </div>
              </div>

              {/* Card 4: Gửi thất bại */}
              <div className="rounded-2xl border border-border bg-card p-3 shadow-xs">
                <div className="flex items-center justify-between text-muted mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Gửi thất bại
                  </span>
                  <div className="h-6 w-6 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                    <AlertCircle size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                  {stats.failedCount} phòng
                </div>
                <div className="text-[10px] text-muted font-semibold mt-0.5">
                  Cần kiểm tra SĐT/Zalo
                </div>
              </div>

              {/* Card 5: Đã thu tiền */}
              <div className="rounded-2xl border border-border bg-card p-3 shadow-xs">
                <div className="flex items-center justify-between text-muted mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Đã thanh toán
                  </span>
                  <div className="h-6 w-6 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <UserCheck size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                  {stats.paidCount} phòng
                </div>
                <div className="text-[10px] text-muted font-semibold mt-0.5">
                  {formatVnd(stats.totalPaidAmount)}
                </div>
              </div>

              {/* Card 6: Tỷ lệ thu hồi */}
              <div className="rounded-2xl border border-border bg-card p-3 shadow-xs">
                <div className="flex items-center justify-between text-muted mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Tỷ lệ thu hồi
                  </span>
                  <div className="h-6 w-6 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                    <Zap size={13} />
                  </div>
                </div>
                <div className="text-lg font-black text-text">
                  {stats.collectionRate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted font-semibold mt-0.5">
                  Tiến độ thu tiền kỳ
                </div>
              </div>
            </div>

            {/* TOOLBAR: Bộ lọc & Nút hành động */}
            <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
              {/* Nhóm lọc trái */}
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Chọn kỳ tháng */}
                <div className="flex items-center gap-1.5 bg-background border border-border px-2.5 py-1 rounded-xl shadow-xs">
                  <Calendar size={13} className="text-primary shrink-0" />
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="bg-transparent text-xs font-black text-text outline-none cursor-pointer"
                  >
                    {periodOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chọn Tòa nhà */}
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
                  className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary shadow-xs"
                >
                  <option value="ALL">Tất cả tòa nhà ({buildings.length})</option>
                  {buildings.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      Tòa {b.name || b.code}
                    </option>
                  ))}
                </select>

                {/* Lọc Trạng thái gửi */}
                <select
                  value={notificationStatusFilter}
                  onChange={(e) => setNotificationStatusFilter(e.target.value)}
                  className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary shadow-xs"
                >
                  <option value="ALL">Trạng thái gửi: Tất cả</option>
                  <option value="SENT_ZALO">Đã gửi qua Zalo</option>
                  <option value="PENDING">Chưa gửi / Chờ gửi</option>
                  <option value="FAILED">Gửi thất bại</option>
                </select>

                {/* Tìm kiếm */}
                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm phòng (301), tên khách, SĐT..."
                    className="h-9 w-full rounded-xl border border-border bg-background pl-8 pr-7 text-xs text-text placeholder-muted focus:border-primary focus:outline-none shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Nhóm nút hành động phải */}
              <div className="flex flex-wrap items-center gap-1.5 justify-end">
                {/* Nút Chốt tháng ngay */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCloseMonthModalOpen(true)}
                  className="h-9 rounded-xl px-3 text-xs font-black shadow-xs gap-1 text-amber-600 hover:bg-amber-500/10 border-amber-500/30"
                  title="Chốt số liệu phòng & khóa kỳ điện"
                >
                  <Lock size={13} /> Chốt tháng ngay
                </Button>

                {/* Nút Gửi Zalo toàn bộ */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSendAllZalo}
                  isLoading={sendNotificationsMutation.isPending}
                  className="h-9 rounded-xl px-3 text-xs font-black shadow-md shadow-primary/20 gap-1.5"
                  title="Gửi thông báo thanh toán qua Zalo cho tất cả các phòng"
                >
                  <Send size={13} /> Gửi thông báo Zalo toàn bộ
                </Button>

                {/* Nút Xuất Excel */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  className="h-9 rounded-xl px-3 text-xs font-bold shadow-xs gap-1"
                  title="Xuất bảng chốt tháng ra CSV / Excel"
                >
                  <Download size={13} /> Xuất Excel
                </Button>

                {/* Nút Làm mới */}
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-muted hover:text-text hover:bg-muted/40 transition-colors shadow-xs"
                  title="Tải lại dữ liệu"
                >
                  <RefreshCw size={13} className={isLoadingOverview ? "animate-spin text-primary" : ""} />
                </button>
              </div>
            </div>

            {/* DATA TABLE: Bảng thống kê chốt tháng từng phòng */}
            <MonthlySettlementTable
              items={items}
              isLoading={isLoadingOverview}
              onRowClick={handleRowClick}
              onResendSingle={handleResendSingle}
              isResendingRoomId={resendingRoomId}
            />
          </div>
        )}

        {/* TAB 2: CÔNG TƠ ĐIỆN THÔNG MINH */}
        {activeMainTab === "meters" && (
          <div className="space-y-4">
            <ElectricityManagerContent />
          </div>
        )}

        {/* MODAL: Xác nhận Chốt tháng ngay */}
        {isCloseMonthModalOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text">Xác nhận Chốt tháng kỳ {selectedPeriod}</h3>
                  <p className="text-xs text-muted">Hệ thống sẽ tổng hợp tiền phòng, điện, nước và khóa kỳ công tơ điện.</p>
                </div>
              </div>

              <div className="rounded-xl bg-muted/30 p-3 text-xs space-y-2 font-medium">
                <div className="flex justify-between">
                  <span className="text-muted">Kỳ chốt:</span>
                  <span className="font-bold text-text font-mono">{selectedPeriod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Số phòng áp dụng:</span>
                  <span className="font-bold text-text">{items.length} phòng</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Tổng tiền dự tính:</span>
                  <span className="font-black text-primary">{formatVnd(stats.totalAmount)}</span>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs font-bold text-text cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={closeMonthAutoSend}
                  onChange={(e) => setCloseMonthAutoSend(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span>Gửi tin nhắn thông báo thanh toán qua Zalo ngay sau khi chốt</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCloseMonthModalOpen(false)}
                  className="rounded-xl font-bold text-xs"
                >
                  Hủy bỏ
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmCloseMonth}
                  isLoading={closeMonthMutation.isPending}
                  className="rounded-xl font-bold text-xs gap-1.5"
                >
                  <Lock size={13} /> Tiến hành chốt tháng
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* DRAWER: Chi tiết phòng, thành viên, bóc tách tiền & Zalo */}
        <RoomSettlementDetailDrawer
          item={selectedRoomItem}
          isOpen={isDetailDrawerOpen}
          onClose={() => {
            setIsDetailDrawerOpen(false);
            setSelectedRoomItem(null);
          }}
        />

        {/* MODAL: Cài đặt lịch chốt & gửi tự động */}
        <SettlementSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      </div>
    </AppShell>
  );
}
