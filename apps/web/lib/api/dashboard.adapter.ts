import { apiClient } from "./client";
import { adaptBuilding } from "../adapters/building.adapter";
import { buildingsApi } from "./buildings.api";
import { createCockpitBuildingSpec } from "@/components/buildings/cockpit/building-cockpit-data";
import { getBuildingMetrics } from "@/components/buildings/cockpit/building-cockpit-metrics";
import { buildingTemplateRegistry } from "@/components/buildings/cockpit/building-template-registry";

function formatVnd(amount: number) {
  return `${Number(amount || 0).toLocaleString("vi-VN")} đ`;
}

function buildRecentMonths(monthlyRevenue: number) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const isCurrentMonth = index === 5;
    return {
      month: `T${date.getMonth() + 1}`,
      revenue: isCurrentMonth ? monthlyRevenue : 0,
      profit: isCurrentMonth ? monthlyRevenue : 0,
    };
  });
}

async function getSyncedBuildingPortfolio() {
  try {
    const response: any = await buildingsApi.list({ limit: 100 });
    const items = Array.isArray(response) ? response : response?.data || response?.items || [];
    const buildings = items.map(adaptBuilding);

    const buildingHealth = buildingTemplateRegistry.map((descriptor) => {
      const spec = createCockpitBuildingSpec(buildings, descriptor.code);
      const isPending = descriptor.layoutStatus === "pending" || spec?.layoutStatus === "pending";

      if (!spec || isPending) {
        return {
          id: descriptor.code,
          code: descriptor.code,
          name: descriptor.code,
          rooms: 0,
          occupied: 0,
          vacant: 0,
          fillRate: 0,
          warning: 0,
          status: "Coming Soon",
          statusType: "pending",
          layoutStatus: "pending",
        };
      }

      const metrics = getBuildingMetrics(spec);
      const layoutRoomCount = spec.floors.flatMap((floor) => floor.rooms).length;
      const hasOperationalRooms = metrics.totalRooms > 0;

      return {
        id: descriptor.code,
        code: descriptor.code,
        name: spec.name || descriptor.code,
        address: spec.address,
        rooms: hasOperationalRooms ? metrics.totalRooms : layoutRoomCount,
        occupied: metrics.occupiedRooms,
        vacant: hasOperationalRooms ? metrics.vacantRooms : layoutRoomCount,
        fillRate: hasOperationalRooms ? metrics.occupancyRate : 0,
        warning: metrics.expiringContracts,
        overdue: metrics.overduePayments,
        monthlyRevenue: metrics.monthlyRevenue,
        status: "Đang hoạt động",
        statusType: metrics.expiringContracts > 0 ? "warning" : "success",
        layoutStatus: "configured",
      };
    });

    const operationalBuildings = buildingHealth.filter((building: any) => building.layoutStatus !== "pending");
    const totalRooms = operationalBuildings.reduce((sum: number, building: any) => sum + Number(building.rooms || 0), 0);
    const occupiedRooms = operationalBuildings.reduce((sum: number, building: any) => sum + Number(building.occupied || 0), 0);
    const vacantRooms = operationalBuildings.reduce((sum: number, building: any) => sum + Number(building.vacant || 0), 0);
    const monthlyRevenue = operationalBuildings.reduce((sum: number, building: any) => sum + Number(building.monthlyRevenue || 0), 0);

    return {
      buildingHealth,
      occupancy: {
        totalRooms,
        occupiedRooms,
        rented: occupiedRooms,
        available: vacantRooms,
        rate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      },
      monthlyRevenue,
    };
  } catch {
    return null;
  }
}

export const dashboardAdapter = {
  async getDashboardData() {
    const raw: any = await apiClient.get("/dashboard");
    if (!raw) throw new Error("Dashboard data is empty");

    const data: any = (raw.data && typeof raw.data === 'object' && (raw.data.hero || raw.data.kpis))
      ? raw.data
      : (raw.hero || raw.kpis ? raw : (raw.data || raw));

    const kpis = {
      totalRevenue: Number(data.kpis?.totalRevenue || 0),
      totalExpense: Number(data.kpis?.totalExpense || 0),
      netProfit: Number(data.kpis?.netProfit || 0),
      netCashFlow: Number(data.kpis?.netCashFlow || 0),
      totalDebt: Number(data.kpis?.totalDebt || 0),
      depositHeld: Number(data.kpis?.depositHeld || 0),
    };

    const totalRooms = Number(data.occupancy?.totalRooms || 0);
    const occupiedRooms = Number(data.occupancy?.occupiedRooms || data.occupancy?.rented || 0);
    const rate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : Number(data.occupancy?.rate || 0);

    const occupancy = {
      rate,
      totalRooms,
      occupiedRooms,
      rented: occupiedRooms,
      available: Number(data.occupancy?.available || 0),
      maintenance: Number(data.occupancy?.maintenance || 0),
      reserved: Number(data.occupancy?.reserved || 0),
      ...data.occupancy,
    };

    const buildingHealth = data.buildingHealth || [];
    const revenueHistory = (data.revenueHistory || []).some((item: any) => Number(item.revenue || 0) > 0)
      ? data.revenueHistory
      : (kpis.totalRevenue > 0 ? buildRecentMonths(kpis.totalRevenue) : data.revenueHistory || []);

    const recentActivity = data.recentActivity || [];

    return {
      ...data,
      hero: {
        tasksCount: data.hero?.tasksCount || 0,
        debt: formatVnd(kpis.totalDebt),
        expiringContracts: data.hero?.expiringContracts || 0,
        cleaningRooms: data.hero?.cleaningRooms || 0,
        maintenanceRooms: data.hero?.maintenanceRooms || 0,
      },
      alerts: data.alerts || [],
      kpis: [
        { label: "Doanh thu tháng này", value: formatVnd(kpis.totalRevenue), trend: "", positive: true, icon: "green" },
        { label: "Lợi nhuận ròng", value: formatVnd(kpis.netProfit), trend: "", positive: kpis.netProfit >= 0, icon: "blue" },
        { label: "Tỷ lệ lấp đầy", value: `${occupancy.rate}%`, trend: "", positive: true, icon: "purple" },
        { label: "Dòng tiền ròng", value: formatVnd(kpis.netCashFlow), trend: "", positive: kpis.netCashFlow >= 0, icon: "orange" },
      ],
      kpisRaw: kpis,
      revenueHistory,
      buildingHealth,
      buildings: buildingHealth,
      tasks: data.tasks || [],
      recentActivity,
      cashFlowForecast: data.cashFlowForecast || [],
      insights: data.insights || [],
      occupancy,
    };
  },
};
