"use client";

import React from "react";
import {
  Activity,
  Bell,
  BookOpen,
  ChevronRight,
  Database,
  FileText,
  Plug,
  PlugZap,
  Shield,
  User,
  Users,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { SettingsSection } from "@/app/settings/page";

interface SidebarGroup {
  label: string;
  items: { id: SettingsSection; icon: React.ReactNode; label: string; desc: string }[];
}

const groups: SidebarGroup[] = [
  {
    label: "SYSTEM",
    items: [
      { id: "overview", icon: <Activity size={15} />, label: "Overview & Status", desc: "Tổng quan hệ thống" },
    ],
  },
  {
    label: "ACCESS & SECURITY",
    items: [
      { id: "profile", icon: <User size={15} />, label: "My Profile", desc: "Hồ sơ cá nhân" },
      { id: "security", icon: <Shield size={15} />, label: "Account Security", desc: "Bảo mật tài khoản" },
      { id: "team", icon: <Users size={15} />, label: "Team & Roles", desc: "Nhân sự, phân quyền" },
    ],
  },
  {
    label: "AUTOMATION",
    items: [
      { id: "notifications", icon: <Bell size={15} />, label: "Notification Automation", desc: "Chuỗi nhắc thông báo" },
    ],
  },
  {
    label: "FINANCE & DATA",
    items: [
      { id: "accounting", icon: <BookOpen size={15} />, label: "Accounting Config", desc: "Tài khoản, kế toán" },
      { id: "templates", icon: <FileText size={15} />, label: "Templates", desc: "Mẫu hợp đồng, hóa đơn" },
      { id: "integrations", icon: <Plug size={15} />, label: "Integration Center", desc: "Kết nối ứng dụng" },
      { id: "owners", icon: <UsersRound size={15} />, label: "Owner Management", desc: "Chủ sở hữu và phân tòa" },
      { id: "hunonic", icon: <PlugZap size={15} />, label: "Hunonic Electricity", desc: "Công tơ điện LK01" },
      { id: "backup", icon: <Database size={15} />, label: "Data & Backup", desc: "Sao lưu dữ liệu" },
    ],
  },
];

interface Props {
  activeSection: SettingsSection;
  onSelect: (s: SettingsSection) => void;
}

export default function SettingsSidebar({ activeSection, onSelect }: Props) {
  return (
    <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-[8px] lg:sticky lg:top-[80px]">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-[2px]">
          <div className="text-[10px] font-black text-muted tracking-[0.12em] uppercase px-[12px] py-[6px]">
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <Button
                key={item.id}
                onClick={() => onSelect(item.id)}
                variant={isActive ? "primary" : "ghost"}
                className={`flex items-center gap-[10px] px-[12px] py-[10px] h-auto rounded-xl text-left transition-all duration-150 group w-full justify-start ${isActive ? "shadow-sm" : ""}`}
              >
                <span className={`shrink-0 ${isActive ? "text-white" : "text-muted group-hover:text-primary"}`}>
                  {item.icon}
                </span>
                <div className="flex flex-col flex-1 min-w-0 items-start">
                  <span className={`text-[13px] font-bold leading-none ${isActive ? "text-white" : "text-text"}`}>
                    {item.label}
                  </span>
                  <span className={`text-[11px] font-medium mt-[2px] ${isActive ? "text-white/70" : "text-muted"}`}>
                    {item.desc}
                  </span>
                </div>
                {isActive && <ChevronRight size={14} className="shrink-0 text-white/60" />}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
