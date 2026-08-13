"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useTenantsStore } from "@/lib/hooks/useTenantsStore";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SearchInput } from "../ui/SearchInput";
import TenantFormModal from "./TenantFormModal";

export default function TenantFilters() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { search, setSearch } = useTenantsStore();

  return (
    <>
      <Card data-testid="tenants-filter-bar" className="rounded-[16px] border-border/40 p-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1 lg:max-w-[520px]">
              <SearchInput
                value={search}
                placeholder="Tìm kiếm theo tên, SĐT, email, CCCD..."
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 rounded-xl border-[#dbe3ef] bg-card text-[13px] font-semibold"
              />
            </div>

          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setIsFormOpen(true)} variant="primary" data-testid="add-tenant-button" className="h-10 shrink-0 bg-[#6d3df8] px-4 text-white hover:bg-[#5b35f5]">
              <Plus size={15} className="mr-2" />
              Thêm khách thuê
            </Button>
          </div>
        </div>
      </Card>

      <TenantFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </>
  );
}
