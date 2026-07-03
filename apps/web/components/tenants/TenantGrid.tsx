"use client";

import React, { useState } from "react";
import TenantCard from "./TenantCard";
import TenantDetailDrawer from "./TenantDetailDrawer";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { useTenantsStore } from "@/lib/hooks/useTenantsStore";
import { LoadingState } from "../ui/LoadingState";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";

export default function TenantGrid() {
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const { search, status } = useTenantsStore();

  const { data, isLoading, isError } = useCustomersQuery({
    search: search || undefined,
    status: status !== 'Tất cả' && status ? status : undefined,
  });

  if (isLoading) {
    return <LoadingState message="Đang tải danh sách khách hàng..." />;
  }

  if (isError) {
    return (
      <div data-testid="tenants-error-state">
        <ErrorState message="Có lỗi xảy ra khi tải danh sách khách hàng." onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const tenants: any[] = (data as any)?.data || [];

  if (tenants.length === 0) {
    return (
      <div data-testid="empty-tenants-state">
        <EmptyState title="Không có dữ liệu" message="Không tìm thấy khách hàng nào phù hợp với bộ lọc." />
      </div>
    );
  }

  return (
    <>
      <div data-testid="tenants-list" className="grid gap-4 mt-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tenants.map((tenant: any) => (
          <TenantCard key={tenant.id} tenant={tenant} onClick={() => setSelectedTenant(tenant)} />
        ))}
      </div>

      <TenantDetailDrawer tenant={selectedTenant} onClose={() => setSelectedTenant(null)} />
    </>
  );
}
