"use client";

import React from "react";
import { Plus, X, FileText, CheckCircle2, Clock3, AlertTriangle, FileX } from "lucide-react";
import { useContractsStore } from "@/lib/hooks/useContractsStore";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SearchInput } from "../ui/SearchInput";

const quickStatusTabs = [
  { id: "", label: "Tất cả", icon: FileText },
  { id: "ACTIVE", label: "Đang hiệu lực", icon: CheckCircle2, activeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  { id: "EXPIRING", label: "Sắp hết hạn", icon: Clock3, activeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { id: "PENDING_APPROVAL", label: "Chờ ký / duyệt", icon: FileText, activeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
  { id: "TERMINATED", label: "Đã kết thúc", icon: FileX, activeClass: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
];

export default function OperationsContractFilters() {
  const { search, setSearch, status, setStatus } = useContractsStore();
  const hasFilters = Boolean(search || status);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
  };

  return (
    <Card
      data-testid="contracts-filter-bar"
      className="flex flex-col gap-2.5 rounded-2xl border-border/60 p-3 shadow-xs"
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        {/* Search input */}
        <div className="min-w-0 flex-1 lg:max-w-[480px]">
          <SearchInput
            value={search}
            placeholder="Tìm theo mã HĐ, tên khách, số phòng, tòa nhà..."
            onChange={(event) => setSearch(event.target.value)}
            className="h-9.5 rounded-xl border-border bg-card text-[13px] font-semibold"
          />
        </div>

        {/* Quick Filter Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {quickStatusTabs.map((tab) => {
            const isSelected = status === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatus(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                  isSelected
                    ? tab.activeClass || "bg-primary/10 text-primary border-primary/30 shadow-2xs"
                    : "border-border bg-card text-muted hover:border-border/80 hover:text-text"
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 px-2.5 text-xs text-muted hover:text-text rounded-xl"
            >
              <X size={13} className="mr-1" /> Xóa lọc
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
