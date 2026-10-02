"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function FinanceAttentionCard() {
  const alerts = [
    {
      id: "a1",
      icon: AlertTriangle,
      iconColor: "text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-500/10",
      title: "Tòa LK08.25",
      detail: "Chưa có phòng đang thuê",
      detailTone: "text-rose-600 dark:text-rose-400 font-semibold",
      link: "/buildings/LK08.25",
    },
    {
      id: "a2",
      icon: Clock,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10",
      title: "Công nợ phải thu cao",
      detail: "8.749.271 đ chưa thu",
      detailTone: "text-amber-600 dark:text-amber-400 font-bold font-mono",
      link: "/invoices",
    },
    {
      id: "a3",
      icon: ShieldCheck,
      iconColor: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-500/10",
      title: "Tiền cọc lớn",
      detail: "8.000.000 đ đang giữ",
      detailTone: "text-purple-600 dark:text-purple-400 font-bold font-mono",
      link: "/deposits",
    },
    {
      id: "a4",
      icon: Info,
      iconColor: "text-sky-600 dark:text-sky-400",
      iconBg: "bg-sky-500/10",
      title: "Chi phí tăng 12%",
      detail: "So với kỳ trước",
      detailTone: "text-muted font-medium",
      link: "/finance/expenses",
    },
  ];

  return (
    <Card
      data-testid="finance-attention-card"
      className="flex h-[320px] flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs"
    >
      {/* Slim Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle size={13} />
          </span>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text">
              Cảnh báo tài chính hôm nay
            </h2>
            <p className="text-[11px] text-muted">3 cảnh báo cần chú ý</p>
          </div>
        </div>

        <Link
          href="/reports"
          className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
        >
          <span>Xem tất cả</span>
          <ArrowRight size={11} />
        </Link>
      </div>

      {/* 4 Compact Alert Rows */}
      <div className="flex-1 flex flex-col justify-between py-2">
        {alerts.map((item) => (
          <Link
            key={item.id}
            href={item.link}
            className="group flex items-center justify-between gap-2.5 rounded-lg border border-border/50 bg-surface/30 px-3 py-2 transition hover:border-border hover:bg-surface/70"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${item.iconBg} ${item.iconColor}`}
              >
                <item.icon size={13} />
              </span>
              <div className="truncate">
                <span className="text-xs font-bold text-text block truncate group-hover:text-primary transition-colors">
                  {item.title}
                </span>
                <span className={`text-[11px] block truncate ${item.detailTone}`}>
                  {item.detail}
                </span>
              </div>
            </div>

            <ChevronRight
              size={13}
              className="text-muted shrink-0 group-hover:text-text group-hover:translate-x-0.5 transition-all"
            />
          </Link>
        ))}
      </div>
    </Card>
  );
}
