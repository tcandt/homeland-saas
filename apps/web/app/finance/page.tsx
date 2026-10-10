"use client";

import React, { useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OwnerEqualProfitSettlement from "@/components/finance/OwnerEqualProfitSettlement";
import FinanceExportDrawer from "@/components/finance/FinanceExportDrawer";
import { getVietnamMonthRange, getVietnamMonthRangeBounds, type ReportMonthRange } from "@/lib/utils/report-period";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  useBuildingProfitSummaryQuery,
  useExpensesQuery,
} from "@/lib/queries/finance.queries";

export default function FinancePage() {
  const permissions = usePermissions();

  const [monthRange, setMonthRange] = useState<ReportMonthRange>(() => getVietnamMonthRange());

  // Compute precise date bounds for the selected month range
  const queryParams = useMemo(() => {
    const bounds = getVietnamMonthRangeBounds(monthRange);
    const startDate = bounds.startDate;
    // Finance's legacy endDate is inclusive; reports use the exclusive bound.
    const endDate = new Date(new Date(bounds.endDate).getTime() - 1).toISOString();

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
    isError: isBuildingsError,
  } = useBuildingProfitSummaryQuery(queryParams);

  // Fetch live expenses and cluster incidentals
  const {
    data: expensesData,
    isLoading: isLoadingExpenses,
    refetch: refetchExpenses,
    isError: isExpensesError,
  } = useExpensesQuery({
    startDate: queryParams.startDate,
    endDate: queryParams.endDate,
  });

  return (
    <AppShell>
      {permissions.canExportFinance && <FinanceExportDrawer period={queryParams} periodLabel={`${String(monthRange.startMonth).padStart(2, "0")}/${monthRange.startYear} – ${String(monthRange.endMonth).padStart(2, "0")}/${monthRange.endYear}`} />}

      <main
        data-testid="finance-root"
        className="-m-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background p-3.5 md:min-h-[calc(100dvh-80px)] md:p-5"
      >
        <div className="flex w-full flex-col gap-4">
          {/* CORE SECTION: BẢNG DOANH THU, CHI PHÍ, PHÁT SINH VÀ QUYẾT TOÁN LỢI NHUẬN CHIA ĐÔI */}
          {isBuildingsError || isExpensesError ? (
            <div role="alert" className="rounded-xl border border-danger/30 bg-card p-4">
              <p>Không tải được số liệu kỳ báo cáo. Không thể kết luận doanh thu bằng 0.</p>
              <button type="button" onClick={() => { void Promise.all([refetchBuildings(), refetchExpenses()]); }} className="mt-2 text-primary">Thử lại</button>
            </div>
          ) : <OwnerEqualProfitSettlement
            buildingsData={Array.isArray(buildingsData) ? buildingsData : []}
            expenses={Array.isArray(expensesData) ? expensesData : []}
            isLoading={isLoadingBuildings || isLoadingExpenses}
            monthRange={monthRange}
            onMonthRangeChange={setMonthRange}
          />}
        </div>
      </main>
    </AppShell>
  );
}
