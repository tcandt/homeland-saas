"use client";

import React, { useMemo } from "react";
import { masterBuildings } from "../buildings/mockData";
import { DollarSign, AlertCircle, Clock, Wallet, TrendingUp, PiggyBank } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function MoneyOverview() {
  const stats = useMemo(() => {
    let totalDebt = 0;
    let overdueInvoices = 0;
    let overdueAmount = 0;
    let unpaidRent = 0;
    let deposits = 0;
    let monthlyRevenue = 0;

    masterBuildings.forEach(b => {
      b.floors.forEach(f => {
        f.rooms.forEach(r => {
          // Whole room
          if (r.rentalType === "whole") {
            if (r.debt) totalDebt += r.debt;
            if (r.contract?.deposit) deposits += r.contract.deposit;
            r.invoices?.forEach(inv => {
              if (inv.status !== "paid") {
                unpaidRent += inv.amount;
                // mock overdue logic: if amount > 5M we mock it as overdue for now
                if (inv.amount > 5000000) {
                  overdueInvoices += 1;
                  overdueAmount += inv.amount;
                }
              }
              if (inv.type === "rent" && inv.status === "paid") {
                monthlyRevenue += inv.amount; // Simplify revenue
              }
            });
          } else {
            // Shared room
            r.sharedTenants?.forEach(st => {
              if (st.debt) totalDebt += st.debt;
              if (st.deposit) deposits += st.deposit;
              st.invoices?.forEach(inv => {
                if (inv.status !== "paid") {
                  unpaidRent += inv.amount;
                  if (inv.amount > 2000000) {
                    overdueInvoices += 1;
                    overdueAmount += inv.amount;
                  }
                }
                if (inv.type === "rent" && inv.status === "paid") {
                  monthlyRevenue += inv.amount;
                }
              });
            });
          }
        });
      });
    });

    return { totalDebt, overdueInvoices, overdueAmount, unpaidRent, deposits, monthlyRevenue };
  }, []);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Outstanding Debt */}
      <Card className="flex flex-col gap-3 relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-danger/5 rounded-full blur-[40px] -z-10 group-hover:bg-danger/10 transition-colors" />
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

      {/* 2. Overdue Invoices */}
      <Card className="flex flex-col gap-3 relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 rounded-full blur-[40px] -z-10 group-hover:bg-warning/10 transition-colors" />
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

      {/* 3. Unpaid Rent */}
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

      {/* 4. Deposits Held */}
      <Card className="flex flex-col gap-3 relative group">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <PiggyBank size={16} />
          </div>
          <span className="font-bold text-xs uppercase">Tiền cọc giữ</span>
        </div>
        <div>
          <div className="text-2xl font-black text-text tracking-tight">{formatMoney(stats.deposits)}</div>
          <p className="text-xs font-medium text-muted mt-1">Sẽ hoàn trả khi thanh lý</p>
        </div>
      </Card>

      {/* 5. Monthly Revenue */}
      <Card className="flex flex-col gap-3 relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full blur-[40px] -z-10 group-hover:bg-success/10 transition-colors" />
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
