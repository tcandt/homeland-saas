"use client";

import React from "react";
import { Building2, Mail, Phone, Globe, QrCode, Upload } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";

type BusinessProfileSettings = {
  companyName: string;
  taxCode: string;
  representative: string;
  address: string;
  email: string;
  hotline: string;
  website: string;
  branch: string;
  invoiceName: string;
  invoiceTaxCode: string;
  invoiceAddress: string;
  contractSigner: string;
  contractSignerTitle: string;
  defaultTerms: string;
  bankName: string;
  bankAccount: string;
  bankOwner: string;
  bankBranch: string;
};

const fallback: BusinessProfileSettings = {
  companyName: "",
  taxCode: "",
  representative: "",
  address: "",
  email: "",
  hotline: "",
  website: "",
  branch: "",
  invoiceName: "",
  invoiceTaxCode: "",
  invoiceAddress: "",
  contractSigner: "",
  contractSignerTitle: "",
  defaultTerms: "",
  bankName: "",
  bankAccount: "",
  bankOwner: "",
  bankBranch: "",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-[20px] flex flex-col gap-[20px]">
      <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">{title}</h3>
      {children}
    </Card>
  );
}

export default function SettingsBusinessProfile() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<BusinessProfileSettings>("business-profile", "TENANT", fallback);

  const update = (key: keyof BusinessProfileSettings) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const field = (label: string, key: keyof BusinessProfileSettings, options?: { type?: string; className?: string; placeholder?: string }) => (
    <div className={`flex flex-col gap-[6px] ${options?.className ?? ""}`}>
      <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
      <Input type={options?.type ?? "text"} value={draft[key]} onChange={update(key)} placeholder={options?.placeholder} />
    </div>
  );

  return (
    <div className="flex flex-col gap-[20px]">
      <Section title="Thông tin công ty">
        <div className="flex items-start gap-[24px]">
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
            {field("Tên công ty", "companyName", { className: "col-span-2", placeholder: "Nhập tên công ty" })}
            {field("Mã số thuế (MST)", "taxCode", { placeholder: "Nhập mã số thuế" })}
            {field("Người đại diện", "representative", { placeholder: "Nhập người đại diện" })}
            {field("Địa chỉ", "address", { className: "col-span-2", placeholder: "Nhập địa chỉ công ty" })}
          </div>
        </div>
      </Section>

      <Section title="Liên hệ">
        <div className="grid grid-cols-2 gap-[14px]">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Email công ty</label>
            <div className="relative">
              <Mail size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
              <Input type="email" value={draft.email} onChange={update("email")} placeholder="Nhập email công ty" className="pl-[36px]" />
            </div>
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Hotline</label>
            <div className="relative">
              <Phone size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
              <Input type="tel" value={draft.hotline} onChange={update("hotline")} placeholder="Nhập hotline" className="pl-[36px]" />
            </div>
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Website</label>
            <div className="relative">
              <Globe size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
              <Input type="url" value={draft.website} onChange={update("website")} placeholder="Nhập website" className="pl-[36px]" />
            </div>
          </div>
          {field("Chi nhánh / văn phòng", "branch", { placeholder: "Nhập chi nhánh hoặc văn phòng" })}
        </div>
      </Section>

      <Section title="Thông tin xuất hóa đơn / hợp đồng">
        <div className="grid grid-cols-2 gap-[14px]">
          {field("Tên đơn vị trên hóa đơn", "invoiceName", { placeholder: "Nhập tên đơn vị" })}
          {field("MST xuất hóa đơn", "invoiceTaxCode", { placeholder: "Nhập mã số thuế" })}
          {field("Địa chỉ trên hóa đơn", "invoiceAddress", { className: "col-span-2", placeholder: "Nhập địa chỉ hóa đơn" })}
          {field("Người ký hợp đồng", "contractSigner", { placeholder: "Nhập người ký" })}
          {field("Chức danh người ký", "contractSignerTitle", { placeholder: "Nhập chức danh" })}
          <div className="col-span-2 flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Điều khoản mặc định</label>
            <Textarea rows={3} value={draft.defaultTerms} onChange={update("defaultTerms")} placeholder="Nhập điều khoản mặc định nếu có" />
          </div>
        </div>
      </Section>

      <Section title="QR thanh toán">
        <div className="flex items-start gap-[20px]">
          <div className="w-[120px] h-[120px] border-2 border-dashed border-border rounded-[16px] flex flex-col items-center justify-center gap-[8px] cursor-pointer hover:border-primary transition-colors group bg-background">
            <QrCode size={36} className="text-muted group-hover:text-primary" />
            <span className="text-[11px] font-bold text-muted group-hover:text-primary">Tải QR lên</span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-[14px]">
            {field("Ngân hàng", "bankName", { placeholder: "Nhập ngân hàng" })}
            {field("Số tài khoản", "bankAccount", { placeholder: "Nhập số tài khoản" })}
            {field("Chủ tài khoản", "bankOwner", { className: "col-span-2", placeholder: "Nhập chủ tài khoản" })}
            {field("Chi nhánh", "bankBranch", { className: "col-span-2", placeholder: "Nhập chi nhánh" })}
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button variant="primary" onClick={() => save()} isLoading={isSaving}>
          Lưu Business Profile
        </Button>
      </div>
    </div>
  );
}
