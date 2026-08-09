"use client";

import React from "react";
import { Building2, HandCoins, ReceiptText, TrendingUp } from "lucide-react";
import { useOwnerProfitSummaryQuery } from "@/lib/queries/finance.queries";

const formatMoney = (value: number) => {
  if (Math.abs(value) >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  return value.toLocaleString("vi-VN");
};

export default function OwnerProfitSummary() {
  const { data, isLoading } = useOwnerProfitSummaryQuery();
  const rows = Array.isArray(data) ? data : [];

  return (
    <section className="bg-card border border-border rounded-[16px] overflow-hidden shadow-sm">
      <div className="p-[16px] md:p-[20px] border-b border-border flex items-start justify-between gap-4">
        <div>
          <h2 className="font-black text-[16px] md:text-[18px] text-text">Chia lợi nhuận theo chủ</h2>
          <p className="text-[12px] md:text-[13px] text-muted mt-1">
            Tổng hợp doanh thu, chi phí, tiền ứng hộ và khoản cần khấu trừ cho từng chủ sở hữu.
          </p>
        </div>
        <div className="hidden md:flex h-10 w-10 items-center justify-center rounded-xl bg-[#8b5cf6]/10 text-[#8b5cf6]">
          <HandCoins size={18} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-0">
        {isLoading && (
          <div className="p-[20px] text-[13px] font-semibold text-muted">Đang tải báo cáo...</div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="p-[20px] text-[13px] font-semibold text-muted">
            Chưa có dữ liệu chủ sở hữu. Hãy gắn chủ sở hữu cho tòa nhà để bắt đầu theo dõi.
          </div>
        )}

        {rows.map((row: any) => (
          <article key={row.owner.id} className="p-[16px] md:p-[20px] border-b xl:odd:border-r border-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-[15px] md:text-[16px] text-text">{row.owner.name}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-black text-muted">
                    {row.owner.code}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  <Building2 size={13} />
                  {(row.buildings || []).map((building: any) => building.code).join(", ") || "Chưa gắn tòa"}
                </div>
              </div>
              <div className="rounded-xl bg-[#10b981]/10 px-3 py-2 text-right">
                <div className="text-[10px] font-black uppercase text-[#059669]">Còn lại</div>
                <div className="text-[16px] font-black text-[#059669]">{formatMoney(Number(row.profitAfterAdvance || 0))}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Tổng thu" value={row.revenue} tone="income" />
              <Metric label="Tổng chi" value={row.expense} tone="expense" />
              <Metric label="Cần thu hoàn ứng" value={row.advanceReceivable} tone="income" />
              <Metric label="Cần khấu trừ" value={row.advancePayable} tone="expense" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" }) {
  const isIncome = tone === "income";
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-muted">
        {isIncome ? <TrendingUp size={12} /> : <ReceiptText size={12} />}
        {label}
      </div>
      <div className={`mt-2 text-[15px] font-black ${isIncome ? "text-[#059669]" : "text-rose-500"}`}>
        {formatMoney(Number(value || 0))}
      </div>
    </div>
  );
}
