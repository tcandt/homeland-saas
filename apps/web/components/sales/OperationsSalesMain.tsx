"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import OperationsSalesLeadCard from "./OperationsSalesLeadCard";
import { getSalesStageLabel, normalizeSalesStage, type SalesLeadRecord } from "./sales.types";
import { useSalesLeadsQuery } from "@/lib/queries/sales.queries";
import { LoadingState } from "../ui/LoadingState";

export default function OperationsSalesMain() {
  const searchParams = useSearchParams();
  const activeStageId = searchParams.get("stage");
  const { data, isLoading, isError } = useSalesLeadsQuery();

  const leads: SalesLeadRecord[] = React.useMemo(() => {
    const payload = (data as any)?.data?.data ?? (data as any)?.data ?? [];
    return Array.isArray(payload) ? payload : [];
  }, [data]);

  const stageIdToStatusMap: Record<string, string> = {
    lead: "NEW",
    contacted: "CONTACTED",
    consulting: "QUALIFIED",
    viewing: "PROPOSAL",
    negotiating: "PROPOSAL",
    deposit: "WON",
    won: "WON",
    lost: "LOST",
  };

  const filteredLeads = activeStageId && stageIdToStatusMap[activeStageId]
    ? leads.filter((lead) => normalizeSalesStage(lead.status) === stageIdToStatusMap[activeStageId])
    : leads;

  if (isLoading) {
    return <LoadingState message="Đang tải dữ liệu sales..." />;
  }

  if (isError) {
    return (
      <div className="rounded-[16px] border border-border bg-card p-6 text-sm font-medium text-muted">
        Không thể tải dữ liệu Sales CRM.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[12px]">
          <h2 className="font-black text-[18px] text-text">
            {activeStageId && stageIdToStatusMap[activeStageId] ? `Leads: ${getSalesStageLabel(stageIdToStatusMap[activeStageId])}` : "Tất cả Leads"}
          </h2>
          <span className="bg-border text-muted font-bold text-[12px] px-2 py-0.5 rounded-full">{filteredLeads.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-[16px]">
        {filteredLeads.map((lead) => (
          <OperationsSalesLeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}
