"use client";

import React, { useState } from "react";
import OperationsBillingRow from "./OperationsBillingRow";
import OperationsBillingDrawer from "./OperationsBillingDrawer";

import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { useInvoicesStore } from "@/lib/hooks/useInvoicesStore";
import { Loader2 } from "lucide-react";

export default function OperationsBillingList() {
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const { search, status } = useInvoicesStore();

  const { data, isLoading, isError } = useInvoicesQuery({
    search: search || undefined,
    status: status !== 'Tất cả' && status ? status : undefined,
  });

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center p-10">
        <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="invoices-error-state" className="flex w-full items-center justify-center p-10 text-rose-500 font-medium">
        Có lỗi xảy ra khi tải danh sách hóa đơn.
      </div>
    );
  }

  const invoices: any[] = (data as any)?.data || [];

  return (
    <div data-testid="invoices-list" className="flex flex-col gap-[16px] pb-[40px]">
      <div className="flex items-center justify-between px-[8px]">
        <h3 className="font-black text-[18px] text-text">Danh sách Hóa đơn</h3>
        <span className="text-[13px] font-bold text-muted bg-black/5 dark:bg-white/5 px-[12px] py-[4px] rounded-[8px]">Hiển thị {invoices.length} / {(data as any)?.meta?.total || invoices.length}</span>
      </div>

      <div className="flex flex-col gap-[12px]">
        {invoices.length === 0 ? (
          <div data-testid="empty-invoices-state" className="text-center py-10 text-muted font-medium">
            Không tìm thấy hóa đơn nào.
          </div>
        ) : (
          invoices.map((invoice: any) => (
            <OperationsBillingRow 
              key={invoice.id} 
              invoice={invoice} 
              onClick={() => setSelectedInvoice(invoice)} 
            />
          ))
        )}
      </div>

      <OperationsBillingDrawer 
        invoice={selectedInvoice} 
        onClose={() => setSelectedInvoice(null)} 
      />
    </div>
  );
}
