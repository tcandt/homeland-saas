import React from "react";
import { AlertTriangle, Calendar, Sparkles, CreditCard, ArrowRight, ChevronRight } from "lucide-react";
import { useDashboardData } from "@/app/dashboard-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function HeroSummary() {
  const data = useDashboardData();

  return (
    <section className="grid grid-cols-1 xl:grid-cols-[1.4fr_3.5fr] gap-4 md:gap-5">
      <div className="bg-gradient-to-br from-primary to-secondary text-white rounded-2xl p-4 md:p-5 xl:p-6 relative overflow-hidden shadow-sm flex flex-col justify-center">
        <div className="relative z-10 w-full xl:max-w-xs">
          <p className="m-0 text-white/90 text-sm font-medium mb-1.5 hidden md:block">Tổng quan</p>
          <h2 className="text-xl md:text-2xl xl:text-3xl font-black leading-tight mb-2 tracking-tight">
            Hôm nay có {data.hero.tasksCount} việc<br />cần xử lý
          </h2>

          <p className="hidden md:block text-white/80 text-sm font-medium mb-5 leading-snug">
            Cùng xem nhanh tình hình hoạt động<br />của hệ thống hôm nay.
          </p>

          <div className="md:hidden flex flex-col gap-1.5 mb-3 mt-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <AlertTriangle size={12} className="text-danger" /> {data.hero.debt} công nợ
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              <Calendar size={12} className="text-warning" /> {data.hero.expiringContracts} hợp đồng sắp hết hạn
            </div>
          </div>

          <Button variant="secondary" className="w-fit flex items-center gap-2 text-primary bg-card hover:bg-card/90" size="sm">
            Xem chi tiết <ArrowRight size={14} className="md:w-4 md:h-4" />
          </Button>
        </div>

        <div className="absolute -right-5 -bottom-5 w-48 h-48 md:w-56 md:h-56 opacity-30 md:opacity-100 pointer-events-none flex items-end justify-end">
          <svg viewBox="0 0 200 200" className="w-full h-full text-white" fill="currentColor">
            <path d="M100 20 L180 60 L100 100 L20 60 Z" opacity="0.8" />
            <path d="M20 60 L100 100 L100 180 L20 140 Z" opacity="0.6" />
            <path d="M100 100 L180 60 L180 140 L100 180 Z" opacity="0.4" />
            <path d="M60 40 L140 80 L140 160 L60 120 Z" opacity="0.9" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="hidden xl:grid grid-cols-3 gap-4 flex-1">
          <AlertCard
            icon={<AlertTriangle size={18} className="text-danger" />}
            iconBg="bg-danger/10"
            count={data?.alerts?.[0]?.count || 0}
            title={data?.alerts?.[0]?.label || "Công nợ quá hạn"}
            desc={data?.alerts?.[0]?.amount || "0 đ"}
            descColor="text-danger"
          />
          <AlertCard
            icon={<Calendar size={18} className="text-warning" />}
            iconBg="bg-warning/10"
            count={data?.alerts?.[1]?.count || 0}
            title={data?.alerts?.[1]?.label || "Hợp đồng sắp hết hạn"}
            desc={data?.alerts?.[1]?.amount || ""}
            descColor="text-muted"
          />
          <AlertCard
            icon={<CreditCard size={18} className="text-indigo-500" />}
            iconBg="bg-indigo-500/10"
            count={data?.alerts?.[3]?.count || 0}
            title={data?.alerts?.[3]?.label || "Hóa đơn chờ duyệt"}
            desc={data?.alerts?.[3]?.amount || ""}
            descColor="text-muted"
          />
        </div>

        <AIInsights />
      </div>
    </section>
  );
}

function AlertCard({ icon, iconBg, count, title, desc, descColor }: any) {
  return (
    <Card className="flex flex-col justify-between relative overflow-hidden">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
          <div className="text-2xl font-black text-text leading-none">{count}</div>
        </div>
        <div className="mb-2">
          <div className="font-bold text-sm text-text mb-0.5 leading-tight">{title}</div>
          <div className={`text-xs font-bold ${descColor}`}>{desc}</div>
        </div>
      </div>
      <a href="#" className="text-primary text-xs font-bold hover:underline flex items-center gap-1 mt-1">
        Xem ngay <ArrowRight size={14} />
      </a>
    </Card>
  );
}

function AIInsights() {
  const context = useDashboardData();
  const insights = context?.insights || [];

  return (
    <Card className="flex flex-col gap-3 shrink-0 p-4">
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5 md:gap-2">
          <Sparkles className="text-primary" size={14} />
          <h3 className="font-black text-sm text-text m-0">AI HomeLand Insights</h3>
        </div>
      </div>

      {insights.length > 0 ? (
        <div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-4 gap-2 md:gap-3">
          {insights.map((ins: any, idx: number) => (
            <InsightCard
              key={idx}
              icon={<Sparkles size={14} className="text-primary" />}
              iconColor="bg-primary/10 text-primary"
              title={ins.text}
              value={ins.highlight}
              desc={ins.sub}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-3 text-center">
          <span className="text-xs font-medium text-muted">
            Chưa có đủ dữ liệu vận hành để AI phân tích. Gợi ý thông minh sẽ tự động xuất hiện khi có dữ liệu thật.
          </span>
        </div>
      )}
    </Card>
  );
}

function InsightCard({ icon, iconColor, title, value, desc }: any) {
  return (
    <div className="flex items-center justify-between md:bg-black/5 md:dark:bg-white/5 md:p-3 rounded-xl min-w-0 transition-colors cursor-pointer group">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-px">
            <span className="font-bold text-xs text-text truncate">{title}</span>
            {value && <span className="font-bold text-xs text-danger shrink-0">{value}</span>}
          </div>
          <div className="text-[10px] md:text-xs font-medium text-muted truncate leading-tight">{desc}</div>
        </div>
      </div>
      <ChevronRight size={14} className="text-muted md:hidden" />
    </div>
  );
}
