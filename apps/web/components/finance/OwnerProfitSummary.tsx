"use client";

import React, { useState } from "react";
import {
  Building2,
  Users,
  Wallet,
} from "lucide-react";
import { formatVnd } from "@/lib/utils/format";
import OwnerFinancialDetailModal from "./OwnerFinancialDetailModal";

interface OwnerProfitSummaryProps {
  onSelectOwner?: (ownerId: string, ownerName: string, ownerCode: string) => void;
}

export default function OwnerProfitSummary({ onSelectOwner }: OwnerProfitSummaryProps) {
  const [modalOwner, setModalOwner] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);

  const owners = [
    {
      id: "owner-tinh",
      name: "Nguyễn Đức Tính",
      code: "OWNER-A",
      avatarBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
      buildings: "LK01.31, LK08.25",
      totalRev: 5132020,
      bankReceived: 1000000,
      deposit: 8000000,
      totalExpense: 765353,
      advancePayable: 100000,
      actualReceived: 5132020,
    },
    {
      id: "owner-the",
      name: "Phan Văn Thế",
      code: "OWNER-B",
      avatarBg: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
      buildings: "LK01.32, LK08.24",
      totalRev: 13649272,
      bankReceived: 0,
      deposit: 7000000,
      totalExpense: 549271,
      advancePayable: 200000,
      actualReceived: 13649272,
    },
  ];

  const handleCardClick = (owner: typeof owners[0]) => {
    if (onSelectOwner) {
      onSelectOwner(owner.id, owner.name, owner.code);
    } else {
      setModalOwner({ id: owner.id, name: owner.name, code: owner.code });
    }
  };

  return (
    <>
      <section
        data-testid="owner-profit-summary"
        className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs"
      >
        {/* Slim Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Users size={13} />
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-text">
                Tổng quan theo chủ sở hữu
              </h2>
              <p className="text-[11px] text-muted">
                Phân bổ doanh thu, chi phí và lợi nhuận cho từng chủ sở hữu
              </p>
            </div>
          </div>

          <span className="rounded-md bg-surface/60 px-2 py-0.5 text-[11px] font-semibold text-muted border border-border/50">
            {owners.length} chủ sở hữu
          </span>
        </div>

        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {owners.map((owner) => (
            <div
              key={owner.id}
              onClick={() => handleCardClick(owner)}
              className="group flex cursor-pointer flex-col justify-between gap-3 rounded-lg border border-border/60 bg-surface/30 p-3.5 transition hover:border-border hover:bg-surface/70"
            >
              {/* Top Row: Owner Info + Real Profit Pill */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-bold text-xs ${owner.avatarBg}`}
                  >
                    {owner.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-text group-hover:text-primary transition-colors">
                        {owner.name}
                      </span>
                      <span className="rounded px-1.5 py-0.2 font-mono text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20">
                        {owner.code}
                      </span>
                    </div>

                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted font-medium">
                      <Building2 size={11} className="text-muted shrink-0" />
                      <span>Tòa nhà: {owner.buildings}</span>
                    </div>
                  </div>
                </div>

                {/* Hero Pill: Còn lại thực nhận */}
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-600 text-white">
                    <Wallet size={11} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                      Còn lại thực nhận
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300 block leading-tight">
                      {formatVnd(owner.actualReceived)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: 5 Metric Breakdown Columns */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 border-t border-border/30 pt-2.5 text-xs">
                <div>
                  <span className="text-[9px] font-semibold text-muted block">Tổng thu</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5 text-[11px]">
                    {formatVnd(owner.totalRev)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-semibold text-muted block">Bank đã nhận</span>
                  <span className="font-mono font-bold text-text block mt-0.5 text-[11px]">
                    {formatVnd(owner.bankReceived)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-semibold text-muted block">Tiền cọc</span>
                  <span className="font-mono font-bold text-amber-600 block mt-0.5 text-[11px]">
                    {formatVnd(owner.deposit)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-semibold text-muted block">Tổng chi</span>
                  <span className="font-mono font-bold text-rose-500 block mt-0.5 text-[11px]">
                    {formatVnd(owner.totalExpense)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-semibold text-muted block">Khấu trừ/chi hộ</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block mt-0.5 text-[11px]">
                    {formatVnd(owner.advancePayable)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Detail Modal */}
      {modalOwner && (
        <OwnerFinancialDetailModal
          isOpen={true}
          onClose={() => setModalOwner(null)}
          ownerId={modalOwner.id}
          initialOwnerName={modalOwner.name}
          initialOwnerCode={modalOwner.code}
        />
      )}
    </>
  );
}
