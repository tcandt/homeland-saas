import React from "react";
import { ChevronDown } from "lucide-react";
import { useDashboardData } from "@/app/dashboard-context";

export default function RevenueChart() {
  const context = useDashboardData();
  const rawData = context?.revenueHistory || [];

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
  const maxRevenue = Math.max(...data.map((d: any) => Number(d.revenue) || 0), 100);

  const barsAndPoints = data.map((d: any, i: number) => {
    const barWidth = 100 / data.length;
    const cx = i * barWidth + barWidth / 2;
    const cyLine = 100 - (d.profit / maxRevenue) * 100;
    const hBar = (d.revenue / maxRevenue) * 100;
    return { cx, cyLine, hBar };
  });

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
          <span>500M</span>
          <span>300M</span>
          <span>200M</span>
          <span>100M</span>
          <span>0</span>
        </div>

        <div className="ml-[45px] relative flex-1 min-h-[180px]">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full h-px bg-border/40" />
            ))}
          </div>

          {barsAndPoints.map((p: any, i: number) => (
            <div
              key={`bar-${i}`}
              className="absolute bottom-0 w-[24px] bg-[#3b82f6] rounded-t-[4px] transition-all duration-700 transform -translate-x-1/2 hover:opacity-80 cursor-pointer"
              style={{ left: `${p.cx}%`, height: `${p.hBar}%` }}
            />
          ))}

          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              points={barsAndPoints.map((p: any) => `${p.cx},${p.cyLine}`).join(" ")}
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {barsAndPoints.map((p: any, i: number) => (
            <div
              key={`dot-${i}`}
              className="absolute w-[8px] h-[8px] bg-[#22c55e] border-[2px] border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10 shadow-sm transition-all duration-700"
              style={{ left: `${p.cx}%`, top: `${p.cyLine}%` }}
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

      <a href="#" className="mt-[28px] block text-center py-[12px] border border-border/80 rounded-[12px] text-[#4f46e5] text-[13px] font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        Xem báo cáo doanh thu {`->`}
      </a>
    </div>
  );
}
