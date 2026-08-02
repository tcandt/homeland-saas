"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Calendar, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";

type UrgentAction = {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  time: string;
  timeColor: string;
};

function isUrgentAction(action: UrgentAction | false | null | undefined): action is UrgentAction {
  return Boolean(action);
}

export default function MobileActionList() {
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoicesQuery({ limit: 50, overdue: true });
  const { data: contractsData, isLoading: contractsLoading } = useContractsQuery({ limit: 50, status: "EXPIRING" });

  const actions = useMemo<UrgentAction[]>(() => {
    const invoiceItems = (invoicesData as any)?.data?.items || (invoicesData as any)?.data || [];
    const contractItems = (contractsData as any)?.data?.items || (contractsData as any)?.data || [];

    const overdueInvoice = invoiceItems.find((invoice: any) => invoice.status === "OVERDUE" || invoice.status === "PARTIALLY_PAID");
    const expiringContract = contractItems.find((contract: any) => {
      if (!contract.endDate) return false;
      const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 30;
    });

    return [
      overdueInvoice && {
        icon: <AlertTriangle size={14} className="text-[#ef4444]" />,
        iconColor: "bg-[#ef4444]/10",
        title: `Hóa đơn ${overdueInvoice.code || overdueInvoice.id.slice(0, 8)} đã quá hạn`,
        time: overdueInvoice.dueDate ? `Hạn ${new Date(overdueInvoice.dueDate).toLocaleDateString("vi-VN")}` : "Quá hạn",
        timeColor: "text-[#ef4444]",
      },
      expiringContract && {
        icon: <Calendar size={14} className="text-[#f97316]" />,
        iconColor: "bg-[#f97316]/10",
        title: `Hợp đồng ${expiringContract.code || expiringContract.id.slice(0, 8)} sắp hết hạn`,
        time: expiringContract.endDate ? `${Math.max(0, Math.ceil((new Date(expiringContract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} ngày nữa` : "Sắp hết hạn",
        timeColor: "text-[#f97316]",
      },
    ].filter(isUrgentAction);
  }, [contractsData, invoicesData]);

  const isLoading = invoicesLoading || contractsLoading;

  return (
    <div className="bg-card border border-border rounded-[16px] p-[16px] shadow-sm flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-[13px] text-text m-0">Việc cần xử lý ngay</h3>
        <a href="#" className="text-[#4f46e5] text-[11px] font-bold hover:underline flex items-center gap-1">
          Xem tất cả <ChevronRight size={12} />
        </a>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang tải dữ liệu thật...
        </div>
      ) : actions.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-muted text-[12px] font-medium">
          Chưa có việc cần xử lý.
        </div>
      ) : (
        <div className="flex flex-col gap-[12px]">
          {actions.map((action, index) => (
            <React.Fragment key={`${action.title}-${index}`}>
              <ActionRow {...action} />
              {index < actions.length - 1 && <div className="h-px bg-border/50 w-full" />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({ icon, iconColor, title, time, timeColor }: UrgentAction) {
  return (
    <div className="flex items-center justify-between cursor-pointer group">
      <div className="flex items-center gap-[10px] min-w-0">
        <div className={`w-[28px] h-[28px] rounded-[8px] flex items-center justify-center shrink-0 ${iconColor}`}>{icon}</div>
        <div className="font-bold text-[12px] text-text truncate">{title}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={`text-[10px] font-bold ${timeColor}`}>{time}</span>
        <ChevronRight size={14} className="text-muted" />
      </div>
    </div>
  );
}
