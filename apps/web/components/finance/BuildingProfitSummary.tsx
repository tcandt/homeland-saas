"use client";

import React, { Fragment, useMemo, useState } from "react";
import { AlertTriangle, Building2, ChevronDown, ChevronUp, Droplets, TrendingUp, Zap } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useBuildingProfitSummaryQuery } from "@/lib/queries/finance.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

function RoomStatusBadge({ status }: { status: string }) {
  const tone =
    status === "AVAILABLE"
      ? "bg-slate-100 text-slate-700"
      : status === "RENTED"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${tone}`}>
      {status === "AVAILABLE" ? "Trống" : status === "RENTED" ? "Đang thuê" : status}
    </span>
  );
}

export default function BuildingProfitSummary() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);
  const params = useMemo(() => ({ year, ...(month ? { month } : {}) }), [month, year]);
  const { data, isLoading, isError } = useBuildingProfitSummaryQuery(params);
  const rows = Array.isArray(data) ? data : [];

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => {
        const value = String(currentYear - index);
        return { value, label: value };
      }),
    [currentYear],
  );

  const monthOptions = [
    { value: "", label: "Cả năm" },
    ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Tháng ${index + 1}` })),
  ];

  return (
    <section className="overflow-hidden rounded-[16px] border border-border bg-card shadow-sm">
      <div className="border-b border-border p-[16px] md:p-[20px]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-[#8b5cf6]" />
              <h2 className="text-[16px] font-black text-text md:text-[18px]">Hiệu quả tòa nhà</h2>
            </div>
            <p className="mt-1 text-[12px] text-muted md:text-[13px]">
              Theo dõi doanh thu thuê phòng, điện, nước và dịch vụ cùng lợi nhuận, công nợ và cảnh báo vận hành theo từng tòa.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:w-[300px]">
            <Select value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
            <Select value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
          </div>
        </div>
      </div>

      {isLoading && <div className="p-8 text-center text-[13px] font-semibold text-muted">Đang tải báo cáo tòa nhà...</div>}
      {isError && <div className="p-8 text-center text-[13px] font-semibold text-rose-500">Không tải được báo cáo tòa nhà.</div>}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="p-8 text-center text-[13px] font-semibold text-muted">Chưa có dữ liệu tòa nhà.</div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] text-left text-sm">
            <thead className="bg-surface text-[11px] uppercase text-muted">
              <tr>
                <th className="w-[52px] px-4 py-3 font-black text-center">Mở</th>
                <th className="px-4 py-3 font-black">Tòa / chủ</th>
                <th className="px-4 py-3 font-black text-right">Lấp đầy</th>
                <th className="px-4 py-3 font-black text-right">Thuê phòng</th>
                <th className="px-4 py-3 font-black text-right">Điện</th>
                <th className="px-4 py-3 font-black text-right">Nước / DV</th>
                <th className="px-4 py-3 font-black text-right">Tổng thu</th>
                <th className="px-4 py-3 font-black text-right">Chi phí</th>
                <th className="px-4 py-3 font-black text-right">Lợi nhuận</th>
                <th className="px-4 py-3 font-black text-right">Biên LN</th>
                <th className="px-4 py-3 font-black">Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
                const positive = Number(row.profit || 0) >= 0;
                const isExpanded = expandedBuildingId === row.building.id;

                return (
                  <Fragment key={row.building.id}>
                    <tr className="border-t border-border hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBuildingId((current) => (current === row.building.id ? null : row.building.id))
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-text transition hover:bg-surface"
                          aria-label={isExpanded ? "Thu gọn danh sách phòng" : "Mở danh sách phòng"}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-black text-text">{row.building.code || row.building.name}</div>
                        <div className="text-[12px] text-muted">{row.owner?.name || "Chưa gắn chủ"}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-black text-text">{row.building.occupancyRate}%</div>
                        <div className="text-[12px] text-muted">
                          {row.building.occupiedRooms}/{row.building.roomCount} phòng
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-text">
                        {formatVnd(row.revenueBreakdown?.rent || 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-end gap-1 font-bold text-amber-600">
                          <Zap size={12} />
                          {formatVnd(row.revenueBreakdown?.electricity || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-end gap-1 font-bold text-sky-600">
                          <Droplets size={12} />
                          {formatVnd(row.revenueBreakdown?.waterAndService || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#059669]">{formatVnd(row.revenue)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-500">{formatVnd(row.expense)}</td>
                      <td className={`px-4 py-3 text-right font-black ${positive ? "text-[#059669]" : "text-rose-500"}`}>
                        {formatVnd(row.profit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${
                            positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          <TrendingUp size={12} />
                          {row.margin}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(row.alerts || []).length === 0 ? (
                          <span className="text-[12px] font-semibold text-muted">Ổn định</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {row.alerts.map((alert: string) => (
                              <span key={alert} className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-600">
                                <AlertTriangle size={12} />
                                {alert}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-t border-border bg-surface/60">
                        <td colSpan={11} className="px-4 py-4">
                          <div className="rounded-[14px] border border-border bg-white">
                            <div className="border-b border-border px-4 py-3">
                              <div className="text-[12px] font-black uppercase text-muted">Drill-down theo phòng</div>
                              <div className="mt-1 text-[13px] text-muted">
                                Doanh thu từng phòng trong tòa {row.building.code || row.building.name}.
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="bg-surface text-[11px] uppercase text-muted">
                                  <tr>
                                    <th className="px-4 py-3 font-black">Phòng</th>
                                    <th className="px-4 py-3 font-black">Trạng thái</th>
                                    <th className="px-4 py-3 font-black text-right">Thuê phòng</th>
                                    <th className="px-4 py-3 font-black text-right">Điện</th>
                                    <th className="px-4 py-3 font-black text-right">Nước / DV</th>
                                    <th className="px-4 py-3 font-black text-right">Khác</th>
                                    <th className="px-4 py-3 font-black text-right">Tổng thu</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(row.roomBreakdown || []).map((roomRow: any) => (
                                    <tr key={roomRow.room.id} className="border-t border-border">
                                      <td className="px-4 py-3">
                                        <div className="font-black text-text">{roomRow.room.code || roomRow.room.name}</div>
                                        <div className="text-[12px] text-muted">{roomRow.room.name || "Không có tên phòng"}</div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <RoomStatusBadge status={roomRow.room.status} />
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-text">
                                        {formatVnd(roomRow.revenueBreakdown?.rent || 0)}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-amber-600">
                                        {formatVnd(roomRow.revenueBreakdown?.electricity || 0)}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-sky-600">
                                        {formatVnd(roomRow.revenueBreakdown?.waterAndService || 0)}
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-violet-600">
                                        {formatVnd(roomRow.revenueBreakdown?.other || 0)}
                                      </td>
                                      <td className="px-4 py-3 text-right font-black text-[#059669]">
                                        {formatVnd(roomRow.revenue || 0)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
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
      )}
    </section>
  );
}
