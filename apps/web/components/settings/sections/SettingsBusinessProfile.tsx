"use client";

import React from "react";
import { Camera, Building2, Mail, Phone, Globe, MapPin, User, FileText, QrCode, Upload } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function Field({ label, value, placeholder, type = "text", className = "" }: any) {
  return (
    <div className={`flex flex-col gap-[6px] ${className}`}>
      <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
      <Input
        type={type}
        defaultValue={value}
        placeholder={placeholder}
      />
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <Card className="p-[20px] flex flex-col gap-[20px]">
      <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">{title}</h3>
      {children}
    </Card>
  );
}

export default function SettingsBusinessProfile() {
  return (
    <div className="flex flex-col gap-[20px]">

      {/* Company Identity */}
      <Section title="Thông tin công ty">
        <div className="flex items-start gap-[24px]">
          {/* Logo Upload */}
          <div className="flex flex-col items-center gap-[8px] shrink-0">
            <div className="w-[80px] h-[80px] rounded-[16px] border-2 border-dashed border-border bg-background flex items-center justify-center cursor-pointer hover:border-primary transition-colors group">
              <Building2 size={28} className="text-muted group-hover:text-primary" />
            </div>
            <Button variant="ghost" className="flex items-center gap-[4px] text-[11px] font-bold text-primary hover:underline h-auto p-0">
              <Upload size={11} /> Tải logo
            </Button>
            <span className="text-[10px] text-muted">PNG, SVG. Tối đa 2MB</span>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-[14px]">
            <Field label="Tên công ty" value="HomeLand Premium CRM" className="col-span-2" />
            <Field label="Mã số thuế (MST)" value="0123456789" />
            <Field label="Người đại diện" value="Văn Thể Phan" />
            <Field label="Địa chỉ" value="123 Nguyễn Văn Linh, Quận 7, TP.HCM" className="col-span-2" />
          </div>
        </div>
      </Section>

      {/* Contact */}
      <Section title="Liên hệ & Mạng xã hội">
        <div className="grid grid-cols-2 gap-[14px]">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Email công ty</label>
            <div className="relative">
              <Mail size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
              <Input type="email" defaultValue="info@homeland.vn" className="pl-[36px]" />
            </div>
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Hotline</label>
            <div className="relative">
              <Phone size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
              <Input type="tel" defaultValue="1800 1234" className="pl-[36px]" />
            </div>
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Website</label>
            <div className="relative">
              <Globe size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
              <Input type="url" defaultValue="https://homeland.vn" className="pl-[36px]" />
            </div>
          </div>
          <Field label="Chi nhánh / văn phòng" value="Văn phòng chính - Quận 7" />
        </div>
      </Section>

      {/* Invoice Info */}
      <Section title="Thông tin xuất hóa đơn / hợp đồng">
        <div className="grid grid-cols-2 gap-[14px]">
          <Field label="Tên đơn vị trên hóa đơn" value="CÔNG TY TNHH HOMELAND PREMIUM" />
          <Field label="MST xuất hóa đơn" value="0123456789" />
          <Field label="Địa chỉ trên hóa đơn" value="123 Nguyễn Văn Linh, P.Tân Phong, Q.7, TP.HCM" className="col-span-2" />
          <Field label="Người ký hợp đồng" value="Văn Thể Phan" />
          <Field label="Chức danh người ký" value="Giám đốc điều hành" />
          <div className="col-span-2 flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Điều khoản mặc định</label>
            <Textarea rows={3} defaultValue="Các điều khoản này được áp dụng theo quy định của pháp luật Việt Nam..." />
          </div>
        </div>
      </Section>

      {/* QR Payment */}
      <Section title="QR thanh toán">
        <div className="flex items-start gap-[20px]">
          <div className="w-[120px] h-[120px] border-2 border-dashed border-border rounded-[16px] flex flex-col items-center justify-center gap-[8px] cursor-pointer hover:border-primary transition-colors group bg-background">
            <QrCode size={36} className="text-muted group-hover:text-primary" />
            <span className="text-[11px] font-bold text-muted group-hover:text-primary">Tải QR lên</span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-[14px]">
            <Field label="Ngân hàng" value="Vietcombank" />
            <Field label="Số tài khoản" value="0071000123456" />
            <Field label="Chủ tài khoản" value="CONG TY TNHH HOMELAND PREMIUM" className="col-span-2" />
            <Field label="Chi nhánh" value="CN Quận 7, TP.HCM" className="col-span-2" />
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button variant="primary">
          Lưu Business Profile
        </Button>
      </div>
    </div>
  );
}
