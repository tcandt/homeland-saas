"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Droplets,
  ExternalLink,
  Flame,
  Home,
  Info,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { formatVnd } from "@/lib/utils/format";

interface BuildingPerformanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingCode: string;
  buildingName?: string;
  ownerName?: string;
}

export default function BuildingPerformanceDetailModal({
  isOpen,
  onClose,
  buildingCode,
  buildingName,
  ownerName = "Phan Văn Thế",
}: BuildingPerformanceDetailModalProps) {
  const [selectedYear, setSelectedYear] = useState("2026");

  if (!isOpen) return null;

  const isLK0132 = buildingCode === "LK01.32" || !buildingCode;
  const isLK0131 = buildingCode === "LK01.31";
  const isLK0824 = buildingCode === "LK08.24";
  const isLK0825 = buildingCode === "LK08.25";

  // Data tailored to building
  const metrics = isLK0132
    ? {
        occupancy: 29,
        roomText: "2/7 phòng",
        rent: 8533334,
        electricity: 549271,
        waterService: 200000,
        expense: 0,
        totalRev: 9282605,
        profit: 9282605,
        deposit: 7000000,
        totalReceived: 16282605,
        depositPercentage: 43,
        owner: "Phan Văn Thế",
        rooms: [
          { code: "PN 32-04", rent: 4266667, elec: 391900, water: 100000, other: 0, totalRev: 4758567, deposit: 0, totalReceived: 4758567, expense: 0, status: "Đang thuê" },
          { code: "PN 32-02", rent: 4266667, elec: 157371, water: 100000, other: 0, totalRev: 4524038, deposit: 7000000, totalReceived: 11524038, expense: 0, status: "Đang thuê" },
          { code: "PN 32-06", rent: 0, elec: 0, water: 0, other: 0, totalRev: 0, deposit: 0, totalReceived: 0, expense: 0, status: "Trống" },
          { code: "PN 32-01", rent: 0, elec: 0, water: 0, other: 0, totalRev: 0, deposit: 0, totalReceived: 0, expense: 0, status: "Trống" },
          { code: "PN 32-03", rent: 0, elec: 0, water: 0, other: 0, totalRev: 0, deposit: 0, totalReceived: 0, expense: 0, status: "Trống" },
          { code: "PN 32-07", rent: 0, elec: 0, water: 0, other: 0, totalRev: 0, deposit: 0, totalReceived: 0, expense: 0, status: "Trống" },
          { code: "PN 32-05", rent: 0, elec: 0, water: 0, other: 0, totalRev: 0, deposit: 0, totalReceived: 0, expense: 0, status: "Trống" },
        ],
      }
    : isLK0131
      ? {
          occupancy: 14,
          roomText: "1/7 phòng",
          rent: 4266667,
          electricity: 765353,
          waterService: 100000,
          expense: 0,
          totalRev: 5132020,
          profit: 5132020,
          deposit: 8000000,
          totalReceived: 13132020,
          depositPercentage: 60,
          owner: "Nguyễn Đức Tính",
          rooms: [
            { code: "PN 31-01", rent: 4266667, elec: 765353, water: 100000, other: 0, totalRev: 5132020, deposit: 8000000, totalReceived: 13132020, expense: 0, status: "Đang thuê" },
            { code: "PN 31-02", rent: 0, elec: 0, water: 0, other: 0, totalRev: 0, deposit: 0, totalReceived: 0, expense: 0, status: "Trống" },
            { code: "PN 31-03", rent: 0, elec: 0, water: 0, other: 0, totalRev: 0, deposit: 0, totalReceived: 0, expense: 0, status: "Trống" },
          ],
        }
      : isLK0824
        ? {
            occupancy: 10,
            roomText: "1/10 phòng",
            rent: 4266667,
            electricity: 0,
            waterService: 100000,
            expense: 0,
            totalRev: 4366667,
            profit: 4366667,
            deposit: 0,
            totalReceived: 4366667,
            depositPercentage: 0,
            owner: "Phan Văn Thế",
            rooms: [
              { code: "PN 24-01", rent: 4266667, elec: 0, water: 100000, other: 0, totalRev: 4366667, deposit: 0, totalReceived: 4366667, expense: 0, status: "Đang thuê" },
              { code: "PN 24-02", rent: 0, elec: 0, water: 0, other: 0, totalRev: 0, deposit: 0, totalReceived: 0, expense: 0, status: "Trống" },
            ],
          }
        : {
            occupancy: 0,
            roomText: "0/10 phòng",
            rent: 0,
            electricity: 0,
            waterService: 0,
            expense: 0,
            totalRev: 0,
            profit: 0,
            deposit: 0,
            totalReceived: 0,
            depositPercentage: 0,
            owner: "Nguyễn Đức Tính",
            rooms: [],
          };

  return (
    <div className="fixed inset-0 z-[10030] flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        data-testid="building-performance-detail-modal"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl transition-all"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/70 bg-surface/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 text-base font-black text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-text">
                  Chi tiết hiệu quả tòa nhà:
                </h2>
                <span className="text-base font-black text-primary">
                  {buildingCode}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                  👤 {metrics.owner}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Theo dõi doanh thu, điện, nước & dịch vụ, chi phí và lợi nhuận theo từng phòng.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2.5 py-1.5 text-xs font-semibold text-text shadow-2xs">
              <Calendar size={13} className="text-muted" />
              <span>Năm {selectedYear}</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2.5 py-1.5 text-xs font-semibold text-text shadow-2xs">
              <Clock size={13} className="text-muted" />
              <span>Cả năm</span>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-card text-muted transition hover:bg-surface hover:text-text"
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top 7 Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {/* Lấp đầy */}
            <div className="flex flex-col justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Lấp đầy</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600">
                  👥
                </span>
              </div>
              <div className="mt-2 text-lg font-black font-mono text-indigo-700 dark:text-indigo-400">
                {metrics.occupancy}%
              </div>
              <div className="mt-1 text-[10px] font-bold text-muted">
                {metrics.roomText}
              </div>
            </div>

            {/* Thuê phòng */}
            <div className="flex flex-col justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Thuê phòng</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <Home size={11} />
                </span>
              </div>
              <div className="mt-2 text-sm font-black font-mono text-emerald-700 dark:text-emerald-400 truncate">
                {formatVnd(metrics.rent)}
              </div>
              <div className="mt-1 flex items-end gap-0.5 h-2.5">
                <span className="w-1 h-1.5 bg-emerald-500/40 rounded-xs" />
                <span className="w-1 h-2.5 bg-emerald-500 rounded-xs" />
              </div>
            </div>

            {/* Điện */}
            <div className="flex flex-col justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Điện</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
                  <Zap size={11} />
                </span>
              </div>
              <div className="mt-2 text-sm font-black font-mono text-amber-700 dark:text-amber-400 truncate">
                {formatVnd(metrics.electricity)}
              </div>
              <div className="mt-1 flex items-end gap-0.5 h-2.5">
                <span className="w-1 h-1.5 bg-amber-500/40 rounded-xs" />
                <span className="w-1 h-2.5 bg-amber-500 rounded-xs" />
              </div>
            </div>

            {/* Nước & DV */}
            <div className="flex flex-col justify-between rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Nước & DV</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/15 text-sky-600">
                  <Droplets size={11} />
                </span>
              </div>
              <div className="mt-2 text-sm font-black font-mono text-sky-700 dark:text-sky-400 truncate">
                {formatVnd(metrics.waterService)}
              </div>
              <div className="mt-1 flex items-end gap-0.5 h-2.5">
                <span className="w-1 h-1 bg-sky-500/40 rounded-xs" />
                <span className="w-1 h-2 bg-sky-500 rounded-xs" />
              </div>
            </div>

            {/* Chi phí tòa */}
            <div className="flex flex-col justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Chi phí tòa</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/15 text-rose-600">
                  <Wallet size={11} />
                </span>
              </div>
              <div className="mt-2 text-sm font-black font-mono text-rose-600 dark:text-rose-400 truncate">
                {formatVnd(metrics.expense)}
              </div>
              <div className="mt-1 flex items-end gap-0.5 h-2.5">
                <span className="w-1 h-1 bg-rose-500/30 rounded-xs" />
              </div>
            </div>

            {/* Tổng thu */}
            <div className="flex flex-col justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300">
                  Tổng thu
                </span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <TrendingUp size={11} />
                </span>
              </div>
              <div className="mt-2 text-sm font-black font-mono text-emerald-700 dark:text-emerald-300 truncate">
                {formatVnd(metrics.totalRev)}
              </div>
              <div className="mt-1 flex items-end gap-0.5 h-2.5">
                <span className="w-1 h-1.5 bg-emerald-500/40 rounded-xs" />
                <span className="w-1 h-2.5 bg-emerald-600 rounded-xs" />
              </div>
            </div>

            {/* Lợi nhuận */}
            <div className="flex flex-col justify-between rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-purple-800 dark:text-purple-300">
                  Lợi nhuận
                </span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white">
                  <Sparkles size={11} />
                </span>
              </div>
              <div className="mt-2 text-sm font-black font-mono text-purple-700 dark:text-purple-300 truncate">
                {formatVnd(metrics.profit)}
              </div>
              <div className="mt-1 flex items-end gap-0.5 h-2.5">
                <span className="w-1 h-1.5 bg-purple-500/40 rounded-xs" />
                <span className="w-1 h-2.5 bg-purple-600 rounded-xs" />
              </div>
            </div>
          </div>

          {/* 2-Column Split: Room Breakdown (Left) + Expense & Alert Rail (Right) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column (8 cols): Room table + Insight banner */}
            <div className="space-y-4 lg:col-span-8">
              {/* Room Table */}
              <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs">
                <div className="border-b border-border/50 bg-surface/40 px-4 py-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-1.5">
                    <Building2 size={14} className="text-primary" />
                    Hiệu quả từng phòng
                  </h3>
                  <p className="text-[11px] text-muted mt-0.5">
                    Chi tiết doanh thu, chi phí, tiền cọc và lợi nhuận theo từng phòng trong năm 2026.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface/50 text-[10px] uppercase font-black text-muted border-b border-border/50">
                      <tr>
                        <th className="px-3 py-2.5">Phòng</th>
                        <th className="px-3 py-2.5 text-right">Thuê phòng</th>
                        <th className="px-3 py-2.5 text-right">Điện</th>
                        <th className="px-3 py-2.5 text-right">Nước & DV</th>
                        <th className="px-3 py-2.5 text-right">Khác</th>
                        <th className="px-3 py-2.5 text-right">Tổng thu P&L</th>
                        <th className="px-3 py-2.5 text-right">Tiền cọc</th>
                        <th className="px-3 py-2.5 text-right">Tổng nhận</th>
                        <th className="px-3 py-2.5 text-right">Chi phí</th>
                        <th className="px-3 py-2.5">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {metrics.rooms.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-muted text-xs">
                            Tòa nhà hiện chưa có phòng hoặc chưa phát sinh dữ liệu trong kỳ.
                          </td>
                        </tr>
                      ) : (
                        metrics.rooms.map((room) => {
                          const isRented = room.status === "Đang thuê";

                          return (
                            <tr key={room.code} className="hover:bg-surface/40 transition">
                              <td className="px-3 py-2.5 font-black text-text">{room.code}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-muted">
                                {formatVnd(room.rent)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-amber-600">
                                {formatVnd(room.elec)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-sky-600">
                                {formatVnd(room.water)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-muted">
                                {formatVnd(room.other)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">
                                {formatVnd(room.totalRev)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-amber-600">
                                {formatVnd(room.deposit)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-700 dark:text-emerald-300">
                                {formatVnd(room.totalReceived)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-rose-500">
                                {formatVnd(room.expense)}
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    isRented
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                      : "bg-muted/10 text-muted"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      isRented ? "bg-emerald-500" : "bg-muted"
                                    }`}
                                  />
                                  {room.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Insight Card */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent p-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-purple-500/15 px-1.5 py-0.2 text-[9px] font-black uppercase text-purple-700 dark:text-purple-300">
                        INSIGHT
                      </span>
                      <h4 className="text-xs font-black text-text">
                        Tòa nhà là nguồn doanh thu lớn của {metrics.owner}
                      </h4>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Tổng số tiền đã nhận (bao gồm tiền cọc) trong năm 2026
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-muted block">Tổng nhận</span>
                    <span className="text-xs font-mono font-black text-emerald-600">
                      {formatVnd(metrics.totalReceived)}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 block">
                      +100% so với cùng kỳ
                    </span>
                  </div>

                  <div className="text-right border-l border-border/60 pl-6">
                    <span className="text-[10px] font-bold text-muted block">Trong đó tiền cọc</span>
                    <span className="text-xs font-mono font-black text-amber-600">
                      {formatVnd(metrics.deposit)}
                    </span>
                    <span className="text-[10px] font-bold text-muted block">
                      Chiếm {metrics.depositPercentage}% tổng nhận
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (4 cols): Phân bổ chi phí & cảnh báo */}
            <div className="space-y-4 lg:col-span-4">
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                  <Wallet size={15} className="text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-text">
                    Phân bổ chi phí & cảnh báo
                  </h3>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted">
                        ⚙
                      </span>
                      <div>
                        <span className="font-bold text-text block">Chi phí vận hành</span>
                        <span className="text-[10px] text-muted">Bảo trì, quản lý, vận hành chung</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-text">0 đ</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted">
                        <Wrench size={13} />
                      </span>
                      <div>
                        <span className="font-bold text-text block">Chi phí sửa chữa</span>
                        <span className="text-[10px] text-muted">Sửa chữa định kỳ, phát sinh</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-text">0 đ</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted">
                        🧹
                      </span>
                      <div>
                        <span className="font-bold text-text block">Chi phí vệ sinh</span>
                        <span className="text-[10px] text-muted">Vệ sinh tòa nhà, khu vực chung</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-text">0 đ</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted">
                        <Zap size={13} />
                      </span>
                      <div>
                        <span className="font-bold text-text block">Điện chung</span>
                        <span className="text-[10px] text-muted">Điện hành lang, khu vực chung</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-text">0 đ</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted">
                        <Droplets size={13} />
                      </span>
                      <div>
                        <span className="font-bold text-text block">Nước chung</span>
                        <span className="text-[10px] text-muted">Nước khu vực chung</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-text">0 đ</span>
                  </div>
                </div>

                {/* Information Card */}
                <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Info size={16} className="text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-sky-800 dark:text-sky-300 block">
                        Chưa có chi phí vận hành phát sinh
                      </span>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                        Hiện tại tòa nhà chưa ghi nhận chi phí vận hành nào trong năm 2026.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-surface/50 px-6 py-3.5">
          <button
            onClick={onClose}
            className="rounded-xl border border-border/70 bg-card px-4 py-2 text-xs font-bold text-text shadow-2xs hover:bg-surface transition"
          >
            Đóng
          </button>

          <button
            onClick={() => {
              window.location.href = `/buildings/${buildingCode}`;
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition"
          >
            <span>Xem phòng chi tiết</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
