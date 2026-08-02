"use client";

import React, { useMemo } from "react";
import { AlertCircle, Clock, Wallet, TrendingUp, PiggyBank, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";

export default function MoneyOverview() {
  const { data: roomsData, isLoading } = useRoomsQuery({ limit: 100 });

  const stats = useMemo(() => {
    const rooms = (roomsData as any)?.data?.items || (roomsData as any)?.data || [];
    let totalDebt = 0;
    let overdueInvoices = 0;
    let overdueAmount = 0;
    let unpaidRent = 0;
    let deposits = 0;
    let monthlyRevenue = 0;

    rooms.forEach((room: any) => {
      if (room.rentalType === "whole") {
        if (room.debt) totalDebt += Number(room.debt) || 0;
        if (room.contract?.deposit) deposits += Number(room.contract.deposit) || 0;
        room.invoices?.forEach((inv: any) => {
          if (inv.status !== "paid") {
            unpaidRent += Number(inv.amount) || 0;
            if ((Number(inv.amount) || 0) > 5000000) {
              overdueInvoices += 1;
              overdueAmount += Number(inv.amount) || 0;
            }
          }
          if (inv.type === "rent" && inv.status === "paid") {
            monthlyRevenue += Number(inv.amount) || 0;
          }
        });
      } else {
        room.sharedTenants?.forEach((st: any) => {
          if (st.debt) totalDebt += Number(st.debt) || 0;
          if (st.deposit) deposits += Number(st.deposit) || 0;
          st.invoices?.forEach((inv: any) => {
            if (inv.status !== "paid") {
              unpaidRent += Number(inv.amount) || 0;
              if ((Number(inv.amount) || 0) > 2000000) {
                overdueInvoices += 1;
                overdueAmount += Number(inv.amount) || 0;
              }
            }
            if (inv.type === "rent" && inv.status === "paid") {
              monthlyRevenue += Number(inv.amount) || 0;
            }
          });
        });
      }
    });

    return { totalDebt, overdueInvoices, overdueAmount, unpaidRent, deposits, monthlyRevenue };
  }, [roomsData]);

  const formatMoney = (amount: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="col-span-full flex items-center justify-center py-6 text-muted">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang tải tài chính thật...
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="flex flex-col gap-3 relative group">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-8 h-8 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
            <AlertCircle size={16} />
          </div>
          <span className="font-bold text-xs uppercase">Tổng công nợ</span>
        </div>
        <div>
          <div className="text-2xl font-black text-danger tracking-tight">{formatMoney(stats.totalDebt)}</div>
          <p className="text-xs font-medium text-muted mt-1">Khách nợ chưa thu</p>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 relative group">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-8 h-8 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
            <Clock size={16} />
          </div>
          <span className="font-bold text-xs uppercase">Hóa đơn quá hạn</span>
        </div>
        <div>
          <div className="text-2xl font-black text-warning tracking-tight">{stats.overdueInvoices} phiếu</div>
          <p className="text-xs font-medium text-muted mt-1">Tổng: {formatMoney(stats.overdueAmount)}</p>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 relative group">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Wallet size={16} />
          </div>
          <span className="font-bold text-xs uppercase">Tiền thuê chờ thu</span>
        </div>
        <div>
          <div className="text-2xl font-black text-text tracking-tight">{formatMoney(stats.unpaidRent)}</div>
          <p className="text-xs font-medium text-muted mt-1">Trong kỳ này</p>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 relative group">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <PiggyBank size={16} />
          </div>
          <span className="font-bold text-xs uppercase">Tiền cọc giữ</span>
        </div>
        <div>
          <div className="text-2xl font-black text-text tracking-tight">{formatMoney(stats.deposits)}</div>
          <p className="text-xs font-medium text-muted mt-1">Sẽ hoàn trả khi thanh lý</p>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 relative group">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-8 h-8 rounded-xl bg-success/10 text-success flex items-center justify-center">
            <TrendingUp size={16} />
          </div>
          <span className="font-bold text-xs uppercase">Doanh thu tháng</span>
        </div>
        <div>
          <div className="text-2xl font-black text-success tracking-tight">{formatMoney(stats.monthlyRevenue)}</div>
          <p className="text-xs font-medium text-muted mt-1">Thực thu tháng này</p>
        </div>
      </Card>
    </div>
  );
}
