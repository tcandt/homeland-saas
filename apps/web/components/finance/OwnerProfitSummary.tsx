"use client";

import React, { Fragment, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  HandCoins,
  ReceiptText,
  TrendingUp,
  Wallet,
  Minus,
  PlusCircle,
  Eye,
  Calendar,
  Building,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { useOwnerProfitDetailQuery, useOwnerProfitSummaryQuery } from "@/lib/queries/finance.queries";

const formatMoney = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return value.toLocaleString("vi-VN");
};

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

export default function OwnerProfitSummary() {
  const { data, isLoading } = useOwnerProfitSummaryQuery();
  const rows = Array.isArray(data) ? data : [];
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  return (
    <>
      <Card data-testid="owner-profit-summary" className="overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <HandCoins size={16} />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-black text-text tracking-tight">
                Chia lợi nhuận theo chủ sở hữu (Owner P&L Allocation)
              </h2>
              <p className="text-[11px] font-semibold text-muted">
                Tổng hợp doanh thu, chi phí, hoàn ứng và phân bổ lợi nhuận ròng cho từng chủ nhà
              </p>
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-muted/10 border border-border/60 text-xs font-bold text-muted">
            {rows.length} chủ sở hữu
          </div>
        </div>

        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {isLoading && (
            <div className="col-span-2 p-8 text-center text-xs font-semibold text-muted">
              Đang tải danh sách phân bổ lợi nhuận chủ nhà...
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="col-span-2 p-8 text-center text-xs font-semibold text-muted">
              Chưa có dữ liệu chủ sở hữu. Hãy gắn chủ sở hữu cho tòa nhà để bắt đầu theo dõi.
            </div>
          )}

          {rows.map((row: any) => {
            const profit = Number(row.profitAfterAdvance || 0);
            const isPositive = profit >= 0;

            return (
              <div
                key={row.owner.id}
                data-testid={`owner-profit-card-${row.owner.id}`}
                className="rounded-xl border border-border/70 bg-background/50 hover:bg-muted/5 p-3.5 shadow-2xs transition-all flex flex-col justify-between gap-3"
              >
                {/* Top: Owner Info + Net Profit Pill + Action */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-black text-sm shadow-2xs">
                      {row.owner.name ? row.owner.name.slice(0, 2).toUpperCase() : "OW"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-text">{row.owner.name}</span>
                        <span className="rounded-md bg-muted/10 border border-border/60 px-1.5 py-0.2 text-[10px] font-bold font-mono text-muted">
                          {row.owner.code || "OW"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted font-medium">
                        <Building2 size={12} className="text-primary shrink-0" />
                        <span className="truncate max-w-[220px]">
                          {(row.buildings || []).map((b: any) => b.code || b.name).join(", ") || "Chưa gán tòa"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-right">
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                        Còn lại thực nhận
                      </span>
                      <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                        {formatMoney(profit)}
                      </span>
                    </div>

                    <Button
                      data-testid={`owner-profit-open-${row.owner.id}`}
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedOwnerId(row.owner.id)}
                      className="h-9 px-2.5 rounded-xl border-border/70 hover:border-primary/50 text-xs font-bold shadow-2xs shrink-0"
                    >
                      <Eye size={13} className="mr-1 text-primary" />
                      Chi tiết
                    </Button>
                  </div>
                </div>

                {/* Bottom: 4 Clean KPI Stat Boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/40">
                  <div className="p-2 rounded-lg bg-card border border-border/60 shadow-2xs">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted block">
                      Tổng thu
                    </span>
                    <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      {formatMoney(Number(row.revenue || 0))}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-card border border-border/60 shadow-2xs">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted block">
                      Tổng chi
                    </span>
                    <span className="font-mono font-black text-xs text-rose-600 dark:text-rose-400 block mt-0.5">
                      {formatMoney(Number(row.expense || 0))}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-card border border-border/60 shadow-2xs">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted block truncate">
                      Thu hoàn ứng
                    </span>
                    <span className="font-mono font-black text-xs text-sky-600 dark:text-sky-400 block mt-0.5">
                      {formatMoney(Number(row.advanceReceivable || 0))}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-card border border-border/60 shadow-2xs">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted block truncate">
                      Khấu trừ chi hộ
                    </span>
                    <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-400 block mt-0.5">
                      {formatMoney(Number(row.advancePayable || 0))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <OwnerProfitDetailModal ownerId={selectedOwnerId} onClose={() => setSelectedOwnerId("")} />
    </>
  );
}

function OwnerProfitDetailModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);
  const params = useMemo(() => ({ year, ...(month ? { month } : {}) }), [month, year]);
  const { data, isLoading, isError } = useOwnerProfitDetailQuery(ownerId, params);

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => {
        const value = String(currentYear - index);
        return { value, label: `Năm ${value}` };
      }),
    [currentYear],
  );

  const monthOptions = [
    { value: "", label: "Cả năm" },
    ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Tháng ${index + 1}` })),
  ];

  return (
    <Modal
      isOpen={!!ownerId}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="text-base font-black text-text">
            {data?.owner?.name ? `Chi tiết phân bổ: ${data.owner.name}` : "Chi tiết phân bổ chủ sở hữu"}
          </span>
          {data?.owner?.code && (
            <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-mono font-bold text-primary">
              {data.owner.code}
            </span>
          )}
        </div>
      }
      maxWidth="max-w-5xl"
      testId="owner-profit-detail-modal"
      footer={
        <div className="flex items-center justify-end w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-muted/5 border border-border/60">
          <div>
            <span className="text-[11px] font-black uppercase text-text block">Bộ lọc chu kỳ quyết toán</span>
            <span className="text-[11px] text-muted">Lọc theo tháng/năm để tra cứu dòng tiền và tỷ lệ chia lợi nhuận</span>
          </div>

          <div className="flex items-center gap-2">
            <Select data-testid="owner-profit-detail-year" value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
            <Select data-testid="owner-profit-detail-month" value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
          </div>
        </div>

        {isLoading && (
          <div className="p-12 text-center text-xs font-semibold text-muted">
            Đang tải dữ liệu chi tiết quyết toán...
          </div>
        )}

        {isError && (
          <div className="p-8 text-center text-xs font-semibold text-rose-500">
            Không tải được chi tiết quyết toán chủ sở hữu.
          </div>
        )}

        {!isLoading && !isError && data && (
          <>
            {/* 6 Metric KPI Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="p-2.5 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] font-bold text-muted uppercase block">Tổng thu</span>
                <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  {formatVnd(data.summary?.revenue || 0)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] font-bold text-muted uppercase block">Tổng chi</span>
                <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400 block mt-0.5">
                  {formatVnd(data.summary?.expense || 0)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] font-bold text-muted uppercase block">Trước hoàn ứng</span>
                <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 block mt-0.5">
                  {formatVnd(data.summary?.profitBeforeAdvance || 0)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] font-bold text-muted uppercase block truncate">Thu hoàn ứng</span>
                <span className="font-mono font-black text-sm text-sky-600 dark:text-sky-400 block mt-0.5">
                  {formatVnd(data.summary?.advanceReceivable || 0)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-card border border-border/60 shadow-2xs">
                <span className="text-[10px] font-bold text-muted uppercase block truncate">Khấu trừ</span>
                <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400 block mt-0.5">
                  {formatVnd(data.summary?.advancePayable || 0)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-2xs">
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase block">Thực nhận</span>
                <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400 block mt-0.5">
                  {formatVnd(data.summary?.profitAfterAdvance || 0)}
                </span>
              </div>
            </div>

            {/* Building Breakdown Table */}
            <div data-testid="owner-profit-building-breakdown" className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs">
              <div className="border-b border-border/60 bg-muted/5 px-3.5 py-2.5 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-muted">Danh sách tòa thuộc chủ sở hữu</h3>
                <span className="text-[11px] text-muted font-medium">Bấm mũi tên để xem chi tiết từng phòng</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/5 border-b border-border/60 text-[10px] uppercase font-black text-muted">
                    <tr>
                      <th className="w-10 px-3 py-2 text-center">Mở</th>
                      <th className="px-3 py-2">Tòa nhà</th>
                      <th className="px-3 py-2 text-right">Tiền phòng</th>
                      <th className="px-3 py-2 text-right">Điện</th>
                      <th className="px-3 py-2 text-right">Nước & DV</th>
                      <th className="px-3 py-2 text-right">Khác</th>
                      <th className="px-3 py-2 text-right">Tổng thu</th>
                      <th className="px-3 py-2 text-right">Tổng chi</th>
                      <th className="px-3 py-2 text-right">Lợi nhuận</th>
                      <th className="px-3 py-2 text-right">HĐ trễ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {(data.buildingBreakdown || []).map((row: any) => {
                      const isExpanded = expandedBuildingId === row.building.id;

                      return (
                        <Fragment key={row.building.id}>
                          <tr data-testid={`owner-profit-building-row-${row.building.id}`} className="hover:bg-muted/5 transition-colors">
                            <td className="px-3 py-2.5 text-center">
                              <button
                                data-testid={`owner-profit-building-toggle-${row.building.id}`}
                                type="button"
                                onClick={() => setExpandedBuildingId((current) => (current === row.building.id ? null : row.building.id))}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-text transition hover:bg-muted/10"
                                aria-label={isExpanded ? "Thu gọn chi tiết tòa" : "Mở chi tiết tòa"}
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 font-bold text-text">{row.building.code || row.building.name}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-text">{formatVnd(row.revenueBreakdown?.rent || 0)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-amber-600">{formatVnd(row.revenueBreakdown?.electricity || 0)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-sky-600">{formatVnd(row.revenueBreakdown?.waterAndService || 0)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-purple-600">{formatVnd(row.revenueBreakdown?.other || 0)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">{formatVnd(row.revenue)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-500">{formatVnd(row.expense)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-black text-text">{formatVnd(row.profit)}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-text">{row.overdueInvoices || 0}</td>
                          </tr>

                          {isExpanded && (
                            <tr className="border-t border-border/50 bg-muted/5">
                              <td colSpan={10} className="p-3">
                                <div className="overflow-hidden rounded-lg border border-border/60 bg-card p-2.5">
                                  <span className="text-[11px] font-bold text-muted block mb-2">
                                    Chi tiết phòng thuộc tòa <b>{row.building.code || row.building.name}</b>
                                  </span>
                                  <table data-testid={`owner-profit-room-breakdown-${row.building.id}`} className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-muted/5 text-[9px] uppercase font-black text-muted">
                                      <tr>
                                        <th className="px-2 py-1.5">Phòng</th>
                                        <th className="px-2 py-1.5 text-right">Thuê phòng</th>
                                        <th className="px-2 py-1.5 text-right">Điện</th>
                                        <th className="px-2 py-1.5 text-right">Nước & DV</th>
                                        <th className="px-2 py-1.5 text-right">Khác</th>
                                        <th className="px-2 py-1.5 text-right">Tổng thu</th>
                                        <th className="px-2 py-1.5 text-right">Chi phí</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30">
                                      {(row.roomBreakdown || []).map((roomRow: any) => (
                                        <tr key={`${row.building.id}:${roomRow.room.id}`}>
                                          <td className="px-2 py-1.5 font-bold text-text">{roomRow.room.code || roomRow.room.name}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-muted">{formatVnd(roomRow.rent || 0)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-amber-600">{formatVnd(roomRow.electricity || 0)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-sky-600">{formatVnd(roomRow.waterAndService || 0)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-purple-600">{formatVnd(roomRow.other || 0)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-600">{formatVnd(roomRow.revenue || 0)}</td>
                                          <td className="px-2 py-1.5 text-right font-mono font-bold text-rose-500">{formatVnd(roomRow.expense || 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
