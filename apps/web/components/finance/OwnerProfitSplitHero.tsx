"use client";

import React from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  Receipt,
  Send,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { formatVnd } from "@/lib/utils/format";

interface OwnerProfitSplitHeroProps {
  onOpenOwnerDetail: (ownerId: string, ownerName: string, ownerCode: string) => void;
}

export default function OwnerProfitSplitHero({
  onOpenOwnerDetail,
}: OwnerProfitSplitHeroProps) {
  const owners = [
    {
      id: "owner-tinh",
      name: "Nguyễn Đức Tính",
      code: "OWNER-A",
      avatarBg: "bg-blue-600 text-white",
      buildings: [
        { code: "LK01.31", name: "Tòa LK01 - 31 phòng", revenue: 5132020 },
        { code: "LK08.25", name: "Tòa LK08 - 25 phòng", revenue: 0 },
      ],
      rentRevenue: 4266667,
      utilityRevenue: 865353,
      totalRevenue: 5132020,
      operationalCost: 765353,
      reimbursementDeduction: 100000,
      netProfit: 5132020, // Net settlement
      depositHolding: 8000000,
      bankAccount: {
        bank: "BIDV",
        accountNumber: "RLQJ",
        accountName: "HỘ KINH DOANH NGUYEN DUC TINH",
        confirmedAmount: 1000000,
        pendingAmount: 4132020,
      },
      status: "READY_SETTLE",
    },
    {
      id: "owner-the",
      name: "Phan Văn Thế",
      code: "OWNER-B",
      avatarBg: "bg-purple-600 text-white",
      buildings: [
        { code: "LK01.32", name: "Tòa LK01 - 32 phòng", revenue: 9282605 },
        { code: "LK08.24", name: "Tòa LK08 - 24 phòng", revenue: 4366667 },
      ],
      rentRevenue: 12800001,
      utilityRevenue: 849271,
      totalRevenue: 13649272,
      operationalCost: 549271,
      reimbursementDeduction: 200000,
      netProfit: 13649272, // Net settlement
      depositHolding: 7000000,
      bankAccount: {
        bank: "BIDV",
        accountNumber: "QGPR",
        accountName: "HỘ KINH DOANH PHAN VAN THE",
        confirmedAmount: 0,
        pendingAmount: 13649272,
      },
      status: "READY_SETTLE",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HandCoins size={18} />
          </span>
          <div>
            <h2 className="text-base font-black tracking-tight text-foreground md:text-lg">
              Bảng Phân Chia Lợi Nhuận Quyết Toán Cho 2 Chủ Sở Hữu
            </h2>
            <p className="text-xs text-muted-foreground">
              Tách bạch dòng tiền thu/chi, tiền cọc và số tiền lãi ròng thực nhận cần giải ngân
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={13} />
            Đã đồng bộ công nợ & cọc kỳ 2026
          </span>
        </div>
      </div>

      {/* Comparative Ratio Bar */}
      <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Tổng lãi ròng phân bổ kỳ này:</span>
            <span className="font-mono text-sm font-black text-foreground">
              {formatVnd(18781292)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              <span className="font-medium text-foreground">Nguyễn Đức Tính:</span>
              <span className="font-mono font-bold text-blue-600">
                {formatVnd(5132020)} (27.3%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
              <span className="font-medium text-foreground">Phan Văn Thế:</span>
              <span className="font-mono font-bold text-purple-600">
                {formatVnd(13649272)} (72.7%)
              </span>
            </div>
          </div>
        </div>

        {/* Progress ratio track */}
        <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: "27.3%" }}
            title="Nguyễn Đức Tính: 27.3%"
          />
          <div
            className="h-full bg-purple-600 transition-all duration-500"
            style={{ width: "72.7%" }}
            title="Phan Văn Thế: 72.7%"
          />
        </div>
      </div>

      {/* 2-Column Split Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {owners.map((owner) => {
          return (
            <div
              key={owner.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:border-border hover:shadow-md"
            >
              {/* Top: Owner Profile & Code */}
              <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black text-sm shadow-xs ${owner.avatarBg}`}
                  >
                    {owner.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(-2)
                      .join("")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-foreground">
                        {owner.name}
                      </h3>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-black text-primary border border-primary/20">
                        {owner.code}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {owner.buildings.map((b) => (
                        <span
                          key={b.code}
                          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-surface/60 px-2 py-0.5 text-[11px]"
                        >
                          <Building2 size={11} className="text-primary shrink-0" />
                          <span className="font-semibold text-foreground">{b.code}:</span>
                          <span className="font-mono font-bold text-foreground">
                            {formatVnd(b.revenue)}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onOpenOwnerDetail(owner.id, owner.name, owner.code)}
                  className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-surface/40 px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-primary hover:bg-surface hover:text-primary cursor-pointer"
                >
                  <span>Chi tiết phòng</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* HERO NUMBER: LÃI CÒN LẠI THỰC NHẬN */}
              <div className="my-4 rounded-xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 text-white">
                      <Wallet size={12} />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Lãi ròng thực nhận cần thanh toán cho chủ sở hữu
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                    Đủ điều kiện chi trả
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div className="font-mono text-3xl font-black tracking-tight text-emerald-700 dark:text-emerald-300">
                    {formatVnd(owner.netProfit)}
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground block">
                      Tỷ suất lợi nhuận
                    </span>
                    <span className="font-mono font-bold text-emerald-600 text-xs">
                      100% doanh thu thuần
                    </span>
                  </div>
                </div>
              </div>

              {/* Dòng tiền chi tiết dạng Waterfall */}
              <div className="space-y-2 rounded-xl border border-border/60 bg-surface/30 p-3.5 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>(+) Doanh thu tiền thuê phòng:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatVnd(owner.rentRevenue)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>(+) Doanh thu dịch vụ (Điện, nước, rác):</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {formatVnd(owner.utilityRevenue)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-border/30 pt-1.5 font-bold text-foreground">
                  <span>(=) Tổng doanh thu phát sinh:</span>
                  <span className="font-mono text-primary font-black">
                    {formatVnd(owner.totalRevenue)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>(-) Chi phí vận hành & sửa chữa:</span>
                  <span className="font-mono font-bold text-rose-500">
                    -{formatVnd(owner.operationalCost)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>(-) Khấu trừ ứng chi & phí quản lý:</span>
                  <span className="font-mono font-bold text-rose-500">
                    -{formatVnd(owner.reimbursementDeduction)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-xs font-semibold text-muted-foreground">
                  <span>(🔒) Quỹ tiền cọc khách thuê đang giữ (tách biệt):</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    {formatVnd(owner.depositHolding)}
                  </span>
                </div>
              </div>

              {/* Tình trạng giải ngân vào Ngân hàng */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface/40 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 px-1.5 items-center justify-center rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-[11px] border border-amber-500/20">
                    {owner.bankAccount.bank}
                  </span>
                  <div>
                    <span className="font-bold text-foreground block text-[11px]">
                      {owner.bankAccount.accountName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Mã TK: {owner.bankAccount.accountNumber}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Đã về bank</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {formatVnd(owner.bankAccount.confirmedAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Còn nợ đọng</span>
                    <span className="font-mono font-bold text-amber-600">
                      {formatVnd(owner.bankAccount.pendingAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
