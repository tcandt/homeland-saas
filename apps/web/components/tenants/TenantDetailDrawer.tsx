"use client";

import { Phone, Building, CalendarClock, CreditCard, ChevronRight, ShieldAlert, ShieldCheck, Shield } from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export default function TenantDetailDrawer({ tenant, onClose }: { tenant: any | null, onClose: () => void }) {
  if (!tenant) return null;

  return (
    <Drawer 
      testId="tenant-detail-drawer"
      closeTestId="tenant-detail-close"
      isOpen={!!tenant} 
      onClose={onClose} 
      size="lg"
      className="p-4 md:p-6 flex flex-col gap-6 md:gap-8"
      title={
        <div className="flex items-center gap-4">
          <span>Hồ sơ khách thuê</span>
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-black/5 dark:bg-white/5 rounded-[8px]">
            <span className="font-bold text-[12px] text-muted">Mã: {tenant.code}</span>
          </div>
        </div>
      }
    >
      {/* Profile Hero */}
          <Card className="flex flex-col md:flex-row md:items-center gap-6 p-6">
            <img src={tenant.avatar} className="w-[100px] h-[100px] rounded-full border-4 border-background shadow-md object-cover" alt="" />
            <div className="flex-1">
              <h3 className="font-black text-[28px] leading-tight text-text mb-2">{tenant.name}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="primary"><Building size={14} className="mr-1.5"/> {tenant.contracts?.[0]?.room?.number || tenant.room || 'Chưa có phòng'}</Badge>
                <Badge variant="neutral"><Phone size={14} className="mr-1.5"/> {tenant.phone}</Badge>
                <RiskBadge risk={tenant.risk} />
              </div>
            </div>
          </Card>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Trạng thái" value={tenant.status || 'Hoạt động'} color="text-[#22c55e]" />
            <StatCard label="Hợp đồng còn" value={`${tenant.contractDays || 0} ngày`} color="text-text" />
            <StatCard label="Công nợ" value={tenant.debt > 0 ? `${tenant.debt.toLocaleString()} đ` : '0 đ'} color={tenant.debt > 0 ? "text-[#ef4444]" : "text-[#22c55e]"} />
            <StatCard label="Tạm trú" value={tenant.tempResidence || 'Chưa khai báo'} color={tenant.tempResidence === 'Đã khai báo' ? "text-[#22c55e]" : "text-rose-500"} />
          </div>

          {/* Detailed Sections (Accordion style placeholders) */}
          <div className="flex flex-col gap-3">
            <h4 className="font-black text-[18px] text-text mb-2">Chi tiết nghiệp vụ</h4>
            <DrawerAccordion title="Thông tin cá nhân" active />
            <DrawerAccordion title="Hợp đồng & Dịch vụ" />
            <DrawerAccordion title="Thanh toán & Công nợ" />
            <DrawerAccordion title="Lịch sử hóa đơn" />
            <DrawerAccordion title="Khai báo tạm trú" />
            <DrawerAccordion title="Lịch sử hoạt động (Activity Log)" />
          </div>

          {/* Bottom Padding */}
          <div className="h-[40px]" />
    </Drawer>
  );
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <Card className="p-4 flex flex-col gap-1">
      <span className="text-[12px] font-bold text-muted uppercase tracking-wider">{label}</span>
      <span className={`font-black text-[16px] md:text-[18px] ${color}`}>{value}</span>
    </Card>
  );
}

function DrawerAccordion({ title, active }: { title: string, active?: boolean }) {
  return (
    <Button 
      variant="ghost" 
      className={`w-full justify-between p-4 md:p-5 border rounded-2xl h-auto transition-colors ${active ? 'bg-card border-primary/30 shadow-sm' : 'bg-transparent border-border'}`}
    >
      <span className={`font-bold text-[15px] ${active ? 'text-primary' : 'text-text'}`}>{title}</span>
      <ChevronRight size={18} className={active ? "text-primary rotate-90 transition-transform" : "text-muted transition-transform"} />
    </Button>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  if (risk === 'low' || !risk) return <Badge variant="success"><ShieldCheck size={14} className="mr-1" /> Rủi ro thấp</Badge>;
  if (risk === 'medium') return <Badge variant="warning"><Shield size={14} className="mr-1" /> Rủi ro TB</Badge>;
  return <Badge variant="error"><ShieldAlert size={14} className="mr-1" /> Rủi ro cao</Badge>;
}
