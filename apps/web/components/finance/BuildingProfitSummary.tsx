"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Building2, TrendingUp } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useBuildingProfitSummaryQuery } from "@/lib/queries/finance.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

export default function BuildingProfitSummary() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const params = useMemo(() => ({ year, ...(month ? { month } : {}) }), [month, year]);
  const { data, isLoading, isError } = useBuildingProfitSummaryQuery(params);
  const rows = Array.isArray(data) ? data : [];

  const yearOptions = useMemo(() => (
    Array.from({ length: 5 }, (_, index) => {
      const value = String(currentYear - index);
      return { value, label: value };
    })
  ), [currentYear]);

  const monthOptions = [
    { value: "", label: "Cả năm" },
    ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Tháng ${index + 1}` })),
  ];

  return (
    <section className="bg-card border border-border rounded-[16px] overflow-hidden shadow-sm">
      <div className="border-b border-border p-[16px] md:p-[20px]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-[#8b5cf6]" />
              <h2 className="font-black text-[16px] md:text-[18px] text-text">Hiệu quả tòa nhà</h2>
            </div>
            <p className="mt-1 text-[12px] md:text-[13px] text-muted">
              Theo dõi doanh thu, chi phí, lợi nhuận, công nợ quá hạn và cảnh báo vận hành theo từng tòa.
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
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-surface text-[11px] uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-black">Tòa / chủ</th>
                <th className="px-4 py-3 font-black text-right">Lấp đầy</th>
                <th className="px-4 py-3 font-black text-right">Doanh thu</th>
                <th className="px-4 py-3 font-black text-right">Chi phí</th>
                <th className="px-4 py-3 font-black text-right">Lợi nhuận</th>
                <th className="px-4 py-3 font-black text-right">Biên LN</th>
                <th className="px-4 py-3 font-black">Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
                const positive = Number(row.profit || 0) >= 0;
                return (
                  <tr key={row.building.id} className="border-t border-border hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-black text-text">{row.building.code || row.building.name}</div>
                      <div className="text-[12px] text-muted">{row.owner?.name || "Chưa gắn chủ"}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-black text-text">{row.building.occupancyRate}%</div>
                      <div className="text-[12px] text-muted">{row.building.occupiedRooms}/{row.building.roomCount} phòng</div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#059669]">{formatVnd(row.revenue)}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-500">{formatVnd(row.expense)}</td>
                    <td className={`px-4 py-3 text-right font-black ${positive ? "text-[#059669]" : "text-rose-500"}`}>
                      {formatVnd(row.profit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        <TrendingUp size={12} /> {row.margin}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(row.alerts || []).length === 0 ? (
                        <span className="text-[12px] font-semibold text-muted">Ổn định</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {row.alerts.map((alert: string) => (
                            <span key={alert} className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-600">
                              <AlertTriangle size={12} /> {alert}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
