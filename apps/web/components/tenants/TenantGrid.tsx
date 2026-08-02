"use client";

import React, { useMemo, useState } from "react";
import { CalendarClock, ShieldCheck, Shield, ShieldAlert } from "lucide-react";
import { Table, Column } from "../ui/Table";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import TenantDetailDrawer from "./TenantDetailDrawer";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useTenantsStore } from "@/lib/hooks/useTenantsStore";
import { LoadingState } from "../ui/LoadingState";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";

type RiskLevel = "low" | "medium" | "high";

type TenantRow = {
  id: string;
  fullName: string;
  avatar: string;
  roomLabel: string;
  buildingName: string;
  phone: string;
  email: string;
  contractDays: number;
  debt: number;
  risk: RiskLevel;
  status: string;
  tempResidence: string;
  createdAt: string;
  code: string;
};

function getRiskLevel(debt: number): RiskLevel {
  if (debt > 5000000) return "high";
  if (debt > 0) return "medium";
  return "low";
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0)}đ`;
}

export default function TenantGrid() {
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const { search, status } = useTenantsStore();
  const { data: customersData, isLoading: customersLoading, isError: customersError } = useCustomersQuery({
    search: search || undefined,
    status: status !== "Tất cả" && status ? status : undefined,
    limit: 100,
  });
  const { data: contractsData, isLoading: contractsLoading } = useContractsQuery({ limit: 100 });

  const customers: any[] = (customersData as any)?.data || [];
  const contracts: any[] = (contractsData as any)?.data || [];

  const rows: TenantRow[] = useMemo(() => {
    return customers.map((customer: any) => {
      const relatedContract = contracts.find(
        (contract: any) => contract.customerId === customer.id || contract.customer?.id === customer.id
      );

      const debt = Number(customer.kpis?.totalDebt || relatedContract?.debt || 0);
      const endDate = relatedContract?.endDate;
      const contractDays = endDate
        ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        id: customer.id,
        fullName: customer.fullName || customer.name || "Khách thuê",
        avatar: customer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.fullName || customer.name || "Khách")}`,
        roomLabel: customer.rooms?.[0]?.name || relatedContract?.room?.number || relatedContract?.room?.code || "N/A",
        buildingName: customer.rooms?.[0]?.building?.name || relatedContract?.room?.building?.name || "Chưa có tòa",
        phone: customer.phone || "N/A",
        email: customer.email || "N/A",
        contractDays,
        debt,
        risk: getRiskLevel(debt),
        status: customer.status || relatedContract?.status || "ACTIVE",
        tempResidence: customer.tempResidence || customer.residenceStatus || "Chưa khai báo",
        createdAt: customer.createdAt || "",
        code: customer.code || customer.id?.slice(0, 8) || "N/A",
      };
    });
  }, [customers, contracts]);

  const columns = useMemo<Column<TenantRow>[]>(() => [
    {
      header: "Khách thuê",
      accessor: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={row.avatar}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
          />
          <div className="min-w-0 flex flex-col">
            <span className="text-[14px] font-black text-text truncate">{row.fullName}</span>
            <span className="text-[12px] font-semibold text-muted truncate">{row.code}</span>
          </div>
        </div>
      ),
      className: "min-w-[240px]",
    },
    {
      header: "Phòng / Tòa",
      accessor: (row) => (
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-bold text-text truncate">{row.roomLabel}</span>
          <span className="text-[12px] font-medium text-muted truncate">{row.buildingName}</span>
        </div>
      ),
      className: "min-w-[180px]",
    },
    {
      header: "Liên hệ",
      accessor: (row) => (
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-bold text-text truncate">{row.phone}</span>
          <span className="text-[12px] font-medium text-muted truncate">{row.email}</span>
        </div>
      ),
      className: "min-w-[160px]",
    },
    {
      header: "Hợp đồng",
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <CalendarClock size={14} className={row.contractDays <= 30 ? "text-[#f97316]" : "text-muted"} />
          <span className={`text-[13px] font-bold ${row.contractDays <= 30 ? "text-[#f97316]" : "text-text"}`}>
            Còn {row.contractDays} ngày
          </span>
        </div>
      ),
      className: "min-w-[120px]",
    },
    {
      header: "Công nợ",
      accessor: (row) => (
        <span className={`text-[13px] font-black ${row.debt > 0 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
          {row.debt > 0 ? formatMoney(row.debt) : "0đ"}
        </span>
      ),
      className: "min-w-[120px] text-right",
    },
    {
      header: "Rủi ro",
      accessor: (row) => (
        <Badge variant={row.risk === "low" ? "success" : row.risk === "medium" ? "warning" : "error"}>
          {row.risk === "low" ? (
            <>
              <ShieldCheck size={12} className="mr-1" /> Thấp
            </>
          ) : row.risk === "medium" ? (
            <>
              <Shield size={12} className="mr-1" /> Trung bình
            </>
          ) : (
            <>
              <ShieldAlert size={12} className="mr-1" /> Cao
            </>
          )}
        </Badge>
      ),
      className: "min-w-[110px]",
    },
    {
      header: "Trạng thái",
      accessor: (row) => (
        <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>
          {row.status === "ACTIVE" ? "Đang thuê" : row.status}
        </Badge>
      ),
      className: "min-w-[110px]",
    },
  ], []);

  const summary = useMemo(() => {
    const totalCustomers = rows.length;
    const newCustomers = customers.filter((customer: any) => {
      if (!customer.createdAt) return false;
      const createdAt = new Date(customer.createdAt).getTime();
      return (Date.now() - createdAt) / (1000 * 60 * 60 * 24) <= 30;
    }).length;
    const totalDebt = rows.reduce((sum, tenant) => sum + tenant.debt, 0);
    const expiring = rows.filter((tenant) => tenant.contractDays > 0 && tenant.contractDays <= 30).length;
    return { totalCustomers, newCustomers, totalDebt, expiring };
  }, [customers, rows]);

  if (customersLoading || contractsLoading) {
    return <LoadingState message="Đang tải danh sách khách thuê..." />;
  }

  if (customersError) {
    return (
      <div data-testid="tenants-error-state">
        <ErrorState message="Có lỗi xảy ra khi tải danh sách khách hàng." onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div data-testid="empty-tenants-state">
        <EmptyState title="Không có dữ liệu" message="Không tìm thấy khách hàng nào phù hợp với bộ lọc." />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-[8px]">
        <h3 className="font-black text-[18px] text-text">Danh sách khách thuê</h3>
        <span className="text-[13px] font-bold text-muted bg-black/5 dark:bg-white/5 px-[12px] py-[4px] rounded-[8px]">
          Hiển thị {rows.length} / {summary.totalCustomers}
        </span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 px-[8px]">
        <StatMini title="Tổng khách" value={summary.totalCustomers.toString()} />
        <StatMini title="Mới / tháng" value={summary.newCustomers.toString()} />
        <StatMini title="Tổng nợ" value={formatMoney(summary.totalDebt)} />
        <StatMini title="Sắp hết HĐ" value={summary.expiring.toString()} />
      </div>

      <Table
        data-testid="tenants-list"
        columns={columns}
        data={rows}
        onRowClick={(row) => setSelectedTenant(customers.find((customer) => customer.id === row.id) || null)}
        emptyMessage="Không tìm thấy khách hàng nào phù hợp với bộ lọc."
        rowTestId={(row) => `tenant-row-${row.id}`}
      />

      <TenantDetailDrawer tenant={selectedTenant} onClose={() => setSelectedTenant(null)} />
    </>
  );
}

function StatMini({ title, value }: { title: string; value: string }) {
  return (
    <Card className="p-3 flex flex-col gap-1">
      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{title}</span>
      <span className="text-[16px] font-black text-text">{value}</span>
    </Card>
  );
}
