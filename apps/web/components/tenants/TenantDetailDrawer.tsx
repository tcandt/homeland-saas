"use client";

import React, { useState } from "react";
import {
  Phone,
  Building,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Edit,
  Trash2,
  Calendar,
  CreditCard,
  User,
  FileText,
  CheckCircle2,
  Clock,
  Zap,
  Droplets,
  Wifi,
  AlertCircle,
  FileCheck,
  FileSignature,
  Download,
  PlusCircle,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import TenantFormModal from "./TenantFormModal";
import { useDeleteCustomerMutation } from "@/lib/mutations/customers.mutations";

export function getTenantAvatar(avatarUrl?: string, fullName?: string, gender?: string) {
  if (avatarUrl && avatarUrl.trim() !== "" && !avatarUrl.includes("ui-avatars.com/api/?name=undefined") && !avatarUrl.includes("Kh%C3%A1ch")) {
    return avatarUrl;
  }
  const cleanGender = (gender || "").trim().toLowerCase();
  const isFemale = cleanGender === "female" || cleanGender === "nu" || cleanGender === "nữ" || cleanGender === "gái";
  const nameSeed = encodeURIComponent(fullName || "Khách");

  if (isFemale) {
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${nameSeed}&gender=female&backgroundColor=ffd5dc,ffdfbf,ffd5e5`;
  }
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${nameSeed}&gender=male&backgroundColor=d1d4f9,c0aede,b6e3f4`;
}

function formatDate(value?: string | Date) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0)} đ`;
}

export default function TenantDetailDrawer({ tenant, onClose }: { tenant: any | null; onClose: () => void }) {
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    info: true,
    contract: true,
    finance: false,
    invoices: false,
    tempResidence: false,
    activity: false,
  });

  const deleteMutation = useDeleteCustomerMutation();

  if (!tenant) return null;

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(tenant.id, {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        onClose();
      },
    });
  };

  // Resolve customer data fields safely
  const rawCustomer = tenant.source || tenant;
  const fullName = tenant.fullName || rawCustomer.fullName || rawCustomer.name || "Khách thuê";
  const gender = rawCustomer.gender || tenant.gender || "Nam";
  const isFemale =
    gender.trim().toLowerCase() === "female" ||
    gender.trim().toLowerCase() === "nu" ||
    gender.trim().toLowerCase() === "nữ" ||
    gender.trim().toLowerCase() === "gái";

  const avatarUrl = getTenantAvatar(tenant.avatar || rawCustomer.avatar, fullName, gender);
  const phone = tenant.phone || rawCustomer.phone || "N/A";
  const email = tenant.email || rawCustomer.email || "N/A";
  const citizenId = rawCustomer.identityNo || rawCustomer.citizenId || "Chưa cập nhật";
  const birthDate = rawCustomer.birthDate ? formatDate(rawCustomer.birthDate) : "Chưa cập nhật";
  const address = rawCustomer.address || "Chưa cập nhật";
  const nationality = rawCustomer.nationality || "Việt Nam";
  const emergencyPhone = rawCustomer.emergencyPhone || "Chưa có";
  const zaloId = rawCustomer.zaloChatId || rawCustomer.zaloUserId || phone;
  const code = tenant.code || rawCustomer.code || `KH-${phone.slice(-4) || tenant.id.slice(0, 6)}`;

  // Contract & Room fields
  const activeContract = tenant.activeContract || rawCustomer.contracts?.[0] || null;
  const hasContract = !!activeContract;
  const roomLabel = tenant.roomLabel || activeContract?.room?.number || activeContract?.room?.code || "Chưa xếp phòng";
  const buildingName = tenant.buildingName || activeContract?.room?.building?.name || "Chưa có tòa";
  const debt = Number(tenant.debt || rawCustomer.kpis?.totalDebt || activeContract?.debt || 0);

  const startDate = activeContract?.startDate || tenant.startDate;
  const endDate = activeContract?.endDate || tenant.endDate;
  const contractDaysLeft = tenant.contractDays !== undefined
    ? tenant.contractDays
    : endDate
    ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Status computation
  const statusLabel = tenant.statusLabel || (hasContract ? (contractDaysLeft > 0 ? "Đang thuê" : "Hết hạn HĐ") : "Chưa thuê");
  const statusVariant = tenant.statusVariant || (hasContract ? (contractDaysLeft > 0 ? "success" : "error") : "neutral");

  return (
    <>
      <Modal
        testId="tenant-detail-drawer"
        isOpen={!!tenant}
        onClose={onClose}
        maxWidth="max-w-4xl"
        title={
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-black text-text">Hồ sơ khách thuê</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 border border-primary/20 rounded-lg">
              <span className="font-mono font-bold text-[11px] text-primary">Mã: {code}</span>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          {/* PROFILE HERO CARD */}
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-5 md:p-6 shadow-sm">
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditFormOpen(true)}
                data-testid="edit-tenant-button"
                className="h-8 rounded-xl bg-card border-border hover:bg-muted/10 text-xs font-bold text-text shadow-sm"
              >
                <Edit size={13} className="mr-1.5 text-primary" />
                Sửa hồ sơ
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="h-8 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 text-xs font-bold"
                data-testid="delete-tenant-button"
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={13} className="mr-1.5" />
                {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Avatar with Gender Styling & Corner Badge */}
              <div className="relative shrink-0">
                <div
                  className={`relative h-20 w-20 md:h-24 md:w-24 overflow-hidden rounded-2xl border-2 shadow-md transition-all ${
                    isFemale ? "border-rose-400/50 bg-rose-500/10 ring-4 ring-rose-500/10" : "border-sky-400/50 bg-sky-500/10 ring-4 ring-sky-500/10"
                  }`}
                >
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      // Fallback if svg fails to load
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                {/* Gender Badge on Avatar */}
                <div
                  className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-xs font-black shadow-sm ${
                    isFemale ? "bg-rose-500 text-white" : "bg-sky-500 text-white"
                  }`}
                  title={isFemale ? "Giới tính: Nữ" : "Giới tính: Nam"}
                >
                  {isFemale ? "♀" : "♂"}
                </div>
              </div>

              {/* Profile Details */}
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-1.5">
                  <h3 className="font-black text-xl md:text-2xl leading-tight text-text">{fullName}</h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      isFemale ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                    }`}
                  >
                    {isFemale ? "♀ Nữ" : "♂ Nam"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-muted">
                  {/* Room & Building Badge */}
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1 text-primary font-bold">
                    <Building size={13} className="shrink-0" />
                    <span>
                      {roomLabel !== "N/A" && roomLabel !== "Chưa xếp phòng" ? `Phòng ${roomLabel}` : "Chưa xếp phòng"}
                      {buildingName !== "Chưa có tòa" ? ` • ${buildingName}` : ""}
                    </span>
                  </div>

                  {/* Phone Badge */}
                  {phone !== "N/A" && (
                    <a
                      href={`tel:${phone}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-text hover:text-primary transition-colors"
                    >
                      <Phone size={12} className="text-emerald-500" />
                      <span>{phone}</span>
                    </a>
                  )}

                  {/* Zalo ID */}
                  {zaloId && zaloId !== "N/A" && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-muted">
                      <MessageCircle size={12} className="text-sky-500" />
                      <span className="font-mono text-[11px]">{zaloId}</span>
                    </div>
                  )}

                  {/* Risk Badge */}
                  <RiskBadge risk={tenant.risk} />
                </div>
              </div>
            </div>
          </div>

          {/* QUICK STATS 4 KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatCard
              icon={<Zap size={16} className="text-primary" />}
              label="Trạng thái"
              value={statusLabel}
              badgeVariant={statusVariant}
              subText={hasContract ? "Hợp đồng chính thức" : "Chưa có hợp đồng"}
            />
            <StatCard
              icon={<Calendar size={16} className="text-amber-500" />}
              label="Hạn hợp đồng"
              value={hasContract ? `Còn ${contractDaysLeft} ngày` : "Chưa ký HĐ"}
              valueColor={hasContract ? (contractDaysLeft <= 30 ? "text-amber-500" : "text-text") : "text-muted"}
              subText={hasContract ? `${formatDate(startDate)} - ${formatDate(endDate)}` : "Chưa phát sinh"}
            />
            <StatCard
              icon={<CreditCard size={16} className={debt > 0 ? "text-rose-500" : "text-emerald-500"} />}
              label="Công nợ hiện tại"
              value={formatMoney(debt)}
              valueColor={debt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}
              subText={debt > 0 ? "Cần thanh toán" : "Đã thanh toán đủ"}
            />
            <StatCard
              icon={<FileCheck size={16} className={rawCustomer.tempResidence === "Đã khai báo" ? "text-emerald-500" : "text-muted"} />}
              label="Tạm trú (CT01)"
              value={rawCustomer.tempResidence || "Chưa khai báo"}
              valueColor={rawCustomer.tempResidence === "Đã khai báo" ? "text-emerald-600" : "text-muted"}
              subText={rawCustomer.tempResidence === "Đã khai báo" ? "Đã đăng ký Công an" : "Chưa tạo hồ sơ CT01"}
            />
          </div>

          {/* DETAILED BUSINESS SECTIONS (RICH ACCORDIONS) */}
          <div className="flex flex-col gap-3.5">
            <h4 className="font-black text-[16px] md:text-[17px] text-text flex items-center gap-2">
              <FileSignature size={18} className="text-primary" />
              Chi tiết nghiệp vụ & Hồ sơ quản lý
            </h4>

            {/* 1. THÔNG TIN CÁ NHÂN & ĐỊNH DANH */}
            <AccordionItem
              isOpen={openSections.info}
              onToggle={() => toggleSection("info")}
              icon={<User size={16} className="text-primary" />}
              title="Thông tin cá nhân & Giấy tờ định danh"
              badgeText={citizenId !== "Chưa cập nhật" ? "Đã có CCCD" : "Chưa có CCCD"}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-3 rounded-xl bg-surface/50 p-3.5 border border-border/50">
                  <InfoRow label="Họ và tên" value={fullName} isBold />
                  <InfoRow label="Giới tính" value={gender} />
                  <InfoRow label="Ngày sinh" value={birthDate} />
                  <InfoRow label="Quốc tịch" value={nationality} />
                  <InfoRow label="Số CCCD / CMND" value={citizenId} isMono isBold />
                </div>

                <div className="space-y-3 rounded-xl bg-surface/50 p-3.5 border border-border/50">
                  <InfoRow label="Số điện thoại chính" value={phone} isMono />
                  <InfoRow label="SĐT khẩn cấp (Người thân)" value={emergencyPhone} isMono />
                  <InfoRow label="Email" value={email} />
                  <InfoRow label="Zalo liên hệ" value={zaloId} isMono />
                  <InfoRow label="Địa chỉ thường trú (Quê quán)" value={address} />
                </div>
              </div>

              {/* CCCD Images preview if available */}
              {rawCustomer.idImages && rawCustomer.idImages.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/60">
                  <span className="text-xs font-bold text-muted mb-2 block">Ảnh giấy tờ CCCD / Định danh:</span>
                  <div className="flex flex-wrap gap-3">
                    {rawCustomer.idImages.map((imgUrl: string, idx: number) => (
                      <a
                        key={idx}
                        href={imgUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative h-20 w-32 overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:border-primary transition-all"
                      >
                        <img src={imgUrl} alt={`CCCD ${idx + 1}`} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white">Mặt {idx + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </AccordionItem>

            {/* 2. HỢP ĐỒNG & DỊCH VỤ ĐANG THUÊ */}
            <AccordionItem
              isOpen={openSections.contract}
              onToggle={() => toggleSection("contract")}
              icon={<Building size={16} className="text-amber-500" />}
              title="Hợp đồng & Dịch vụ đang thuê"
              badgeText={hasContract ? `Phòng ${roomLabel}` : "Chưa có HĐ"}
              badgeVariant={hasContract ? "success" : "neutral"}
            >
              {hasContract ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-xl border border-border/60 bg-surface/50 p-3 flex flex-col gap-1">
                      <span className="text-muted font-bold uppercase text-[10px]">Mã hợp đồng</span>
                      <span className="font-mono font-black text-text text-sm">{activeContract.code || `HD-${roomLabel}`}</span>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-surface/50 p-3 flex flex-col gap-1">
                      <span className="text-muted font-bold uppercase text-[10px]">Giá thuê phòng</span>
                      <span className="font-mono font-black text-primary text-sm">{formatMoney(Number(activeContract.monthlyRent || 0))}/tháng</span>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-surface/50 p-3 flex flex-col gap-1">
                      <span className="text-muted font-bold uppercase text-[10px]">Tiền đặt cọc</span>
                      <span className="font-mono font-black text-emerald-600 text-sm">{formatMoney(Number(activeContract.depositMoney || 0))}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-surface/50 p-3.5 space-y-2.5 text-xs">
                    <InfoRow label="Phòng thuê" value={`Phòng ${roomLabel} (Tòa ${buildingName})`} isBold />
                    <InfoRow label="Thời hạn hợp đồng" value={`${formatDate(startDate)} đến ${formatDate(endDate)} (Còn ${contractDaysLeft} ngày)`} />
                    <InfoRow label="Số người đăng ký ở" value={`${activeContract.memberCount || 1} người`} />
                    <InfoRow label="Ngày chốt hóa đơn định kỳ" value="Ngày 1 - 5 hàng tháng" />
                  </div>

                  {/* Dịch vụ tiện ích */}
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2 text-xs">
                    <span className="font-bold text-text block mb-2">Các dịch vụ & Tiện ích đi kèm:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <ServiceChip icon={<Zap size={13} className="text-amber-500" />} label="Điện" value="Theo giá nhà nước" />
                      <ServiceChip icon={<Droplets size={13} className="text-sky-500" />} label="Nước" value="100.000 đ / người" />
                      <ServiceChip icon={<Wifi size={13} className="text-indigo-500" />} label="Wifi" value="Miễn phí" />
                      <ServiceChip icon={<FileText size={13} className="text-emerald-500" />} label="Dịch vụ" value="Vệ sinh / Rác" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted space-y-2">
                  <Building size={24} className="mx-auto text-muted/60" />
                  <p className="font-bold text-text">Khách hàng chưa có hợp đồng thuê phòng nào</p>
                  <p>Bạn có thể tạo hợp đồng mới hoặc xếp khách vào danh sách bạn cùng phòng.</p>
                </div>
              )}
            </AccordionItem>

            {/* 3. THANH TOÁN & CÔNG NỢ */}
            <AccordionItem
              isOpen={openSections.finance}
              onToggle={() => toggleSection("finance")}
              icon={<CreditCard size={16} className="text-emerald-500" />}
              title="Thanh toán & Tình trạng công nợ"
              badgeText={debt > 0 ? `Nợ ${formatMoney(debt)}` : "0 đ nợ"}
              badgeVariant={debt > 0 ? "error" : "success"}
            >
              <div className="space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface/50 p-4">
                  <div>
                    <span className="text-muted font-bold text-[11px] block">Tổng dư nợ hiện tại</span>
                    <span className={`text-xl font-black font-mono ${debt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatMoney(debt)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted text-[11px] block">Cổng thanh toán tự động</span>
                    <span className="font-bold text-primary">SePay VietQR 24/7</span>
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-3 text-muted">
                  <p className="text-xs">Khi có hóa đơn mới, hệ thống sẽ tự động đối soát giao dịch chuyển khoản qua SePay để gạch nợ ngay lập tức cho khách thuê này.</p>
                </div>
              </div>
            </AccordionItem>

            {/* 4. LỊCH SỬ HÓA ĐƠN */}
            <AccordionItem
              isOpen={openSections.invoices}
              onToggle={() => toggleSection("invoices")}
              icon={<FileText size={16} className="text-sky-500" />}
              title="Lịch sử hóa đơn tiền phòng & Dịch vụ"
              badgeText="Hóa đơn"
            >
              <div className="rounded-xl border border-border/60 bg-surface/40 p-4 text-center text-xs text-muted">
                <Clock size={20} className="mx-auto text-muted/60 mb-2" />
                <p className="font-bold text-text mb-0.5">Danh sách hóa đơn của khách thuê</p>
                <p>Tất cả hóa đơn tiền phòng, tiền điện Hunonic và dịch vụ phát sinh sẽ được hiển thị tại đây.</p>
              </div>
            </AccordionItem>

            {/* 5. KHAI BÁO TẠM TRÚ (CT01) */}
            <AccordionItem
              isOpen={openSections.tempResidence}
              onToggle={() => toggleSection("tempResidence")}
              icon={<FileCheck size={16} className="text-indigo-500" />}
              title="Khai báo tạm trú (Mẫu CT01 - Bộ Công An)"
              badgeText={rawCustomer.tempResidence || "Chưa khai báo"}
              badgeVariant={rawCustomer.tempResidence === "Đã khai báo" ? "success" : "neutral"}
            >
              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-border/60 bg-surface/50 p-3.5 space-y-2">
                  <InfoRow label="Trạng thái hồ sơ CT01" value={rawCustomer.tempResidence || "Chưa khai báo với Công an"} isBold />
                  <InfoRow label="Nơi tạm trú đăng ký" value={hasContract ? `Phòng ${roomLabel}, Tòa ${buildingName}` : "Chưa có địa chỉ phòng"} />
                  <InfoRow label="Hạn tạm trú đề xuất" value={endDate ? formatDate(endDate) : "--"} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold">
                    <Download size={12} className="mr-1.5 text-primary" /> Xuất mẫu CT01 (PDF)
                  </Button>
                </div>
              </div>
            </AccordionItem>

            {/* 6. ACTIVITY LOG */}
            <AccordionItem
              isOpen={openSections.activity}
              onToggle={() => toggleSection("activity")}
              icon={<Clock size={16} className="text-muted" />}
              title="Lịch sử hoạt động (Activity Log)"
            >
              <div className="relative pl-6 space-y-3.5 text-xs before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                <TimelineItem
                  title="Hồ sơ khách thuê được ghi nhận"
                  time={formatDate(rawCustomer.createdAt || new Date())}
                  desc={`Khách hàng ${fullName} được thêm vào hệ thống quản lý.`}
                />
                {hasContract && (
                  <TimelineItem
                    title={`Ký hợp đồng phòng ${roomLabel}`}
                    time={formatDate(startDate)}
                    desc={`Hợp đồng kỳ hạn ${formatDate(startDate)} đến ${formatDate(endDate)} có hiệu lực.`}
                  />
                )}
              </div>
            </AccordionItem>
          </div>

          <div className="h-4" />
        </div>
      </Modal>

      <TenantFormModal isOpen={isEditFormOpen} onClose={() => setIsEditFormOpen(false)} tenant={rawCustomer} />

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Xác nhận xóa khách thuê"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={deleteMutation.isPending}>
              Hủy
            </Button>
            <Button onClick={confirmDelete} className="bg-rose-500 text-white hover:bg-rose-600" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa khách thuê"}
            </Button>
          </div>
        }
      >
        <div className="py-2 flex flex-col gap-3">
          <p className="text-sm text-text font-medium">
            Bạn có chắc chắn muốn xóa khách thuê <span className="font-black">{fullName}</span> không?
          </p>
          <p className="text-xs text-muted">Hành động này không thể hoàn tác. Dữ liệu khách thuê sẽ bị xóa khỏi hệ thống.</p>
        </div>
      </Modal>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueColor,
  badgeVariant,
  subText,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  badgeVariant?: any;
  subText?: string;
}) {
  return (
    <Card className="p-3.5 flex flex-col justify-between rounded-2xl border-border/60 bg-card hover:border-primary/30 transition-colors shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">{label}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-muted/20">{icon}</div>
      </div>
      <div>
        {badgeVariant ? (
          <Badge variant={badgeVariant} className="text-xs font-black">
            {value}
          </Badge>
        ) : (
          <span className={`font-black text-[15px] md:text-[16px] font-mono leading-none ${valueColor || "text-text"}`}>
            {value}
          </span>
        )}
        {subText && <span className="text-[10px] font-semibold text-muted block mt-1.5 truncate">{subText}</span>}
      </div>
    </Card>
  );
}

function AccordionItem({
  isOpen,
  onToggle,
  icon,
  title,
  badgeText,
  badgeVariant = "neutral",
  children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  badgeText?: string;
  badgeVariant?: any;
  children: React.ReactNode;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border transition-all duration-200 ${isOpen ? "border-primary/30 bg-card shadow-sm" : "border-border/60 bg-card/60 hover:bg-card hover:border-border"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-surface border border-border/50 shrink-0">
            {icon}
          </div>
          <span className={`font-bold text-[14px] md:text-[15px] truncate ${isOpen ? "text-primary" : "text-text"}`}>
            {title}
          </span>
          {badgeText && (
            <Badge variant={badgeVariant} className="hidden sm:inline-flex text-[10px] font-bold py-0.5">
              {badgeText}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted">
          {isOpen ? <ChevronUp size={18} className="text-primary" /> : <ChevronDown size={18} />}
        </div>
      </button>

      {isOpen && <div className="px-4 pb-4 pt-1 border-t border-border/40 animate-in fade-in-50 duration-200">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value, isBold, isMono }: { label: string; value: string; isBold?: boolean; isMono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted font-medium text-[11px] shrink-0">{label}:</span>
      <span className={`text-text text-[12px] truncate text-right ${isBold ? "font-black" : "font-semibold"} ${isMono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function ServiceChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface/50 px-2.5 py-1.5">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <span className="text-[10px] font-bold text-muted block leading-none">{label}</span>
        <span className="text-[11px] font-black text-text truncate block">{value}</span>
      </div>
    </div>
  );
}

function TimelineItem({ title, time, desc }: { title: string; time: string; desc: string }) {
  return (
    <div className="relative">
      <div className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-text text-xs">{title}</span>
        <span className="text-[10px] font-mono text-muted">{time}</span>
      </div>
      <p className="text-[11px] text-muted mt-0.5">{desc}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  if (risk === "low" || !risk)
    return (
      <Badge variant="success" className="text-[11px]">
        <ShieldCheck size={12} className="mr-1" /> Rủi ro thấp
      </Badge>
    );
  if (risk === "medium")
    return (
      <Badge variant="warning" className="text-[11px]">
        <Shield size={12} className="mr-1" /> Rủi ro TB
      </Badge>
    );
  return (
    <Badge variant="error" className="text-[11px]">
      <ShieldAlert size={12} className="mr-1" /> Rủi ro cao
    </Badge>
  );
}
