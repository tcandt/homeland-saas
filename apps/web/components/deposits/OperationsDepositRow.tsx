"use client";

import React, { useState } from "react";
import {
  Bookmark,
  ChevronRight,
  ShieldCheck,
  QrCode,
  FileText,
  User,
  DoorOpen,
  Calendar,
  Clock,
  Send
} from "lucide-react";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";
import { Card } from "../ui/Card";
import DepositQrModal from "./DepositQrModal";

export default function OperationsDepositRow({
  deposit,
  onClick,
}: {
  deposit: UI_Deposit;
  onClick: () => void;
}) {
  const [showQrModal, setShowQrModal] = useState(false);

  const getStatusBadge = (status: string, type?: string) => {
    const isSecurity = type === "SECURITY";
    switch (status) {
      case "DRAFT":
        return { label: "Nháp", color: "text-[#0ea5e9] bg-[#0ea5e9]/10 border-[#0ea5e9]/20" };
      case "PENDING":
        return {
          label: isSecurity ? "Chờ thu cọc hợp đồng" : "Chờ thu cọc giữ phòng",
          color: isSecurity ? "text-purple-600 bg-purple-500/10 border-purple-500/20" : "text-[#0ea5e9] bg-[#0ea5e9]/10 border-[#0ea5e9]/20"
        };
      case "PAID":
        return {
          label: isSecurity ? "Đã thu cọc hợp đồng" : "Đã thu cọc giữ phòng",
          color: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20"
        };
      case "CONVERTED_TO_CONTRACT":
        return { label: "Đã chuyển HĐ", color: "text-[#6366f1] bg-[#6366f1]/10 border-[#6366f1]/20" };
      case "REFUNDED":
        return { label: "Đã hoàn cọc", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
      case "CANCELLED":
        return { label: "Đã hủy", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" };
      default:
        return { label: status, color: "text-muted bg-black/5 dark:bg-white/5 border-border" };
    }
  };

  const getTypeName = () => {
    switch (deposit.type) {
      case "BOOKING":
        return { label: "Cọc giữ phòng", icon: Bookmark, color: "text-[#f97316]" };
      case "SECURITY":
        return { label: "Cọc bảo đảm HĐ", icon: ShieldCheck, color: "text-[#6366f1]" };
      case "RESERVATION":
        return { label: "Phí giữ chỗ", icon: Bookmark, color: "text-[#0ea5e9]" };
      default:
        return { label: deposit.type, icon: Bookmark, color: "text-muted" };
    }
  };

  const statusBadge = getStatusBadge(deposit.status, deposit.type);
  const typeInfo = getTypeName();
  const amountStr = new Intl.NumberFormat("vi-VN").format(deposit.amount);

  return (
    <>
      <Card
        data-testid="deposit-card"
        onClick={onClick}
        className="group relative flex cursor-pointer flex-col gap-3 p-4 transition-all duration-150 hover:-translate-y-[2px] hover:border-primary/40 hover:shadow-md md:flex-row md:items-center md:justify-between"
      >
        {/* Left: Code, Type, Dates */}
        <div className="flex min-w-[200px] flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h4 className="text-[15px] font-black leading-none text-primary">{deposit.code || deposit.id}</h4>
            <span
              data-testid="deposit-status-badge"
              className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${statusBadge.color}`}
            >
              {statusBadge.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <typeInfo.icon size={13} className={typeInfo.color} />
            <span className={`text-[12px] font-bold ${typeInfo.color}`}>{typeInfo.label}</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted font-medium mt-0.5">
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {new Date(deposit.createdAt).toLocaleDateString("vi-VN")}
            </span>
            {deposit.expiredAt && deposit.status === "PENDING" && (
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <Clock size={12} /> Hạn: {new Date(deposit.expiredAt).toLocaleDateString("vi-VN")}
              </span>
            )}
          </div>
        </div>

        {/* Middle: Customer & Room */}
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <div className="flex items-center gap-1.5 font-bold text-[14px] text-text">
            <User size={14} className="text-muted" />
            <span>{deposit.customerName}</span>
          </div>
          <span className="text-[12px] font-medium text-muted pl-5">{deposit.customerPhone}</span>
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted pl-5">
            <span className="rounded bg-black/5 px-1.5 py-0.5 font-bold dark:bg-white/5 text-text">
              {deposit.roomCode}
            </span>
            <span>· {deposit.buildingName}</span>
          </div>
        </div>

        {/* Right: Amount & Quick Actions */}
        <div className="flex items-center justify-between md:flex-col md:items-end gap-2 shrink-0">
          <div className="flex flex-col md:items-end">
            <span className="text-[11px] font-medium text-muted">Số tiền cọc</span>
            <span className="font-black text-[17px] text-text">{amountStr} đ</span>
          </div>

          <div className="flex items-center gap-1.5">
            {!["PAID", "CONVERTED_TO_CONTRACT", "REFUNDED", "CANCELLED"].includes(deposit.status?.toUpperCase() || "") && (
              <button
                type="button"
                title="Xem VietQR & Gửi Zalo"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQrModal(true);
                }}
                className="h-8 px-2.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/15 text-primary text-[12px] font-bold flex items-center gap-1 transition-colors"
              >
                <QrCode size={14} /> VietQR
              </button>
            )}

            <button
              type="button"
              title="Xem chi tiết"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="h-8 w-8 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-muted hover:text-text transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Card>

      {/* QR Modal */}
      {showQrModal && (
        <DepositQrModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          deposit={deposit}
        />
      )}
    </>
  );
}
