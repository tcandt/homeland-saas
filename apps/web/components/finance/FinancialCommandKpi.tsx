import React from "react";
import { Building, CheckCircle, DollarSign, Minus, PieChart, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { useDashboardQuery } from "@/lib/queries/dashboard.queries";

type FinanceKpiCard = {
  label: string;
  value: string;
  unit: string;
  detail: string;
  formula: string;
  icon: LucideIcon;
  color: string;
  bg: string;
};

export default function FinancialCommandKpi() {
  const { data: dashboard, isLoading } = useDashboardQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-[12px] md:grid-cols-4 md:gap-[16px] 2xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[150px] animate-pulse rounded-[16px] border border-border bg-card/50" />
        ))}
      </div>
    );
  }

  const kpisData = (dashboard as any)?.kpisRaw || {};
  const occupancy = (dashboard as any)?.occupancy || {};
  const collectionRate =
    Number(kpisData.totalRevenue || 0) + Number(kpisData.totalDebt || 0) > 0
      ? Math.round(
          (Number(kpisData.totalRevenue || 0) / (Number(kpisData.totalRevenue || 0) + Number(kpisData.totalDebt || 0))) * 100,
        )
      : 0;

  const netProfit = Number(kpisData.netProfit || 0);

  const kpis: FinanceKpiCard[] = [
    {
      label: "Tiền mặt ròng",
      value: Number(kpisData.netCashFlow || 0).toLocaleString("vi-VN"),
      unit: "VNĐ",
      detail: "Dòng tiền thực còn lại sau khi đã trừ khoản chi.",
      formula: "Thu tiền - chi tiền",
      icon: DollarSign,
      color: "text-[#8b5cf6]",
      bg: "bg-[#8b5cf6]/10",
    },
    {
      label: "Doanh thu P&L",
      value: Number(kpisData.totalRevenue || 0).toLocaleString("vi-VN"),
      unit: "VNĐ",
      detail: "Doanh thu ghi nhận từ tiền phòng, dịch vụ và khoản thu hợp lệ.",
      formula: "Nguồn doanh thu trong kỳ",
      icon: TrendingUp,
      color: "text-[#6366f1]",
      bg: "bg-[#6366f1]/10",
    },
    {
      label: "Chi phí P&L",
      value: Number(kpisData.totalExpense || 0).toLocaleString("vi-VN"),
      unit: "VNĐ",
      detail: "Chi phí vận hành đã ghi nhận để tính kết quả kinh doanh.",
      formula: "Bảo trì + vận hành + chi khác",
      icon: Wallet,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
    {
      label: "Lợi nhuận ròng",
      value: netProfit.toLocaleString("vi-VN"),
      unit: "VNĐ",
      detail: "Kết quả P&L cuối cùng sau khi lấy doanh thu trừ chi phí.",
      formula: "Doanh thu - chi phí",
      icon: PieChart,
      color: netProfit >= 0 ? "text-[#8b5cf6]" : "text-rose-500",
      bg: netProfit >= 0 ? "bg-[#8b5cf6]/10" : "bg-rose-500/10",
    },
    {
      label: "Phải thu",
      value: Number(kpisData.totalDebt || 0).toLocaleString("vi-VN"),
      unit: "VNĐ",
      detail: "Công nợ còn chờ thu từ hóa đơn hoặc khoản phát sinh.",
      formula: "Đã phát sinh - đã thu",
      icon: Minus,
      color: "text-[#f97316]",
      bg: "bg-[#f97316]/10",
    },
    {
      label: "Tiền cọc giữ",
      value: Number(kpisData.depositHeld || 0).toLocaleString("vi-VN"),
      unit: "VNĐ",
      detail: "Tiền đặt cọc đang giữ, cần theo dõi hoàn trả hoặc khấu trừ.",
      formula: "Cọc đang hiệu lực",
      icon: Building,
      color: "text-[#0ea5e9]",
      bg: "bg-[#0ea5e9]/10",
    },
    {
      label: "Tỷ lệ thu",
      value: `${collectionRate}%`,
      unit: "",
      detail: "Mức thu tiền so với tổng khoản cần thu, phản ánh sức khỏe thu nợ.",
      formula: "Đã thu / (đã thu + phải thu)",
      icon: CheckCircle,
      color: "text-[#8b5cf6]",
      bg: "bg-[#8b5cf6]/10",
    },
    {
      label: "Lấp đầy",
      value: String(Math.round(Number(occupancy.rate || 0))),
      unit: "%",
      detail: "Tỷ lệ phòng đang có khách thuê trên tổng phòng khả dụng.",
      formula: "Phòng thuê / tổng phòng",
      icon: TrendingUp,
      color: "text-[#a855f7]",
      bg: "bg-[#a855f7]/10",
    },
  ];

  const toTestId = (label: string) =>
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return (
    <div data-testid="finance-kpi-grid" className="grid grid-cols-2 gap-[12px] md:grid-cols-4 md:gap-[16px] 2xl:grid-cols-8">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          data-testid={`finance-kpi-card-${toTestId(kpi.label)}`}
          className="group relative flex min-h-[150px] flex-col overflow-hidden rounded-[16px] border border-border bg-card p-[14px] shadow-sm transition-all hover:shadow-md"
        >
          <div className="z-10 flex items-center justify-between">
            <span className="min-w-0 pr-2 text-[11px] font-bold uppercase tracking-wide text-muted transition-colors group-hover:text-text md:text-[12px]">
              {kpi.label}
            </span>
            <div className={`flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full ${kpi.bg}`}>
              <kpi.icon size={12} className={kpi.color} />
            </div>
          </div>

          <div className="z-10 mt-[10px] flex items-end justify-between">
            <div className="flex min-w-0 items-baseline gap-[4px]">
              <span className="truncate text-[18px] font-black leading-none text-text md:text-[20px]">{kpi.value}</span>
              {kpi.unit && <span className={`shrink-0 text-[10px] font-bold ${kpi.color}`}>{kpi.unit}</span>}
            </div>
          </div>

          <p className="z-10 mt-[10px] line-clamp-2 text-[11px] font-medium leading-[15px] text-muted">{kpi.detail}</p>
          <div className={`z-10 mt-auto truncate rounded-[8px] px-2 py-1 text-[10px] font-bold ${kpi.bg} ${kpi.color}`}>{kpi.formula}</div>

          <div className={`absolute -right-4 -bottom-4 h-16 w-16 rounded-full opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-10 ${kpi.bg.replace("/10", "")}`} />
        </div>
      ))}
    </div>
  );
}
