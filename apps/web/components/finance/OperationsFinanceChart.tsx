"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatVnd } from "@/lib/utils/format";

export default function OperationsFinanceChart() {
  const [mounted, setMounted] = useState(false);
  const [selectedYear, setSelectedYear] = useState("2026");

  useEffect(() => {
    setMounted(true);
  }, []);

  // 12 Months chart data matching Mockup 1
  const chartData = useMemo(() => {
    return [
      { month: "T1", revenue: 200000, expense: 50000, profit: 150000, debt: 100000 },
      { month: "T2", revenue: 300000, expense: 50000, profit: 250000, debt: 150000 },
      { month: "T3", revenue: 400000, expense: 80000, profit: 320000, debt: 200000 },
      { month: "T4", revenue: 600000, expense: 100000, profit: 500000, debt: 250000 },
      { month: "T5", revenue: 800000, expense: 120000, profit: 680000, debt: 350000 },
      { month: "T6", revenue: 1200000, expense: 200000, profit: 1000000, debt: 500000 },
      { month: "T7", revenue: 2000000, expense: 300000, profit: 1700000, debt: 800000 },
      { month: "T8", revenue: 3800000, expense: 500000, profit: 3300000, debt: 1500000 },
      { month: "T9", revenue: 17500000, expense: 850000, profit: 23500000, debt: 5500000 },
      { month: "T10", revenue: 12000000, expense: 600000, profit: 18500000, debt: 9500000 },
      { month: "T11", revenue: 6500000, expense: 450000, profit: 14000000, debt: 11000000 },
      { month: "T12", revenue: 6000000, expense: 500000, profit: 12000000, debt: 12500000 },
    ];
  }, []);

  if (!mounted) {
    return (
      <Card className="flex h-[320px] items-center justify-center rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </Card>
    );
  }

  return (
    <Card
      data-testid="operations-finance-chart"
      className="flex h-[320px] flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs"
    >
      {/* Slim Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <BarChart3 size={13} />
          </span>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text">
              Biến động doanh thu, chi phí & lợi nhuận
            </h2>
            <p className="text-[11px] text-muted">
              Xu hướng tài chính trong 12 tháng gần nhất
            </p>
          </div>
        </div>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          aria-label="Chọn năm xem biến động tài chính"
          className="rounded-lg border border-border/70 bg-surface/40 px-2 py-1 text-xs font-semibold text-text shadow-2xs outline-none focus:border-primary"
        >
          <option value="2026">Năm 2026</option>
          <option value="2025">Năm 2025</option>
        </select>
      </div>

      {/* Chart Area */}
      <div className="h-[210px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fontWeight: 600 }}
              stroke="#888"
              tickLine={false}
              axisLine={{ stroke: "rgba(128,128,128,0.2)" }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(val) => (val >= 1000000 ? `${val / 1000000}M` : `${val}`)}
              stroke="#888"
              tickLine={false}
              axisLine={false}
              domain={[0, 24000000]}
              ticks={[0, 6000000, 12000000, 18000000, 24000000]}
            />
            <Tooltip
              formatter={(val: any) => formatVnd(Number(val))}
              contentStyle={{
                borderRadius: 10,
                fontSize: 11,
                border: "1px solid rgba(0,0,0,0.1)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            />
            <Bar
              dataKey="revenue"
              name="Doanh thu thực thu"
              fill="#8b5cf6"
              radius={[3, 3, 0, 0]}
              barSize={12}
            />
            <Bar
              dataKey="expense"
              name="Chi phí"
              fill="#f43f5e"
              radius={[3, 3, 0, 0]}
              barSize={12}
            />
            <Line
              type="monotone"
              dataKey="profit"
              name="Lợi nhuận ròng"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#10b981", strokeWidth: 1, stroke: "#fff" }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="debt"
              name="Công nợ phải thu"
              stroke="#f59e0b"
              strokeWidth={1.75}
              strokeDasharray="3 3"
              dot={{ r: 2, fill: "#f59e0b" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Slim Legend */}
      <div className="flex flex-wrap items-center justify-center gap-5 border-t border-border/30 pt-2 text-[11px] font-semibold">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-xs bg-[#8b5cf6]" />
          <span className="text-muted">Doanh thu thực thu</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-xs bg-[#f43f5e]" />
          <span className="text-muted">Chi phí</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#10b981]" />
          <span className="text-muted">Lợi nhuận ròng</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 border-t border-dashed border-[#f59e0b]" />
          <span className="text-muted">Công nợ phải thu</span>
        </div>
      </div>
    </Card>
  );
}
