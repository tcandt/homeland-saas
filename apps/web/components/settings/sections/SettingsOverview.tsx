"use client";

import React from "react";
import { Building2, Database, Mail, MessageSquare, Shield, UserCog, Wifi, ClipboardList, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useSettingsSectionQuery } from "@/lib/queries/settings.queries";

function hasValue(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => {
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "object" && item !== null) return hasValue(item);
      if (typeof item === "boolean") return item;
      return item !== "" && item !== null && item !== undefined;
    });
  }
  return value !== "";
}

function StatusCard({
  label,
  configured,
  icon,
}: {
  label: string;
  configured: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-[16px] shadow-sm flex flex-col gap-[8px]">
      <div className={`w-[28px] h-[28px] rounded-[8px] flex items-center justify-center ${configured ? "text-success bg-success/10" : "text-muted bg-background"}`}>
        {icon}
      </div>
      <div className="text-[13px] font-black text-text">{configured ? "Đã cấu hình" : "Chưa cấu hình"}</div>
      <div className="text-[11px] font-bold text-muted">{label}</div>
    </div>
  );
}

export default function SettingsOverview() {
  const business = useSettingsSectionQuery<Record<string, unknown>>("business-profile", "TENANT");
  const team = useSettingsSectionQuery<Record<string, unknown>>("team", "TENANT");
  const pricing = useSettingsSectionQuery<Record<string, unknown>>("pricing", "TENANT");
  const contractRules = useSettingsSectionQuery<Record<string, unknown>>("contract-rules", "TENANT");
  const invoiceRules = useSettingsSectionQuery<Record<string, unknown>>("invoice-rules", "TENANT");
  const notifications = useSettingsSectionQuery<Record<string, unknown>>("notifications", "TENANT");
  const email = useSettingsSectionQuery<Record<string, unknown>>("email-provider", "TENANT");
  const zalo = useSettingsSectionQuery<Record<string, unknown>>("zalo-provider", "TENANT");
  const telegram = useSettingsSectionQuery<Record<string, unknown>>("telegram-provider", "TENANT");
  const sepay = useSettingsSectionQuery<Record<string, unknown>>("sepay", "TENANT");

  const cards = [
    { label: "Business Profile", configured: hasValue(business.data?.value), icon: <Building2 size={14} /> },
    { label: "Team & Permission", configured: hasValue(team.data?.value), icon: <UserCog size={14} /> },
    { label: "Pricing & Fees", configured: hasValue(pricing.data?.value), icon: <Database size={14} /> },
    { label: "Contract Rules", configured: hasValue(contractRules.data?.value), icon: <Shield size={14} /> },
    { label: "Invoice Rules", configured: hasValue(invoiceRules.data?.value), icon: <ClipboardList size={14} /> },
    { label: "Notifications", configured: hasValue(notifications.data?.value), icon: <MessageSquare size={14} /> },
  ];

  const integrations = [
    { label: "Email SMTP", configured: hasValue(email.data?.value), icon: <Mail size={14} /> },
    { label: "Zalo OA", configured: hasValue(zalo.data?.value), icon: <MessageSquare size={14} /> },
    { label: "Telegram Bot", configured: hasValue(telegram.data?.value), icon: <MessageSquare size={14} /> },
    { label: "SePay", configured: hasValue(sepay.data?.value), icon: <Wifi size={14} /> },
  ];

  const configuredCount = [...cards, ...integrations].filter((item) => item.configured).length;
  const totalCount = cards.length + integrations.length;

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-[12px]">
        {cards.map((card) => (
          <StatusCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-[24px]">
        <div className="xl:col-span-2 bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
          <div className="flex items-center justify-between mb-[16px]">
            <h3 className="font-black text-[15px] text-text">Tình trạng cấu hình</h3>
            <Badge variant={configuredCount > 0 ? "success" : "warning"}>
              {configuredCount}/{totalCount} đã lưu
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            {[...cards, ...integrations].map((item) => (
              <div key={item.label} className={`flex items-center gap-[10px] p-[12px] rounded-[10px] border ${item.configured ? "border-success/20 bg-success/5" : "border-warning/20 bg-warning/5"}`}>
                <div className={`shrink-0 ${item.configured ? "text-success" : "text-warning"}`}>{item.icon}</div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[12px] font-bold text-text truncate">{item.label}</span>
                  <span className={`text-[11px] font-medium ${item.configured ? "text-success" : "text-warning"}`}>
                    {item.configured ? "Đã có dữ liệu lưu" : "Chưa có dữ liệu trong DB"}
                  </span>
                </div>
                {item.configured ? <CheckCircle2 size={14} className="text-success shrink-0" /> : <AlertTriangle size={14} className="text-warning shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
          <h3 className="font-black text-[15px] text-text">Giám sát hệ thống</h3>
          <div className="mt-[16px] rounded-[14px] border border-dashed border-border bg-background p-[18px] text-center">
            <Database size={20} className="mx-auto text-muted" />
            <div className="mt-[10px] font-black text-text">Chưa có endpoint giám sát thật</div>
            <div className="mt-[6px] text-[13px] font-medium text-muted">
              CPU, memory, disk, cache và backup sẽ chỉ hiển thị khi backend cung cấp dữ liệu thật.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
        <h3 className="font-black text-[15px] text-text">Hoạt động gần đây</h3>
        <div className="mt-[16px] rounded-[14px] border border-dashed border-border bg-background px-[20px] py-[32px] text-center">
          <ClipboardList size={20} className="mx-auto text-muted" />
          <div className="mt-[10px] font-black text-text">Chưa có hoạt động thật trong DB</div>
          <div className="mt-[6px] text-[13px] font-medium text-muted">
            Khu vực này sẽ đồng bộ từ audit log/service activity khi API được kết nối.
          </div>
        </div>
      </div>
    </div>
  );
}
