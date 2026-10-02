"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Landmark,
  MoreVertical,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
  FileSpreadsheet,
  Receipt,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatVnd, formatNumber } from "@/lib/utils/format";

interface BankCashflowReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BankCashflowReconciliationModal({
  isOpen,
  onClose,
}: BankCashflowReconciliationModalProps) {
  const [selectedAccount, setSelectedAccount] = useState("all");

  if (!isOpen) return null;

  // Chart data matching mockup
  const chartData = [
    {
      name: "BIDV",
      subName: "HỘ KINH DOANH NGUYEN DUC TINH",
      confirmed: 1000000,
      pending: 18132020,
    },
    {
      name: "Agribank",
      subName: "DSDSD",
      confirmed: 0,
      pending: 0,
    },
    {
      name: "BIDV",
      subName: "HỘ KINH DOANH PHAN VAN THE",
      confirmed: 0,
      pending: 28649272,
    },
  ];

  return (
    <div className="fixed inset-0 z-[10030] flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        data-testid="bank-cashflow-reconciliation-modal"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl transition-all"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/70 bg-surface/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 text-base font-black text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-text">
                Dòng tiền theo tài khoản & đối soát
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Theo dõi tiền vào từng tài khoản, giao dịch chờ xác nhận, đối soát SePay và số dư thực nhận.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2.5 py-1.5 text-xs font-semibold text-text shadow-2xs">
              <Calendar size={13} className="text-muted" />
              <span>01/01/2026</span>
              <span className="text-muted">→</span>
              <span>31/12/2026</span>
            </div>

            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="rounded-xl border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-text shadow-2xs outline-none focus:border-primary"
            >
              <option value="all">Tất cả tài khoản</option>
              <option value="bidv-tinh">BIDV - Nguyễn Đức Tính</option>
              <option value="agribank">Agribank</option>
              <option value="bidv-the">BIDV - Phan Văn Thế</option>
            </select>

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
          {/* Top 5 Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {/* Tổng tiền vào */}
            <div className="flex flex-col justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Tổng tiền vào</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600">
                  <Wallet size={12} />
                </span>
              </div>
              <div className="mt-2 text-lg font-black font-mono text-indigo-700 dark:text-indigo-400">
                47.781.292 đ
              </div>
              <div className="mt-1 text-[10px] font-bold text-emerald-600">
                ▲ 12.5% so với kỳ trước
              </div>
            </div>

            {/* Đã xác nhận */}
            <div className="flex flex-col justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Đã xác nhận</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 size={12} />
                </span>
              </div>
              <div className="mt-2 text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
                1.000.000 đ
              </div>
              <div className="mt-1 text-[10px] font-bold text-muted">
                2.1% tổng tiền vào
              </div>
            </div>

            {/* Đang chờ */}
            <div className="flex flex-col justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Đang chờ</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                  <Clock size={12} />
                </span>
              </div>
              <div className="mt-2 text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                46.781.292 đ
              </div>
              <div className="mt-1 text-[10px] font-bold text-muted">
                97.9% tổng tiền vào
              </div>
            </div>

            {/* Tiền cọc */}
            <div className="flex flex-col justify-between rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Tiền cọc</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600">
                  <ShieldCheck size={12} />
                </span>
              </div>
              <div className="mt-2 text-lg font-black font-mono text-sky-700 dark:text-sky-400">
                8.000.000 đ
              </div>
              <div className="mt-1 text-[10px] font-bold text-muted">
                16.7% tổng tiền vào
              </div>
            </div>

            {/* Sai lệch cần xử lý */}
            <div className="flex flex-col justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted">Sai lệch cần xử lý</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600">
                  <AlertTriangle size={12} />
                </span>
              </div>
              <div className="mt-2 text-lg font-black font-mono text-rose-600 dark:text-rose-400">
                1 mục
              </div>
              <div className="mt-1 text-[10px] font-bold text-muted">
                0.2% tổng giao dịch
              </div>
            </div>
          </div>

          {/* 2-Column Main Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column (8 cols): Chart + Bank Accounts + Ledger */}
            <div className="space-y-6 lg:col-span-8">
              {/* Chart: So sánh tiền vào theo tài khoản */}
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={15} className="text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-text">
                      So sánh tiền vào theo tài khoản
                    </h3>
                  </div>
                  <span className="text-xs text-muted">Năm 2026</span>
                </div>

                <div className="mt-4 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fontWeight: 700 }}
                        stroke="#888"
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(val) => (val >= 1000000 ? `${val / 1000000}M` : `${val}`)}
                        stroke="#888"
                      />
                      <Tooltip
                        formatter={(val: any) => formatVnd(Number(val))}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.1)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Bar
                        dataKey="confirmed"
                        name="Đã xác nhận"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        barSize={32}
                      />
                      <Bar
                        dataKey="pending"
                        name="Đang chờ xác nhận"
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                        barSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 flex items-center justify-center gap-6 text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-[#10b981]" />
                    <span className="text-muted">Đã xác nhận</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-[#f59e0b]" />
                    <span className="text-muted">Đang chờ xác nhận</span>
                  </div>
                </div>
              </div>

              {/* Table: Chi tiết theo tài khoản ngân hàng */}
              <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs">
                <div className="border-b border-border/50 bg-surface/40 px-4 py-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-1.5">
                    <Landmark size={14} className="text-primary" />
                    Chi tiết theo tài khoản ngân hàng
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface/50 text-[10px] uppercase font-black text-muted border-b border-border/50">
                      <tr>
                        <th className="px-3 py-2.5">Ngân hàng</th>
                        <th className="px-3 py-2.5">Chủ tài khoản</th>
                        <th className="px-3 py-2.5">Số tài khoản / Mã</th>
                        <th className="px-3 py-2.5 text-center">Lượt QR</th>
                        <th className="px-3 py-2.5 text-right">Đã xác nhận</th>
                        <th className="px-3 py-2.5 text-right">Đang chờ</th>
                        <th className="px-3 py-2.5 text-right">Tiền cọc</th>
                        <th className="px-3 py-2.5">Trạng thái</th>
                        <th className="px-3 py-2.5 text-right">Thanh toán gần nhất</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      <tr className="hover:bg-surface/40 transition">
                        <td className="px-3 py-2.5 font-black text-text">
                          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-black">
                            BIDV
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-text">
                          HỘ KINH DOANH NGUYEN DUC TINH
                        </td>
                        <td className="px-3 py-2.5 font-mono text-muted">RLQJ</td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold">850</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">
                          1.000.000 đ
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600">
                          18.132.020 đ
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted">0 đ</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Đang hoạt động
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted font-mono text-[11px]">
                          22/12/2026 14:32
                        </td>
                      </tr>

                      <tr className="hover:bg-surface/40 transition">
                        <td className="px-3 py-2.5 font-black text-text">
                          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-black">
                            Agribank
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-text">DSDSD</td>
                        <td className="px-3 py-2.5 font-mono text-muted">sdsd</td>
                        <td className="px-3 py-2.5 text-center font-mono text-muted">0</td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted">0 đ</td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted">0 đ</td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted">0 đ</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted/10 px-2 py-0.5 text-[10px] font-bold text-muted">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                            Chưa có giao dịch
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted font-mono text-[11px]">-</td>
                      </tr>

                      <tr className="hover:bg-surface/40 transition">
                        <td className="px-3 py-2.5 font-black text-text">
                          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-black">
                            BIDV
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-text">
                          HỘ KINH DOANH PHAN VAN THE
                        </td>
                        <td className="px-3 py-2.5 font-mono text-muted">QGPR</td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold">432</td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted">0 đ</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600">
                          28.649.272 đ
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-sky-600">
                          8.000.000 đ
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Đang hoạt động
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted font-mono text-[11px]">
                          20/12/2026 10:12
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table: Bút toán hạch toán */}
              <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs">
                <div className="border-b border-border/50 bg-surface/40 px-4 py-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text flex items-center gap-1.5">
                    <Receipt size={14} className="text-primary" />
                    Bút toán hạch toán
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface/50 text-[10px] uppercase font-black text-muted border-b border-border/50">
                      <tr>
                        <th className="px-3 py-2.5">Ngày hạch toán</th>
                        <th className="px-3 py-2.5">Số chứng từ</th>
                        <th className="px-3 py-2.5">Diễn giải</th>
                        <th className="px-3 py-2.5">Tài khoản Nợ</th>
                        <th className="px-3 py-2.5">Tài khoản Có</th>
                        <th className="px-3 py-2.5 text-right">Số tiền (đ)</th>
                        <th className="px-3 py-2.5">Trạng thái</th>
                        <th className="px-3 py-2.5">Người tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      <tr className="hover:bg-surface/40 transition">
                        <td className="px-3 py-2.5 font-mono text-muted text-[11px]">22/12/2026</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-text">PT0001</td>
                        <td className="px-3 py-2.5 text-text">Thu tiền đơn hàng #DH02638 qua BIDV (RLQJ)</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-indigo-600">1121</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-emerald-600">5111</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">1.000.000</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-emerald-700">
                            POSTED
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted">System</td>
                      </tr>

                      <tr className="hover:bg-surface/40 transition">
                        <td className="px-3 py-2.5 font-mono text-muted text-[11px]">20/12/2026</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-text">PT0002</td>
                        <td className="px-3 py-2.5 text-text">Thu tiền đơn hàng #DH02615 qua BIDV (QGPR)</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-indigo-600">1121</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-emerald-600">5111</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">12.500.000</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-emerald-700">
                            POSTED
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted">System</td>
                      </tr>

                      <tr className="hover:bg-surface/40 transition">
                        <td className="px-3 py-2.5 font-mono text-muted text-[11px]">18/12/2026</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-text">PT0003</td>
                        <td className="px-3 py-2.5 text-text">Thu tiền đơn hàng #DH02611 qua BIDV (QGPR)</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-indigo-600">1121</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-emerald-600">5111</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">8.649.272</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-emerald-700">
                            POSTED
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted">System</td>
                      </tr>

                      <tr className="hover:bg-surface/40 transition">
                        <td className="px-3 py-2.5 font-mono text-muted text-[11px]">15/12/2026</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-text">PT0004</td>
                        <td className="px-3 py-2.5 text-text">Khách hàng đặt cọc - #HD02598 (BIDV)</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-indigo-600">1123</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-amber-600">3311</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">8.000.000</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-emerald-700">
                            POSTED
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted">Kế toán</td>
                      </tr>

                      <tr className="hover:bg-surface/40 transition">
                        <td className="px-3 py-2.5 font-mono text-muted text-[11px]">10/12/2026</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-text">PT0005</td>
                        <td className="px-3 py-2.5 text-text">Thu tiền đơn hàng #DH02577 qua BIDV (RLQJ)</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-indigo-600">1121</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-emerald-600">5111</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">500.000</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-emerald-700">
                            POSTED
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-muted">System</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column (4 cols): Stepper + Audit Log */}
            <div className="space-y-6 lg:col-span-4">
              {/* Card 1: Tiến trình đối soát */}
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                  <RefreshCw size={15} className="text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-text">
                    Tiến trình đối soát
                  </h3>
                </div>

                <div className="mt-4 space-y-4">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <CheckCircle2 size={13} />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-text">1. Tạo giao dịch thu</span>
                        <span className="text-[10px] text-muted font-mono">22/12 08:21</span>
                      </div>
                      <p className="text-[11px] text-muted">Phát sinh đơn hàng, tạo QR thanh toán</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <CheckCircle2 size={13} />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-text">2. Nhận webhook SePay</span>
                        <span className="text-[10px] text-muted font-mono">22/12 08:21</span>
                      </div>
                      <p className="text-[11px] text-muted">SePay gửi thông báo giao dịch thành công</p>
                    </div>
                  </div>

                  {/* Step 3 (Active) */}
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white font-mono text-xs font-bold">
                      3
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-purple-700 dark:text-purple-300">
                          3. Khớp nội dung chuyển khoản
                        </span>
                        <span className="rounded-full bg-purple-500/10 px-1.5 py-0.2 text-[9px] font-bold text-purple-700">
                          Đang xử lý
                        </span>
                      </div>
                      <p className="text-[11px] text-muted">Đối chiếu số tiền, nội dung, tài khoản</p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-3 opacity-60">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-muted font-mono text-xs font-bold">
                      4
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text">4. Xác nhận thu</span>
                        <span className="text-[10px] text-muted">Chờ xử lý</span>
                      </div>
                      <p className="text-[11px] text-muted">Kế toán xác nhận và phân bổ doanh thu</p>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex items-start gap-3 opacity-60">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-muted font-mono text-xs font-bold">
                      5
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text">5. Ghi sổ cái</span>
                        <span className="text-[10px] text-muted">Chờ xử lý</span>
                      </div>
                      <p className="text-[11px] text-muted">Tự động hạch toán vào sổ kế toán</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Nhật ký xử lý */}
              <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-text">
                      Nhật ký xử lý
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-muted">Tất cả</span>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-purple-500/10 text-purple-600">
                      ⚡
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text">Hệ thống</span>
                        <span className="text-[10px] text-muted font-mono">22/12 08:21:32</span>
                      </div>
                      <p className="text-[11px] text-muted">Nhận webhook SePay - GD: SP2412210001</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600">
                      👤
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text">Kế toán</span>
                        <span className="text-[10px] text-muted font-mono">22/12 08:25:10</span>
                      </div>
                      <p className="text-[11px] text-muted">Đối chiếu nội dung chuyển khoản</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-purple-500/10 text-purple-600">
                      ⚡
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text">Hệ thống</span>
                        <span className="text-[10px] text-muted font-mono">22/12 08:25:11</span>
                      </div>
                      <p className="text-[11px] text-muted">Tự động khớp với đơn hàng #DH02638</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600">
                      👤
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text">Kế toán</span>
                        <span className="text-[10px] text-muted font-mono">22/12 09:12:45</span>
                      </div>
                      <p className="text-[11px] text-muted">
                        Xác nhận giao dịch thu 1.000.000 đ (BIDV - RLQJ)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-purple-500/10 text-purple-600">
                      ⚡
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-text">Hệ thống</span>
                        <span className="text-[10px] text-muted font-mono">22/12 09:12:46</span>
                      </div>
                      <p className="text-[11px] text-muted">Tạo bút toán hạch toán và ghi sổ cái</p>
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
              alert("Đã gửi yêu cầu đối soát và đồng bộ dữ liệu SePay!");
              onClose();
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition"
          >
            <CheckCircle2 size={14} />
            <span>Xác nhận đối soát</span>
          </button>
        </div>
      </div>
    </div>
  );
}
