"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  FileText,
  Home,
  LogOut,
  Receipt,
  Rocket,
  Settings,
  User,
  Wallet,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth-store";

interface SidebarProps {
  collapsed: boolean;
}

interface NavItemProps {
  href: string;
  icon: React.ReactElement;
  label: string;
  collapsed: boolean;
  active?: boolean;
  dataTestId?: string;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const { user, clearSession } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const hasSettingsAccess = mounted && (user?.permissions?.includes("setting.read") || user?.roles?.includes("ADMIN"));

  const handleLogout = () => {
    clearSession();
    window.location.href = "/login";
  };

  return (
    <aside
      data-testid="app-sidebar"
      className="h-full border-r border-white/10 bg-[#0d1430] text-white shadow-[12px_0_36px_rgba(15,22,51,0.16)] p-[24px_0] flex flex-col overflow-y-auto hide-scrollbar"
    >
      <div className={`flex items-center gap-3 px-[20px] mb-8 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-[42px] h-[42px] rounded-[12px] bg-gradient-to-br from-[#6956ff] to-[#7c3aed] text-white flex items-center justify-center text-xl shrink-0 shadow-[0_14px_28px_rgba(105,86,255,0.32)]">
          <Home size={22} fill="currentColor" />
        </div>
        {!collapsed && (
          <div className="whitespace-nowrap overflow-hidden">
            <div className="text-[20px] font-black tracking-tight text-white">HomeLand</div>
            <div className="text-[12px] font-semibold text-white/60">Premium CRM</div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-[10px]">
        <NavItem href="/" icon={<Home size={20} />} label="Tổng quan" collapsed={collapsed} active={pathname === "/"} />

        <SectionLabel collapsed={collapsed}>VẬN HÀNH</SectionLabel>
        <NavItem href="/buildings" icon={<Building size={20} />} label="Tòa nhà" collapsed={collapsed} active={pathname.startsWith("/buildings")} />
        <NavItem href="/tenants" icon={<User size={20} />} label="Khách thuê" collapsed={collapsed} active={pathname === "/tenants"} />

        <SectionLabel collapsed={collapsed}>HỢP ĐỒNG</SectionLabel>
        <NavItem href="/contracts" icon={<FileText size={20} />} label="Hợp đồng" collapsed={collapsed} active={pathname === "/contracts"} />
        <NavItem href="/invoices" icon={<Receipt size={20} />} label="Hóa đơn" collapsed={collapsed} active={pathname === "/invoices"} />

        <SectionLabel collapsed={collapsed}>TÀI CHÍNH</SectionLabel>
        <NavItem href="/finance?tab=revenue" icon={<CircleDollarSign size={20} />} label="Doanh thu" collapsed={collapsed} active={pathname === "/finance"} dataTestId="sidebar-nav-finance" />
        <NavItem href="/finance?tab=expense" icon={<Wallet size={20} />} label="Chi phí" collapsed={collapsed} />

        <SectionLabel collapsed={collapsed}>HỆ THỐNG</SectionLabel>
        <NavItem href="/settings?section=reports" icon={<FileBarChart size={20} />} label="Báo cáo" collapsed={collapsed} />
        {hasSettingsAccess && (
          <NavItem href="/settings" icon={<Settings size={20} />} label="Cài đặt" collapsed={collapsed} active={pathname === "/settings"} dataTestId="sidebar-nav-settings" />
        )}
        <NavItem href="/settings?section=audit" icon={<ClipboardList size={20} />} label="Nhật ký hoạt động" collapsed={collapsed} />
      </nav>

      <div className={`mt-4 px-[10px] pt-[14px] ${collapsed ? "flex flex-col items-center" : ""}`}>
        {!collapsed && (
          <div className="mb-5 rounded-[16px] border border-white/15 bg-gradient-to-br from-[#4a31aa]/95 to-[#291a66]/95 p-4 shadow-[0_18px_36px_rgba(15,22,51,0.28)]">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/15 text-white">
                <Rocket size={24} aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-[13px] font-black text-white">Nâng cấp trải nghiệm</h3>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-white/70">Khám phá các tính năng nâng cao cho quản lý bất động sản</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-white/25 bg-white/10 px-3 text-[12px] font-black text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Nâng cấp ngay <ChevronRight size={15} aria-hidden />
            </button>
          </div>
        )}

        <div className="mb-4 h-px bg-white/10" />
        <div className={`flex items-center gap-3 px-[14px] ${collapsed ? "justify-center px-0 flex-col" : ""}`}>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c4dff] to-[#4f46e5] text-[13px] font-black text-white ring-1 ring-white/20">
            SA
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0d1430] bg-emerald-400" aria-hidden />
          </div>
          {!collapsed && (
            <div className="whitespace-nowrap overflow-hidden flex-1">
              <div className="font-bold text-sm truncate text-white">{user?.fullName || "System Admin"}</div>
              <div className="text-[12px] font-medium text-white/60 truncate">Quản trị viên</div>
            </div>
          )}
          <button
            aria-label="Đăng xuất"
            data-testid="logout-button"
            onClick={handleLogout}
            className="text-white/60 hover:text-danger transition-colors p-1 rounded-md hover:bg-danger/10"
          >
            {collapsed ? <LogOut size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (collapsed) return <div className="h-px bg-white/10 my-4 mx-[14px]" />;
  return <div className="mt-6 mb-2 mx-[14px] text-[10px] font-bold uppercase tracking-wider text-white/50">{children}</div>;
}

function NavItem({ href, icon, label, collapsed, active, dataTestId }: NavItemProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-testid={dataTestId}
      aria-label={label}
      className={`flex items-center gap-[12px] px-[14px] py-[10px] rounded-[10px] font-semibold mb-1 transition-colors ${
        active
          ? "bg-gradient-to-r from-[#5b35f5] to-[#6d4cff] text-white shadow-[0_10px_24px_rgba(91,53,245,0.22)]"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-white" : ""}`}>
        {icon}
      </span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
