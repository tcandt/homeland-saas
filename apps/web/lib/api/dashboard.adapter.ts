import { apiClient } from "./client";

export const dashboardAdapter = {
  async getDashboardData() {
    const realData: any = await apiClient.get("/dashboard");
    if (!realData) throw new Error("Dashboard data is empty");

    return {
      hero: {
        tasksCount: realData.hero?.tasksCount || 0,
        debt: `${(realData.kpis?.totalDebt || 0).toLocaleString()} đ`,
        expiringContracts: realData.hero?.expiringContracts || 0,
        cleaningRooms: realData.hero?.cleaningRooms || 0,
      },
      alerts: realData.alerts || [],
      kpis: [
        { label: "Doanh thu tháng này", value: `${(realData.kpis?.totalRevenue || 0).toLocaleString()} đ`, trend: "", positive: true, icon: "green" },
        { label: "Lợi nhuận ròng", value: `${(realData.kpis?.netProfit || 0).toLocaleString()} đ`, trend: "", positive: realData.kpis?.netProfit >= 0, icon: "blue" },
        { label: "Tỷ lệ lấp đầy", value: `${realData.occupancy?.rate || 0}%`, trend: "", positive: true, icon: "purple" },
        { label: "Dòng tiền ròng", value: `${(realData.kpis?.netCashFlow || 0).toLocaleString()} đ`, trend: "", positive: realData.kpis?.netCashFlow >= 0, icon: "orange" },
      ],
      revenueHistory: realData.revenueHistory || [],
      buildingHealth: realData.buildingHealth || [],
      tasks: realData.tasks || [],
      recentActivity: realData.recentActivity || [],
      cashFlowForecast: realData.cashFlowForecast || [],
      occupancy: realData.occupancy || { rate: 0, rented: 0, available: 0, maintenance: 0, reserved: 0 },
    };
  },
};
