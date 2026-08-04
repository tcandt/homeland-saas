import { apiClient } from "./client";

function formatVnd(amount: number) {
  return `${Number(amount || 0).toLocaleString("vi-VN")} đ`;
}

export const dashboardAdapter = {
  async getDashboardData() {
    const data: any = await apiClient.get("/dashboard");
    if (!data) throw new Error("Dashboard data is empty");

    const kpis = data.kpis || {};
    const occupancy = data.occupancy || {};

    return {
      ...data,
      hero: {
        tasksCount: data.hero?.tasksCount || 0,
        debt: formatVnd(kpis.totalDebt || 0),
        expiringContracts: data.hero?.expiringContracts || 0,
        cleaningRooms: data.hero?.cleaningRooms || 0,
        maintenanceRooms: data.hero?.maintenanceRooms || 0,
      },
      alerts: data.alerts || [],
      kpis: [
        { label: "Doanh thu tháng này", value: formatVnd(kpis.totalRevenue || 0), trend: "", positive: true, icon: "green" },
        { label: "Lợi nhuận ròng", value: formatVnd(kpis.netProfit || 0), trend: "", positive: Number(kpis.netProfit || 0) >= 0, icon: "blue" },
        { label: "Tỷ lệ lấp đầy", value: `${Number(occupancy.rate || 0).toFixed(0)}%`, trend: "", positive: true, icon: "purple" },
        { label: "Dòng tiền ròng", value: formatVnd(kpis.netCashFlow || 0), trend: "", positive: Number(kpis.netCashFlow || 0) >= 0, icon: "orange" },
      ],
      kpisRaw: kpis,
      revenueHistory: data.revenueHistory || [],
      buildingHealth: data.buildingHealth || [],
      buildings: data.buildingHealth || [],
      tasks: data.tasks || [],
      recentActivity: data.recentActivity || [],
      cashFlowForecast: data.cashFlowForecast || [],
      insights: data.insights || [],
      occupancy: {
        rate: 0,
        rented: 0,
        available: 0,
        maintenance: 0,
        reserved: 0,
        ...occupancy,
      },
    };
  },
};
