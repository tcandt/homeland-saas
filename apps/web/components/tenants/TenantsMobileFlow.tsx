"use client";

import React, { useMemo, useState } from "react";
import {
  Users,
  CalendarClock,
  AlertTriangle,
  UserPlus,
  Phone,
  ShieldCheck,
  Shield,
  ShieldAlert,
  ChevronDown,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { SearchInput } from "../ui/SearchInput";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Drawer } from "../ui/Drawer";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { useContractsQuery } from "@/lib/queries/contracts.queries";

type RiskLevel = "low" | "medium" | "high";

interface TenantData {
  id: string;
  name: string;
  avatar: string;
  room: string;
  contractDays: number;
  debt: number;
  phone: string;
  risk: RiskLevel;
}

function getRiskLevel(debt: number): RiskLevel {
  if (debt > 5000000) return "high";
  if (debt > 0) return "medium";
  return "low";
}

export default function TenantsMobileFlow() {
  const [selectedTenant, setSelectedTenant] = useState<TenantData | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { data: customersData, isLoading, isError } = useCustomersQuery({ limit: 100 });
  const { data: contractsData } = useContractsQuery({ limit: 100 });

  const customers: any[] = (customersData as any)?.data || [];
  const contracts: any[] = (contractsData as any)?.data || [];

  const mappedTenants: TenantData[] = useMemo(() => {
    return customers.map((customer: any) => {
      const relatedContract = contracts.find((contract: any) => contract.customerId === customer.id || contract.customer?.id === customer.id);
      const debt = Number(customer.kpis?.totalDebt || relatedContract?.debt || 0);
      const endDate = relatedContract?.endDate;
      const contractDays = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

      return {
        id: customer.id,
        name: customer.fullName || customer.name || "Khách thuê",
        avatar: customer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.fullName || customer.name || "Khách")}`,
        room: customer.rooms?.[0]?.name || relatedContract?.room?.number || relatedContract?.room?.code || "N/A",
        contractDays,
        debt,
        phone: customer.phone || "N/A",
        risk: getRiskLevel(debt),
      };
    });
  }, [customers, contracts]);

  const summary = useMemo(() => {
    const totalCustomers = customers.length;
    const newCustomers = customers.filter((customer: any) => {
      if (!customer.createdAt) return false;
      const createdAt = new Date(customer.createdAt).getTime();
      return (Date.now() - createdAt) / (1000 * 60 * 60 * 24) <= 30;
    }).length;
    const totalDebt = mappedTenants.reduce((sum, tenant) => sum + tenant.debt, 0);
    const expiring = mappedTenants.filter((tenant) => tenant.contractDays > 0 && tenant.contractDays <= 30).length;
    return { totalCustomers, newCustomers, totalDebt, expiring };
  }, [customers, mappedTenants]);

  return (
    <>
      <div data-testid="tenants-root" className="flex flex-col gap-[16px] w-full box-border pb-[100px] bg-background pt-2">
        <div data-testid="tenants-filter-bar" className={`flex items-center gap-2 px-1 relative ${isFilterOpen ? "z-[10005]" : "z-20"}`}>
          <div className="flex-1">
            <SearchInput placeholder="Tìm tên, SĐT khách..." />
          </div>
          <Button aria-label="Lọc khách thuê" variant="outline" size="icon" onClick={() => setIsFilterOpen(true)} className="shrink-0">
            <Filter size={16} />
          </Button>
          <Button aria-label="Sắp xếp" variant="outline" size="icon" className="shrink-0">
            <ArrowUpDown size={16} />
          </Button>

          <Drawer isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} title="Lọc khách thuê" size="full" className="pb-[40px]">
            <div className="grid grid-cols-2 gap-3 mb-5">
              <FilterOption label="Tòa nhà" value="Tất cả" />
              <FilterOption label="Phòng" value="Tất cả" />
              <FilterOption label="Trạng thái HĐ" value="Tất cả" />
              <FilterOption label="Tình trạng nợ" value="Tất cả" />
              <FilterOption label="Mức độ rủi ro" value="Tất cả" />
              <FilterOption label="Thời hạn HĐ" value="Tất cả" />
            </div>

            <Button onClick={() => setIsFilterOpen(false)} variant="primary" className="w-full h-11">
              Áp dụng bộ lọc
            </Button>
          </Drawer>
        </div>

        <section data-testid="tenants-kpi-grid" className="grid grid-cols-4 gap-2 px-1">
          <Card className="p-2.5 flex flex-col items-center justify-center gap-1 bg-primary/10 border-primary/20">
            <div className="text-[16px] font-black text-primary">{summary.totalCustomers}</div>
            <div className="text-[9px] font-bold text-primary uppercase text-center leading-tight">Tổng khách</div>
          </Card>
          <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
            <div className="text-[16px] font-black text-success">{summary.newCustomers}</div>
            <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Mới / Tháng</div>
          </Card>
          <Card className="p-2.5 flex flex-col items-center justify-center gap-1 bg-danger/10 border-danger/20">
            <div className="text-[16px] font-black text-danger">{new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(summary.totalDebt)}đ</div>
            <div className="text-[9px] font-bold text-danger uppercase text-center leading-tight">Tổng nợ</div>
          </Card>
          <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
            <div className="text-[16px] font-black text-warning">{summary.expiring}</div>
            <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Sắp hết HĐ</div>
          </Card>
        </section>

        <section className="flex gap-2 overflow-x-auto hide-scrollbar px-1">
          <Button variant="outline" size="sm" className="rounded-full bg-primary/10 text-primary border-primary/20 shrink-0">
            Tất cả khách ({summary.totalCustomers})
          </Button>
          <Button variant="outline" size="sm" className="rounded-full border-border text-danger shrink-0">
            <AlertTriangle size={12} className="mr-1" /> Đang nợ tiền ({mappedTenants.filter((tenant) => tenant.debt > 0).length})
          </Button>
          <Button variant="outline" size="sm" className="rounded-full border-border text-warning shrink-0">
            <CalendarClock size={12} className="mr-1" /> Sắp hết HĐ ({summary.expiring})
          </Button>
        </section>

        <section data-testid="tenants-list" className="flex flex-col gap-2 px-1">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-[13px] font-black text-text">Danh sách ({summary.totalCustomers})</h3>
          </div>

          <div className="flex flex-col gap-2">
            {isLoading && <div className="p-8 text-center text-muted font-medium">Đang tải khách thuê...</div>}
            {isError && (
              <div data-testid="tenants-error-state" className="text-center p-8 text-rose-500 font-bold">
                <p>Không thể tải khách thuê</p>
                <button onClick={() => window.location.reload()} className="mt-2 text-primary underline">
                  Thử lại
                </button>
              </div>
            )}
            {!isLoading && !isError && mappedTenants.length === 0 && (
              <div data-testid="empty-tenants-state" className="flex flex-col items-center justify-center p-8 text-center text-muted">
                <span className="font-bold">Không có khách thuê nào</span>
              </div>
            )}
            {!isLoading &&
              mappedTenants.map((item, i) => (
                <Card
                  data-testid="tenant-card"
                  key={item.id || i}
                  onClick={() => setSelectedTenant(item)}
                  className="p-3 flex flex-col relative overflow-hidden group active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div
                    className={`absolute top-0 left-0 w-1 h-full ${
                      item.risk === "low" ? "bg-[#22c55e]" : item.risk === "medium" ? "bg-[#f97316]" : "bg-[#ef4444]"
                    }`}
                  />

                  <div className="flex justify-between items-start pl-2">
                    <div className="flex items-center gap-3">
                      <img src={item.avatar} className="w-[36px] h-[36px] rounded-full object-cover border border-border" alt="" />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-black text-text">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted mt-0.5">
                          <span className="font-bold text-text">{item.room}</span> • <Phone size={10} /> {item.phone}
                        </div>
                      </div>
                    </div>

                    {item.risk === "low" && (
                      <Badge variant="success" className="px-1.5 py-0.5 text-[9px] rounded-[4px]">
                        <ShieldCheck size={10} className="mr-1" /> Tốt
                      </Badge>
                    )}
                    {item.risk === "medium" && (
                      <Badge variant="warning" className="px-1.5 py-0.5 text-[9px] rounded-[4px]">
                        <Shield size={10} className="mr-1" /> Rủi ro TB
                      </Badge>
                    )}
                    {item.risk === "high" && (
                      <Badge variant="error" className="px-1.5 py-0.5 text-[9px] rounded-[4px]">
                        <ShieldAlert size={10} className="mr-1" /> Rủi ro Cao
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between pl-2 mt-2 pt-2 border-t border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted uppercase">Hợp đồng</span>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-text">
                        <CalendarClock size={12} className={item.contractDays <= 30 ? "text-[#f97316]" : "text-muted"} />
                        <span className={item.contractDays <= 30 ? "text-[#f97316]" : ""}>Còn {item.contractDays} ngày</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-muted uppercase">Công nợ</span>
                      <span className={`text-[13px] font-black ${item.debt > 0 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                        {item.debt > 0 ? `${new Intl.NumberFormat("vi-VN").format(item.debt)} đ` : "0 đ"}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        </section>
      </div>

      <Drawer
        testId="tenant-detail-drawer"
        closeTestId="tenant-detail-close"
        isOpen={!!selectedTenant}
        onClose={() => setSelectedTenant(null)}
        title="Hồ sơ Khách thuê"
        size="full"
      >
        {selectedTenant && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3">
              <img src={selectedTenant.avatar} className="w-[80px] h-[80px] rounded-full object-cover border-4 border-border shadow-sm" alt="" />
              <div className="text-center">
                <h3 className="font-black text-[22px] text-text leading-tight">{selectedTenant.name}</h3>
                <div className="flex items-center justify-center gap-2 mt-1.5">
                  <Badge variant="primary">{selectedTenant.room}</Badge>
                  {selectedTenant.risk === "low" && <Badge variant="success"><ShieldCheck size={12} className="mr-1" /> Tốt</Badge>}
                  {selectedTenant.risk === "medium" && <Badge variant="warning"><Shield size={12} className="mr-1" /> Rủi ro TB</Badge>}
                  {selectedTenant.risk === "high" && <Badge variant="error"><ShieldAlert size={12} className="mr-1" /> Rủi ro Cao</Badge>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="primary" className="flex-1">
                <Phone size={14} className="mr-2" /> Gọi điện
              </Button>
              <Button variant="outline" className="flex-1 border-[#0068ff]/20 text-[#0068ff] bg-[#0068ff]/10 hover:bg-[#0068ff]/20">
                Nhắn Zalo
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3.5 bg-black/5 dark:bg-white/5 border-border/50">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Số điện thoại</span>
                <div className="text-[14px] font-black text-text mt-1">{selectedTenant.phone}</div>
              </Card>
              <Card className="p-3.5 bg-black/5 dark:bg-white/5 border-border/50">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Hợp đồng</span>
                <div className={`text-[14px] font-black mt-1 ${selectedTenant.contractDays <= 30 ? "text-warning" : "text-text"}`}>Còn {selectedTenant.contractDays} ngày</div>
              </Card>
              <Card className="col-span-2 p-3.5 bg-black/5 dark:bg-white/5 border-border/50">
                <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Công nợ hiện tại</span>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[18px] font-black ${selectedTenant.debt > 0 ? "text-danger" : "text-success"}`}>
                    {selectedTenant.debt > 0 ? `${new Intl.NumberFormat("vi-VN").format(selectedTenant.debt)} đ` : "Không có nợ"}
                  </span>
                  {selectedTenant.debt > 0 && (
                    <Button variant="danger" size="sm" className="h-7 text-[11px] px-2">
                      Tạo phiếu thu
                    </Button>
                  )}
                </div>
              </Card>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <Button variant="outline" className="w-full justify-between p-4 h-auto shadow-sm">
                <span className="text-[13px] font-bold text-text">Xem chi tiết Hợp đồng</span>
                <ChevronDown className="text-muted -rotate-90" size={16} />
              </Button>
              <Button variant="outline" className="w-full justify-between p-4 h-auto shadow-sm">
                <span className="text-[13px] font-bold text-text">Lịch sử thanh toán</span>
                <ChevronDown className="text-muted -rotate-90" size={16} />
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function FilterOption({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-[10px] bg-black/5 dark:bg-white/5 rounded-[10px] cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-center">
      <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-[2px]">{label}</span>
      <div className="flex items-center gap-[4px]">
        <span className="text-[13px] font-bold text-[#6366f1]">{value}</span>
        <ChevronDown size={14} className="text-[#6366f1]" />
      </div>
    </div>
  );
}
