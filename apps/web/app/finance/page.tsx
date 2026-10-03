"use client";

import React, { useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OwnerEqualProfitSettlement from "@/components/finance/OwnerEqualProfitSettlement";
import FinanceExportDrawer from "@/components/finance/FinanceExportDrawer";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  useBuildingProfitSummaryQuery,
  useExpensesQuery,
} from "@/lib/queries/finance.queries";

type MonthRange = {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
};

export default function FinancePage() {
  const permissions = usePermissions();

  // Default to Q3/2026 (Tháng 7 tới Tháng 9 năm 2026) as requested
  const [monthRange, setMonthRange] = useState<MonthRange>({
    startMonth: 7,
    startYear: 2026,
    endMonth: 9,
    endYear: 2026,
  });

  // Compute precise date bounds for the selected month range
  const queryParams = useMemo(() => {
    // Start of the first month at 00:00:00 UTC
    const startDate = new Date(
      Date.UTC(monthRange.startYear, monthRange.startMonth - 1, 1, 0, 0, 0, 0)
    ).toISOString();

    // End of the last month at 23:59:59.999 UTC
    const endDate = new Date(
      Date.UTC(monthRange.endYear, monthRange.endMonth, 0, 23, 59, 59, 999)
    ).toISOString();

    return {
      startDate,
      endDate,
      startMonth: String(monthRange.startMonth),
      endMonth: String(monthRange.endMonth),
      startYear: String(monthRange.startYear),
      endYear: String(monthRange.endYear),
      year: String(monthRange.startYear),
    };
  }, [monthRange]);

  // Fetch live revenue and building direct profit metrics
  const {
    data: buildingsData,
    isLoading: isLoadingBuildings,
    refetch: refetchBuildings,
  } = useBuildingProfitSummaryQuery(queryParams);

  // Fetch live expenses and cluster incidentals
  const {
    data: expensesData,
    isLoading: isLoadingExpenses,
    refetch: refetchExpenses,
  } = useExpensesQuery({
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
  });

  return (
    <AppShell>
      {permissions.canExportFinance && <FinanceExportDrawer />}

      <main
        data-testid="finance-root"
        className="-m-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background p-3.5 md:min-h-[calc(100dvh-80px)] md:p-5"
      >
        <div className="flex w-full flex-col gap-4">
          {/* CORE SECTION: BẢNG DOANH THU, CHI PHÍ, PHÁT SINH VÀ QUYẾT TOÁN LỢI NHUẬN CHIA ĐÔI */}
          <OwnerEqualProfitSettlement
            buildingsData={Array.isArray(buildingsData) ? buildingsData : []}
            expenses={Array.isArray(expensesData) ? expensesData : []}
            isLoading={isLoadingBuildings || isLoadingExpenses}
            monthRange={monthRange}
            onMonthRangeChange={setMonthRange}
          />
        </div>
      </main>
    </AppShell>
  );
}
