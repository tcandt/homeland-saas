import React from "react";
import { Wallet, Building, PieChart, TrendingUp } from "lucide-react";
import { useDashboardData } from "@/app/dashboard-context";
import { Card } from "@/components/ui/Card";

export default function KpiGrid() {
  const data = useDashboardData();

  return (
    <section data-testid="dashboard-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
      <KpiCard
        title={data.kpis[0].label}
        value={data.kpis[0].value}
        trend={data.kpis[0].trend}
        trendDown={!data.kpis[0].positive}
        icon={<Wallet size={14} className="text-success" />}
        iconBg="bg-success/10"
        colorHex="var(--success)"
        data={[40, 50, 45, 60, 55, 75, 90]}
      />
      <KpiCard
        title={data.kpis[1].label}
        value={data.kpis[1].value}
        trend={data.kpis[1].trend}
        trendDown={!data.kpis[1].positive}
        icon={<Building size={14} className="text-info" />}
        iconBg="bg-info/10"
        colorHex="var(--info)"
        data={[60, 55, 65, 70, 65, 80, 95]}
      />
      <KpiCard
        title={data.kpis[2].label}
        value={data.kpis[2].value}
        trend={data.kpis[2].trend}
        trendDown={!data.kpis[2].positive}
        icon={<PieChart size={14} className="text-primary" />}
        iconBg="bg-primary/10"
        colorHex="var(--primary)"
        data={[70, 75, 72, 80, 85, 82, 87]}
      />
      <KpiCard
        title={data.kpis[3].label}
        value={data.kpis[3].value}
        trend={data.kpis[3].trend}
        trendDown={!data.kpis[3].positive}
        icon={<TrendingUp size={14} className="text-warning" />}
        iconBg="bg-warning/10"
        colorHex="var(--warning)"
        data={[30, 40, 35, 50, 60, 55, 80]}
      />
    </section>
  );
}

function KpiCard({ title, value, trend, trendDown, icon, iconBg, colorHex, data = [] }: any) {
  const maxVal = Math.max(...data) * 1.1;
  const minVal = Math.min(...data) * 0.9;
  const range = maxVal - minVal;

  const points = data.map((val: number, i: number) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - minVal) / range) * 100;
    return { x, y };
  });

  return (
    <Card className="flex flex-col justify-between relative overflow-hidden p-3 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg} shrink-0`}>{icon}</div>
        <div className="text-xs font-bold text-muted uppercase tracking-wide">{title}</div>
      </div>

      <div className="flex flex-col flex-1 justify-end">
        <div className="text-xl md:text-2xl font-black text-text mb-1 leading-none">{value}</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs font-bold whitespace-nowrap">
            <span className={trendDown ? "text-danger" : "text-success"}>
              {trendDown ? "↓" : "↑"} {trend}
            </span>
            <span className="text-muted font-medium">so với tháng trước</span>
          </div>

          <div className="relative md:absolute md:right-5 md:bottom-5 w-10 md:w-20 h-4 md:h-10 opacity-80 pointer-events-none ml-1 md:ml-0 shrink-0">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
              <polyline
                points={points.map((p: any) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={colorHex}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {points.map((p: any, i: number) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.x}%`, top: `${p.y}%`, backgroundColor: colorHex }}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
