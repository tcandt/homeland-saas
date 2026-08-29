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
  History,
  Home,
  LogOut,
  PlugZap,
  Receipt,
  Rocket,
  Settings,
  User,
  Wallet,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth-store";
import webPackage from "../../package.json";

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
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || webPackage.version;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const hasSettingsAccess = mounted && (user?.roles?.includes("ADMIN") || user?.permissions?.includes("setting.read"));

  const handleLogout = () => {
    clearSession();
    window.location.href = "/login";
  };

  return (
    <aside
      data-testid="app-sidebar"
      className="h-full border-r border-border/40 dark:border-border/30 bg-card text-text shadow-[12px_0_36px_rgba(0,0,0,0.03)] dark:shadow-none p-[24px_0] flex flex-col overflow-y-auto hide-scrollbar transition-colors"
    >
      <div className={`flex items-center gap-3 px-[20px] mb-8 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-[42px] h-[42px] rounded-[12px] bg-gradient-to-br from-[#6956ff] to-[#7c3aed] text-white flex items-center justify-center text-xl shrink-0 shadow-[0_14px_28px_rgba(105,86,255,0.32)]">
          <Home size={22} fill="currentColor" />
        </div>
        {!collapsed && (
          <div className="whitespace-nowrap overflow-hidden">
            <div className="text-[20px] font-black tracking-tight text-text">HomeLand</div>
            <div className="font-mono text-[12px] font-semibold text-muted">v{appVersion}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-[10px]">
        <NavItem href="/" icon={<Home size={20} />} label="Tổng quan" collapsed={collapsed} active={pathname === "/"} />

        <SectionLabel collapsed={collapsed}>VẬN HÀNH</SectionLabel>
        <NavItem href="/buildings" icon={<Building size={20} />} label="Tòa nhà" collapsed={collapsed} active={pathname.startsWith("/buildings")} />
        <NavItem href="/tenants" icon={<User size={20} />} label="Khách thuê" collapsed={collapsed} active={pathname === "/tenants"} />
        <NavItem href="/electricity" icon={<PlugZap size={20} />} label="Công tơ điện" collapsed={collapsed} active={pathname === "/electricity"} />

        <SectionLabel collapsed={collapsed}>HỢP ĐỒNG</SectionLabel>
        <NavItem href="/contracts" icon={<FileText size={20} />} label="Hợp đồng" collapsed={collapsed} active={pathname === "/contracts"} />
        <NavItem href="/invoices" icon={<Receipt size={20} />} label="Hóa đơn" collapsed={collapsed} active={pathname === "/invoices"} />

        <SectionLabel collapsed={collapsed}>TÀI CHÍNH</SectionLabel>
        <NavItem href="/finance" icon={<CircleDollarSign size={20} />} label="Doanh thu" collapsed={collapsed} active={pathname === "/finance"} dataTestId="sidebar-nav-finance" />
        <NavItem href="/finance/expenses" icon={<Wallet size={20} />} label="Chi phí" collapsed={collapsed} active={pathname === "/finance/expenses"} />
        <NavItem href="/finance/transactions" icon={<History size={20} />} label="Lịch sử giao dịch" collapsed={collapsed} active={pathname === "/finance/transactions"} />

        <SectionLabel collapsed={collapsed}>HỆ THỐNG</SectionLabel>
        <NavItem href="/reports" icon={<FileBarChart size={20} />} label="Báo cáo" collapsed={collapsed} active={pathname === "/reports"} />
        {hasSettingsAccess && (
          <NavItem href="/settings" icon={<Settings size={20} />} label="Cài đặt" collapsed={collapsed} active={pathname === "/settings"} dataTestId="sidebar-nav-settings" />
        )}
        <NavItem href="/settings?section=audit" icon={<ClipboardList size={20} />} label="Nhật ký hoạt động" collapsed={collapsed} />
      </nav>

      <div className={`mt-4 px-[10px] pt-[14px] ${collapsed ? "flex flex-col items-center" : ""}`}>
        <div className="mb-4 h-px bg-border/60 dark:bg-white/10" />
        <div className={`flex items-center gap-3 px-[14px] ${collapsed ? "justify-center px-0 flex-col" : ""}`}>
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c4dff] to-[#4f46e5] text-[13px] font-black text-white ring-1 ring-white/20">
            SA
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background dark:border-[#0f172a] bg-emerald-400" aria-hidden />
          </div>
          {!collapsed && (
            <div className="whitespace-nowrap overflow-hidden flex-1">
              <div className="font-bold text-sm truncate text-text">{user?.fullName || "System Admin"}</div>
              <div className="text-[12px] font-medium text-muted truncate">Quản trị viên</div>
            </div>
          )}
          <button
            aria-label="Đăng xuất"
            data-testid="logout-button"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-danger dark:text-white/60 dark:hover:text-danger transition-colors p-1 rounded-md hover:bg-danger/10"
          >
            {collapsed ? <LogOut size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (collapsed) return <div className="h-px bg-border/60 dark:bg-white/10 my-4 mx-[14px]" />;
  return <div className="mt-6 mb-2 mx-[14px] text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 dark:text-white/40">{children}</div>;
}

function NavItem({ href, icon, label, collapsed, active, dataTestId }: NavItemProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-testid={dataTestId}
      aria-label={label}
      className={`flex items-center gap-[12px] px-[14px] py-[10px] rounded-[10px] font-semibold mb-1 transition-all ${active
        ? "bg-primary text-white shadow-[0_10px_24px_rgba(91,53,245,0.22)]"
        : "text-muted-foreground hover:bg-black/5 hover:text-text dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
        }`}
    >
      <span className={`shrink-0 ${active ? "text-white" : ""}`}>
        {icon}
      </span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
