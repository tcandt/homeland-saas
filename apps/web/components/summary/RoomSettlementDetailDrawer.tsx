"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorClosed,
  Droplets,
  FileSpreadsheet,
  Layers,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  User,
  UserCheck,
  Users,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { RoomSettlementItem } from "@/lib/api/monthly-settlement.api";
import { useResendSingleNotificationMutation } from "@/lib/queries/monthly-settlement.queries";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getTenantAvatar } from "@/components/tenants/TenantDetailDrawer";
import toast from "react-hot-toast";

interface RoomSettlementDetailDrawerProps {
  item: RoomSettlementItem | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatVnd(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function formatKwh(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kWh`;
}

export default function RoomSettlementDetailDrawer({
  item,
  isOpen,
  onClose,
}: RoomSettlementDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"members" | "breakdown" | "notification">("members");
  const resendMutation = useResendSingleNotificationMutation();

  // Nhấn phím Escape (ESC) để đóng popup ngay lập tức
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const repHasZalo = Boolean(
    item.representative?.hasZalo ||
    item.representative?.zaloChatId ||
    item.representative?.zaloUserId
  );

  const handleResend = async () => {
    if (!repHasZalo) {
      toast.error("Khách hàng chưa đăng ký Zalo Bot (cần chat_id hoặc user_id). Không thể gửi tin nhắn!");
      return;
    }

    try {
      await resendMutation.mutateAsync({
        roomId: item.roomId,
        period: item.period,
      });
      toast.success(`Đã gửi thông báo thanh toán qua Zalo tới phòng ${item.roomCode} thành công!`);
    } catch (err: any) {
      toast.error(err?.message || "Gửi lại thông báo Zalo thất bại.");
    }
  };

  const getStatusBadge = (status: string, hasContract: boolean) => {
    if (!hasContract) {
      return <Badge variant="neutral" className="font-bold">Phòng trống</Badge>;
    }
    switch (status) {
      case "SENT_ZALO":
        return <Badge variant="success" className="gap-1 font-bold"><CheckCircle2 size={13} /> Đã gửi qua Zalo</Badge>;
      case "SENDING":
        return <Badge variant="primary" className="gap-1 font-bold"><RefreshCw size={13} className="animate-spin" /> Đang gửi</Badge>;
      case "FAILED":
        return <Badge variant="error" className="gap-1 font-bold"><AlertCircle size={13} /> Gửi thất bại</Badge>;
      default:
        return <Badge variant="warning" className="gap-1 font-bold"><Clock size={13} /> Chưa gửi / Chờ gửi</Badge>;
    }
  };

  const getPaymentBadge = (status: string, hasContract: boolean) => {
    if (!hasContract) {
      return <span className="inline-flex items-center rounded-full bg-muted/40 px-2.5 py-0.5 text-xs font-bold text-muted">Chưa thuê</span>;
    }
    switch (status) {
      case "PAID":
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-black text-emerald-600 dark:text-emerald-400">Đã thanh toán</span>;
      case "PARTIALLY_PAID":
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-black text-blue-600 dark:text-blue-400">Thu một phần</span>;
      case "OVERDUE":
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-black text-rose-600 dark:text-rose-400">Quá hạn</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-black text-amber-600 dark:text-amber-400">Chờ thanh toán</span>;
    }
  };

  return (
    /* POPUP NỔI GIỮA MÀN HÌNH (CENTERED FLOATING MODAL) */
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 transition-all duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-black text-text truncate">
                Phòng {item.roomCode}
              </h2>
              <span className="text-xs font-bold text-muted">• {item.buildingName}</span>
              {getStatusBadge(item.notificationStatus, item.hasContract)}
            </div>
            <p className="text-xs text-muted font-medium mt-0.5">
              Kỳ chốt: <strong className="text-text font-mono">{item.period}</strong> • Tầng {item.floorLevel} ({item.floorName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-border/80 bg-background flex items-center justify-center text-muted hover:text-text hover:bg-muted/40 transition-colors shrink-0"
            title="Đóng (ESC)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Amount & Status Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-muted uppercase tracking-wider">Tổng tiền chốt kỳ</div>
            <div className="text-2xl font-black text-primary leading-tight">
              {formatVnd(item.totalAmount)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">Trạng thái thu</div>
            {getPaymentBadge(item.paymentStatus, item.hasContract)}
          </div>
        </div>

        {/* Tabs Switcher */}
        <div className="flex items-center border-b border-border px-5 bg-muted/20 gap-2 overflow-x-auto hide-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition-colors shrink-0 ${
              activeTab === "members"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            <Users size={14} />
            Thành viên phòng ({item.membersCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("breakdown")}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition-colors shrink-0 ${
              activeTab === "breakdown"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            <FileSpreadsheet size={14} />
            Bóc tách tiền phòng & điện nước
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notification")}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition-colors shrink-0 ${
              activeTab === "notification"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            <MessageSquare size={14} />
            Thông báo & QR SePay
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: THÀNH VIÊN TRONG PHÒNG */}
          {activeTab === "members" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted uppercase tracking-wider text-[11px]">
                  Danh sách khách thuê ({item.members.length} người)
                </span>
                <span className="font-medium text-muted text-[11px]">
                  Sức chứa: {item.roomCapacity} người • {item.roomRentalType === "WHOLE" ? "Thuê nguyên căn" : "Thuê ghép"}
                </span>
              </div>

              {!item.hasContract || item.members.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted bg-muted/10 space-y-1.5">
                  <DoorClosed size={32} className="mx-auto text-muted opacity-40" />
                  <p className="text-xs font-bold text-text">Phòng hiện đang trống</p>
                  <p className="text-[11px] text-muted">Chưa có hợp đồng hoặc khách thuê nào đang hoạt động trong phòng này.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {item.members.map((member, idx) => {
                    const memberHasZalo = Boolean(member.hasZalo || member.zaloChatId || member.zaloUserId);
                    const cleanGender = (member.gender || "").trim().toLowerCase();
                    const isFemale = cleanGender === "female" || cleanGender === "nu" || cleanGender === "nữ" || cleanGender === "gái";
                    const avatarUrl = getTenantAvatar(undefined, member.fullName, member.gender);

                    return (
                      <div
                        key={member.id || idx}
                        className={`rounded-2xl border p-3.5 transition-all ${
                          member.isRepresentative
                            ? "border-primary/40 bg-primary/5 shadow-xs"
                            : "border-border bg-background"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <img
                                src={avatarUrl}
                                alt={member.fullName}
                                className={`h-10 w-10 rounded-full object-cover border-2 shadow-2xs ${
                                  isFemale ? "border-rose-400/80 bg-rose-50" : "border-sky-400/80 bg-sky-50"
                                }`}
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white shadow-xs ${
                                  isFemale ? "bg-rose-500" : "bg-sky-500"
                                }`}
                                title={isFemale ? "Nữ" : "Nam"}
                              >
                                {isFemale ? "♀" : "♂"}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-text">{member.fullName}</span>
                                {member.isRepresentative && (
                                  <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.2 text-[9px] font-black text-primary">
                                    Đại diện hợp đồng
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-muted font-medium mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Phone size={11} /> {member.phone}
                                </span>
                                {member.identityNo ? (
                                  <>
                                    <span>•</span>
                                    <span>CCCD: {member.identityNo}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/* Zalo Status */}
                          <div className="text-right">
                            {memberHasZalo ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span> Zalo Connected
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/40 text-muted border border-border/60">
                                Chưa đăng ký Zalo
                              </span>
                            )}
                            <div className="text-[10px] text-muted mt-1 font-medium">{member.relationship}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BÓC TÁCH CHI PHÍ */}
          {activeTab === "breakdown" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-background overflow-hidden shadow-xs">
                <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-black text-text">Bảng chi tiết các khoản thu</span>
                  {item.hasContract && (
                    <span className="text-xs font-bold text-primary font-mono">{item.invoiceCode}</span>
                  )}
                </div>

                <div className="divide-y divide-border/60 text-xs">
                  {/* Tiền phòng */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                        <DoorClosed size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-text">Tiền thuê phòng</div>
                        <div className="text-[11px] text-muted">
                          {item.hasContract ? `Giá hợp đồng đại diện (${item.contractCode || "Đang hiệu lực"})` : "Phòng trống"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-black text-text text-sm">
                      {formatVnd(item.roomPrice)}
                    </div>
                  </div>

                  {/* Tiền điện Hunonic */}
                  <div className="p-3.5 flex items-center justify-between bg-amber-500/5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                        <Zap size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-text flex items-center gap-2">
                          Tiền điện công tơ
                          {item.hasContract && item.electricityKwh > 0 && (
                            <span className="rounded-md bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-black text-amber-600">
                              {formatKwh(item.electricityKwh)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted">
                          {item.hasContract && item.meterReading
                            ? `Chỉ số: ${item.meterReading.oldReading} -> ${item.meterReading.newReading} kWh`
                            : item.hasContract
                            ? "Số liệu từ công tơ Hunonic"
                            : "Phòng trống = 0đ"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-black text-amber-600 dark:text-amber-400 text-sm">
                      {formatVnd(item.electricityAmount)}
                    </div>
                  </div>

                  {/* Tiền nước */}
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold">
                        <Droplets size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-text">Tiền nước sinh hoạt</div>
                        <div className="text-[11px] text-muted">
                          {item.hasContract ? `${item.membersCount} người x 100.000 đ/người` : "Phòng trống = 0đ"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-black text-text text-sm">
                      {formatVnd(item.waterAmount)}
                    </div>
                  </div>

                  {/* Dịch vụ nếu có */}
                  {item.serviceAmount > 0 && (
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                          <Wifi size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-text">Phí dịch vụ & Quản lý</div>
                          <div className="text-[11px] text-muted">Wifi, Rác, Vệ sinh</div>
                        </div>
                      </div>
                      <div className="text-right font-black text-text text-sm">
                        {formatVnd(item.serviceAmount)}
                      </div>
                    </div>
                  )}

                  {/* Tổng cộng */}
                  <div className="p-4 bg-muted/20 flex items-center justify-between">
                    <span className="font-black text-text text-sm uppercase">Tổng cộng thanh toán</span>
                    <span className="font-black text-primary text-lg">{formatVnd(item.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: THÔNG BÁO & THANH TOÁN ZALO */}
          {activeTab === "notification" && (
            <div className="space-y-3">
              {item.hasContract ? (
                <>
                  <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                          Z
                        </div>
                        <span className="text-xs font-black text-text">Thông báo Zalo OA / Bot</span>
                      </div>
                      {getStatusBadge(item.notificationStatus, item.hasContract)}
                    </div>

                    <div className="rounded-xl bg-muted/30 p-3 text-xs space-y-2 font-medium">
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Người nhận đại diện:</span>
                        <span className="font-bold text-text">{item.representative?.fullName || "Chưa rõ"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Số điện thoại:</span>
                        <span className="font-mono font-bold text-text">{item.representative?.phone || "--"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Kênh liên kết Zalo:</span>
                        {repHasZalo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span> Đã liên kết Zalo ID
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Chưa đăng ký (cần liên kết)
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted">Thời gian gửi gần nhất:</span>
                        <span className="font-medium text-text">
                          {item.notificationSentAt ? new Date(item.notificationSentAt).toLocaleString("vi-VN") : "Chưa gửi"}
                        </span>
                      </div>
                    </div>

                    {!repHasZalo && (
                      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                        <div>
                          <strong>Chưa thể gửi qua Zalo Bot:</strong> Khách đại diện chưa từng nhắn tin hoặc liên kết tài khoản với Zalo Bot (thiếu <code>chat_id</code> / <code>user_id</code>). Hãy gửi mã QR đăng ký Bot cho khách trước.
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleResend}
                      isLoading={resendMutation.isPending}
                      disabled={!repHasZalo}
                      className={`w-full rounded-xl font-bold text-xs gap-1.5 ${
                        !repHasZalo ? "opacity-50 cursor-not-allowed bg-muted text-muted" : ""
                      }`}
                      variant="primary"
                      title={!repHasZalo ? "Khách chưa đăng ký Zalo Bot" : "Gửi lại thông báo"}
                    >
                      <Send size={14} /> Gửi lại thông báo thanh toán qua Zalo ngay
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <QrCode size={18} className="text-emerald-600" />
                      <span className="text-xs font-black text-text">Mã VietQR Thanh toán SePay tự động</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Mã VietQR đối soát thanh toán tự động với mã hóa đơn <strong className="text-text font-mono">{item.invoiceCode}</strong> được tự động gửi kèm trong tin nhắn Zalo.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted bg-muted/10 space-y-1">
                  <DoorClosed size={32} className="mx-auto opacity-40 mb-1" />
                  <p className="text-xs font-bold text-text">Phòng đang trống</p>
                  <p className="text-[11px] text-muted">Không có thông báo thanh toán phát sinh cho phòng trống.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-border bg-muted/20 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl font-bold text-xs">
            Đóng (ESC)
          </Button>
          {item.hasContract && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleResend}
              isLoading={resendMutation.isPending}
              disabled={!repHasZalo}
              className={`rounded-xl font-bold text-xs gap-1.5 ${
                !repHasZalo ? "opacity-40 cursor-not-allowed bg-muted text-muted" : ""
              }`}
              title={!repHasZalo ? "Khách chưa đăng ký Zalo Bot" : `Gửi Zalo cho phòng ${item.roomCode}`}
            >
              <Send size={13} /> Gửi Zalo ({item.roomCode})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
