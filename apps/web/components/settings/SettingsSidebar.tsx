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
      { id: "overview", icon: <Activity size={15} />, label: "Tổng quan hệ thống", desc: "Tình trạng và cấu hình chung" },
    ],
  },
  {
    label: "ACCESS & SECURITY",
    items: [
      { id: "profile", icon: <User size={15} />, label: "Hồ sơ cá nhân", desc: "Thông tin tài khoản đăng nhập" },
      { id: "security", icon: <Shield size={15} />, label: "Bảo mật tài khoản", desc: "Mật khẩu và kiểm soát truy cập" },
      { id: "team", icon: <Users size={15} />, label: "Nhân sự & phân quyền", desc: "Account nội bộ và vai trò" },
    ],
  },
  {
    label: "AUTOMATION",
    items: [
      { id: "notifications", icon: <Bell size={15} />, label: "Tự động thông báo", desc: "Chuỗi nhắc và rule gửi tin" },
    ],
  },
  {
    label: "FINANCE & DATA",
    items: [
      { id: "accounting", icon: <BookOpen size={15} />, label: "Cấu hình kế toán", desc: "Tài khoản và hạch toán" },
      { id: "templates", icon: <FileText size={15} />, label: "Biểu mẫu", desc: "Mẫu hợp đồng và hóa đơn" },
      { id: "integrations", icon: <Plug size={15} />, label: "Trung tâm tích hợp", desc: "Kết nối ứng dụng và webhook" },
      { id: "owners", icon: <UsersRound size={15} />, label: "Chủ sở hữu", desc: "Phân tòa và tài khoản owner" },
      { id: "hunonic", icon: <PlugZap size={15} />, label: "Điện Hunonic", desc: "Công tơ điện và đồng bộ LK01" },
      { id: "backup", icon: <Database size={15} />, label: "Sao lưu dữ liệu", desc: "Lưu trữ và khôi phục" },
    ],
  },
];

interface Props {
  activeSection: SettingsSection;
  onSelect: (s: SettingsSection) => void;
}

export default function SettingsSidebar({ activeSection, onSelect }: Props) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-[8px] lg:sticky lg:top-[80px] lg:w-[280px]">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-[2px]">
          <div className="px-[12px] py-[6px] text-[10px] font-black uppercase tracking-[0.12em] text-muted">
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <Button
                key={item.id}
                onClick={() => onSelect(item.id)}
                variant={isActive ? "primary" : "ghost"}
                className={`group flex h-auto w-full items-center justify-start gap-[10px] rounded-xl px-[12px] py-[10px] text-left transition-all duration-150 ${isActive ? "shadow-sm" : ""}`}
              >
                <span className={`shrink-0 ${isActive ? "text-white" : "text-muted group-hover:text-primary"}`}>
                  {item.icon}
                </span>
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className={`text-[13px] font-bold leading-none ${isActive ? "text-white" : "text-text"}`}>
                    {item.label}
                  </span>
                  <span className={`mt-[2px] text-[11px] font-medium ${isActive ? "text-white/70" : "text-muted"}`}>
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
