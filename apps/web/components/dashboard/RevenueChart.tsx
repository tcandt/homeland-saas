import React from "react";
import { ChevronDown } from "lucide-react";
import { useDashboardData } from "@/app/dashboard-context";
import { useRevenueHistoryQuery } from "@/lib/queries/dashboard.queries";
import { buildRevenueChart } from "@/lib/utils/revenue-chart";

export default function RevenueChart() {
  const context = useDashboardData();
  const { data: remoteHistory, isLoading } = useRevenueHistoryQuery();
  const rawData = (remoteHistory && remoteHistory.length > 0) ? remoteHistory : (context?.revenueHistory || []);

  if (isLoading && rawData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full animate-pulse">
        <div className="flex justify-between items-center mb-[16px]">
          <div className="h-4 w-40 bg-muted/20 rounded" />
          <div className="h-6 w-16 bg-muted/20 rounded" />
        </div>
        <div className="flex-1 min-h-[220px] bg-muted/10 rounded-xl" />
      </div>
    );
  }

  if (rawData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full items-center justify-center min-h-[250px]">
        <div className="flex justify-between items-center mb-[16px] w-full">
          <h3 className="font-black text-[14px] text-text uppercase m-0">Doanh thu 6 tháng gần nhất</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
          <span className="text-muted font-bold text-[13px]">Chưa có dữ liệu doanh thu</span>
          <span className="text-[12px] text-muted/70 font-medium">Hệ thống sẽ cập nhật biểu đồ khi có hóa đơn được thanh toán.</span>
        </div>
      </div>
    );
  }

  const data = rawData;
  const chart = buildRevenueChart(data);
  const barsAndPoints = chart.points;
  const axisFormatter = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });

  return (
    <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[16px]">
        <h3 className="font-black text-[14px] text-text uppercase m-0">Doanh thu 6 tháng gần nhất</h3>
        <div className="border border-border/80 px-2 py-1 rounded-[6px] text-[12px] font-bold text-text flex items-center gap-1 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          6 tháng <ChevronDown size={14} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-[24px] mb-[20px]">
        <div className="flex items-center gap-2">
          <div className="w-[16px] h-[6px] rounded-full bg-[#3b82f6]" />
          <span className="text-[12px] font-medium text-muted">Doanh thu (đ)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[16px] h-[6px] rounded-full bg-[#22c55e]" />
          <span className="text-[12px] font-medium text-muted">Lợi nhuận (đ)</span>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col">
        <div className="absolute left-0 top-0 bottom-[24px] w-[35px] flex flex-col justify-between text-[10px] font-medium text-muted/80 z-10 pointer-events-none">
          {chart.ticks.map((amount, index) => <span key={index} title={`${amount} đ`}>{axisFormatter.format(amount)}</span>)}
        </div>

        <div data-testid="revenue-chart-plot" className="ml-[45px] relative flex-1 min-h-[180px] overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full h-px bg-border/40" />
            ))}
          </div>

          <div className="absolute w-full h-px bg-muted/40 pointer-events-none" style={{ top: `${chart.zeroY}%` }} />
          {barsAndPoints.map((p, i) => p.revenueTop !== null && (
            <div
              key={`bar-${i}`}
              className="absolute w-[24px] bg-[#3b82f6] rounded-t-[4px] transition-all duration-700 transform -translate-x-1/2 hover:opacity-80 cursor-pointer"
              style={{ left: `${p.cx}%`, top: `${p.revenueTop}%`, height: `${p.revenueHeight}%` }}
              title={`Doanh thu: ${p.revenue} đ`}
            />
          ))}

          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {chart.profitSegments.map((points, index) => <polyline
              key={index}
              points={points}
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />)}
          </svg>

          {barsAndPoints.map((p, i) => p.profitY !== null && (
            <div
              key={`dot-${i}`}
              className="absolute w-[8px] h-[8px] bg-[#22c55e] border-[2px] border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10 shadow-sm transition-all duration-700"
              style={{ left: `${p.cx}%`, top: `${p.profitY}%` }}
              title={`Lợi nhuận: ${p.profit} đ`}
            />
          ))}
        </div>

        <div className="ml-[45px] mt-[8px] relative h-[16px] pointer-events-none">
          {data.map((d: any, i: number) => {
            const cx = barsAndPoints[i].cx;
            return (
              <div key={i} className="absolute text-[10px] font-bold text-muted text-center transform -translate-x-1/2 w-max" style={{ left: `${cx}%` }}>
                {d.month}
              </div>
            );
          })}
        </div>
      </div>

      {chart.hasMissingValues && <p role="status" className="mt-2 text-xs text-muted">Một số kỳ chưa có số liệu hợp lệ; không biểu diễn thành 0.</p>}

      <a href="#" className="mt-[28px] block text-center py-[12px] border border-border/80 rounded-[12px] text-[#4f46e5] text-[13px] font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        Xem báo cáo doanh thu {`->`}
      </a>
    </div>
  );
}
