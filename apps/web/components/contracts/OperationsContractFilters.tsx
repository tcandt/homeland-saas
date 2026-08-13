"use client";

import React from "react";
import { Filter, X } from "lucide-react";
import { useContractsStore } from "@/lib/hooks/useContractsStore";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SearchInput } from "../ui/SearchInput";

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "DRAFT", label: "Bản nháp" },
  { value: "PENDING_APPROVAL", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "ACTIVE", label: "Đang hiệu lực" },
  { value: "EXPIRING", label: "Sắp hết hạn" },
  { value: "EXPIRED", label: "Đã hết hạn" },
  { value: "TERMINATED", label: "Đã chấm dứt" },
  { value: "CANCELLED", label: "Đã hủy" },
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
      className="flex flex-col gap-3 rounded-[16px] border-border/40 p-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 lg:max-w-[520px]">
            <SearchInput
              value={search}
              placeholder="Tìm theo mã HĐ, tên khách, số phòng, tòa nhà..."
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 rounded-xl border-[#dbe3ef] bg-card text-[13px] font-semibold"
            />
          </div>

          <div className="relative min-w-[210px] shrink-0">
            <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              aria-label="Lọc trạng thái hợp đồng"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-slate-200/80 bg-card pl-9 pr-8 text-[13px] font-bold text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10"
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} className="h-10 shrink-0 px-3 text-muted hover:text-text">
              <X size={14} className="mr-1.5" /> Xóa lọc
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
