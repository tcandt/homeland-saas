"use client";

import React from "react";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  DoorClosed,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  User,
  Users,
} from "lucide-react";
import { RoomSettlementItem } from "@/lib/api/monthly-settlement.api";
import { Button } from "@/components/ui/Button";

interface MonthlySettlementTableProps {
  items: RoomSettlementItem[];
  isLoading: boolean;
  onRowClick: (item: RoomSettlementItem) => void;
  onResendSingle: (roomId: string) => void;
  isResendingRoomId?: string | null;
}

function formatVnd(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function formatKwh(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kWh`;
}

export default function MonthlySettlementTable({
  items,
  isLoading,
  onRowClick,
  onResendSingle,
  isResendingRoomId,
}: MonthlySettlementTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-border bg-card space-y-3">
        <RefreshCw size={28} className="animate-spin text-primary" />
        <p className="text-xs font-bold text-muted">Đang tải dữ liệu tổng hợp chốt tháng...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-dashed border-border bg-card space-y-3 text-center">
        <DoorClosed size={36} className="text-muted opacity-40" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-text">Không tìm thấy phòng nào phù hợp</p>
          <p className="text-xs text-muted">Thử thay đổi bộ lọc kỳ tháng, tòa nhà hoặc từ khóa tìm kiếm</p>
        </div>
      </div>
    );
  }

  const renderNotificationStatus = (status: string, hasContract: boolean) => {
    if (!hasContract) {
      return <span className="text-muted text-[11px] font-medium">--</span>;
    }

    switch (status) {
      case "SENT_ZALO":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={12} /> Đã gửi qua Zalo
          </span>
        );
      case "SENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <RefreshCw size={12} className="animate-spin" /> Đang gửi...
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle size={12} /> Gửi thất bại
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock size={12} /> Chưa gửi
          </span>
        );
    }
  };

  const renderPaymentStatus = (status: string, hasContract: boolean) => {
    if (!hasContract) {
      return <span className="text-muted text-[11px] font-medium">--</span>;
    }

    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            Đã thu
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
            Thu 1 phần
          </span>
        );
      case "OVERDUE":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
            Quá hạn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            Chờ thanh toán
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-black uppercase tracking-wider text-muted select-none">
              <th className="py-3 px-3.5 text-center w-12">STT</th>
              <th className="py-3 px-3.5 min-w-[140px]">Phòng / Căn hộ</th>
              <th className="py-3 px-3.5 min-w-[180px]">Đại diện & Cư dân</th>
              <th className="py-3 px-3.5 text-right min-w-[110px]">Tiền phòng</th>
              <th className="py-3 px-3.5 text-right min-w-[130px]">Điện (Tháng trước)</th>
              <th className="py-3 px-3.5 text-right min-w-[120px]">Nước (100k/người)</th>
              <th className="py-3 px-3.5 text-right min-w-[130px]">Tổng cộng</th>
              <th className="py-3 px-3.5 text-center min-w-[140px]">Trạng thái gửi</th>
              <th className="py-3 px-3.5 text-center min-w-[110px]">Thanh toán</th>
              <th className="py-3 px-3.5 text-center w-28">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.map((item, idx) => {
              const isResending = isResendingRoomId === item.roomId;
              const hasContract = item.hasContract;
              const isNewTenant = item.isFirstMonthNewTenant;

              return (
                <tr
                  key={item.roomId}
                  onClick={() => onRowClick(item)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors group"
                >
                  {/* STT */}
                  <td className="py-3.5 px-3.5 text-center font-bold text-muted">
                    {idx + 1}
                  </td>

                  {/* Phòng */}
                  <td className="py-3.5 px-3.5">
                    <div className="min-w-0">
                      <div className="font-black text-text group-hover:text-primary transition-colors truncate text-sm">
                        Phòng {item.roomCode}
                      </div>
                      <div className="text-[11px] text-muted truncate">
                        {item.buildingName} • Tầng {item.floorLevel}
                      </div>
                    </div>
                  </td>

                  {/* Đại diện & Thành viên */}
                  <td className="py-3.5 px-3.5">
                    {hasContract && item.representative ? (
                      <div>
                        <div className="font-bold text-text flex items-center gap-1.5 truncate">
                          <span>{item.representative.fullName}</span>
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.2 text-[9px] font-black text-primary">
                            {item.membersCount} người
                          </span>
                        </div>
                        <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {item.representative.phone}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-muted/40 px-2 py-0.5 text-[10px] font-bold text-muted">
                        Phòng trống
                      </span>
                    )}
                  </td>

                  {/* Tiền phòng theo kỳ tháng M */}
                  <td className="py-3.5 px-3.5 text-right font-bold text-text">
                    {hasContract ? formatVnd(item.roomPrice) : <span className="text-muted/60 font-normal">0 đ</span>}
                  </td>

                  {/* Tiền điện tháng M-1: Nếu là khách mới vào ở từ tháng M, chưa tính điện M-1 */}
                  <td className="py-3.5 px-3.5 text-right">
                    {hasContract && item.electricityAmount > 0 ? (
                      <div>
                        <div className="font-bold text-amber-600 dark:text-amber-400">
                          {formatVnd(item.electricityAmount)}
                        </div>
                        <div className="text-[10px] text-muted font-medium flex items-center justify-end gap-1 mt-0.5">
                          <span>{formatKwh(item.electricityKwh)}</span>
                          {item.meterReading?.rateMode === "custom" ? (
                            <span className="inline-flex items-center rounded-xs bg-amber-500/15 px-1 py-0.2 text-[9px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              3.967đ
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-xs bg-sky-500/10 px-1 py-0.2 text-[9px] font-bold text-sky-700 dark:text-sky-300">
                              EVN
                            </span>
                          )}
                        </div>
                      </div>
                    ) : isNewTenant ? (
                      <div>
                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Khách mới T{item.period?.split('-')?.[1]}
                        </span>
                        <div className="text-[10px] text-muted font-medium mt-0.5">Chưa ở T{item.usagePeriod?.split('-')?.[1]}</div>
                      </div>
                    ) : (
                      <div className="text-muted/60">
                        <div>0 đ</div>
                        <div className="text-[10px]">0 kWh</div>
                      </div>
                    )}
                  </td>

                  {/* Tiền nước: 100k/người x số thành viên */}
                  <td className="py-3.5 px-3.5 text-right">
                    {hasContract && item.waterAmount > 0 ? (
                      <div className="font-bold text-text">
                        {formatVnd(item.waterAmount)}
                      </div>
                    ) : (
                      <span className="text-muted/60 font-normal">0 đ</span>
                    )}
                  </td>

                  {/* Tổng tiền */}
                  <td className="py-3.5 px-3.5 text-right">
                    {hasContract && item.totalAmount > 0 ? (
                      <div className="font-black text-text text-sm">
                        {formatVnd(item.totalAmount)}
                      </div>
                    ) : (
                      <span className="font-bold text-muted/60 text-xs">0 đ</span>
                    )}
                  </td>

                  {/* Trạng thái gửi */}
                  <td className="py-3.5 px-3.5 text-center">
                    {renderNotificationStatus(item.notificationStatus, hasContract)}
                  </td>

                  {/* Trạng thái thanh toán */}
                  <td className="py-3.5 px-3.5 text-center">
                    {renderPaymentStatus(item.paymentStatus, hasContract)}
                  </td>

                  {/* Hành động */}
                  <td className="py-3.5 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      {hasContract ? (
                        (() => {
                          const repHasZalo = Boolean(
                            item.representative?.hasZalo ||
                            item.representative?.zaloChatId ||
                            item.representative?.zaloUserId
                          );

                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onResendSingle(item.roomId)}
                              isLoading={isResending}
                              disabled={!repHasZalo}
                              className={`h-8 rounded-lg px-2 text-xs font-bold gap-1 border-border ${repHasZalo
                                  ? "text-primary hover:bg-primary/10"
                                  : "text-muted opacity-40 cursor-not-allowed bg-muted/20"
                                }`}
                              title={repHasZalo ? "Gửi thông báo Zalo" : "Khách chưa đăng ký Zalo Bot"}
                            >
                              <Send size={12} />
                              <span className="hidden sm:inline">Zalo</span>
                            </Button>
                          );
                        })()
                      ) : (
                        <span className="text-muted/30 text-xs font-mono">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
