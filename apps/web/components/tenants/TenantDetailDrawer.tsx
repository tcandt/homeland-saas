"use client";

import React, { useState } from "react";
import { Phone, Building, MessageCircle, ChevronRight, ShieldAlert, ShieldCheck, Shield, Edit, Trash2 } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import TenantFormModal from "./TenantFormModal";
import { useDeleteCustomerMutation } from "@/lib/mutations/customers.mutations";

export default function TenantDetailDrawer({ tenant, onClose }: { tenant: any | null, onClose: () => void }) {
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const deleteMutation = useDeleteCustomerMutation();

  if (!tenant) return null;

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(tenant.id, {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        onClose();
      }
    });
  };

  return (
    <>
      <Modal
        testId="tenant-detail-drawer"
        isOpen={!!tenant} 
        onClose={onClose} 
        maxWidth="max-w-4xl"
        title={
          <div className="flex items-center gap-4">
            <span>Hồ sơ khách thuê</span>
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-black/5 dark:bg-white/5 rounded-[8px]">
              <span className="font-bold text-[12px] text-muted">Mã: {tenant.code}</span>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-6 md:gap-8">
        {/* Profile Hero */}
            <Card className="flex flex-col md:flex-row md:items-center gap-6 p-6 relative">
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsEditFormOpen(true)} data-testid="edit-tenant-button">
                  <Edit size={16} className="mr-2" />
                  Sửa
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" data-testid="delete-tenant-button" disabled={deleteMutation.isPending}>
                  <Trash2 size={16} className="mr-2" />
                  {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
                </Button>
              </div>
              <img src={tenant.avatar} className="w-[100px] h-[100px] rounded-full border-4 border-background shadow-md object-cover" alt="" />
              <div className="flex-1">
                <h3 className="font-black text-[28px] leading-tight text-text mb-2">{tenant.fullName || tenant.name || "Khách thuê"}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="primary"><Building size={14} className="mr-1.5"/> {tenant.contracts?.[0]?.room?.number || tenant.room || 'Chưa có phòng'}</Badge>
                  <Badge variant="neutral"><Phone size={14} className="mr-1.5"/> {tenant.phone}</Badge>
                  {(tenant.zaloChatId || tenant.zaloUserId) && (
                    <Badge variant="neutral">
                      <MessageCircle size={14} className="mr-1.5" />
                      {tenant.zaloChatId || tenant.zaloUserId}
                    </Badge>
                  )}
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
        </div>
      </Modal>

      <TenantFormModal 
        isOpen={isEditFormOpen} 
        onClose={() => setIsEditFormOpen(false)} 
        tenant={tenant}
      />

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Xác nhận xóa khách thuê"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={deleteMutation.isPending}>
              Hủy
            </Button>
            <Button 
              onClick={confirmDelete}
              className="bg-rose-500 text-white hover:bg-rose-600"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa khách thuê"}
            </Button>
          </div>
        }
      >
        <div className="py-2 flex flex-col gap-3">
          <p className="text-sm text-text font-medium">
            Bạn có chắc chắn muốn xóa khách thuê <span className="font-black">{tenant.fullName || tenant.name || "này"}</span> không?
          </p>
          <p className="text-xs text-muted">
            Hành động này không thể hoàn tác. Dữ liệu khách thuê sẽ bị xóa khỏi hệ thống.
          </p>
        </div>
      </Modal>
    </>
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
