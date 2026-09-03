"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Building,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  History,
  Home,
  LogOut,
  Receipt,
  Settings,
  User,
  Wallet,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth-store";
import BrandLogo, { HLEmblem } from "../ui/BrandLogo";
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

  const displayName = user?.fullName || "System Admin";
  const { src: avatarSrc, fallback: fallbackAvatarUrl } = getUserAvatar(user, displayName, user?.roles);
  const roleLabel = getRoleLabel(user?.roles);

  return (
    <aside
      data-testid="app-sidebar"
      className="h-full border-r-0 bg-card text-text shadow-[6px_0_24px_rgba(0,0,0,0.02)] dark:shadow-none p-[8px_0_16px_0] flex flex-col justify-between overflow-hidden transition-colors"
    >
      <nav className="flex-1 overflow-y-auto px-[10px] hide-scrollbar pt-1">
        <NavItem href="/" icon={<Home size={20} />} label="Tổng quan" collapsed={collapsed} active={pathname === "/"} />

        <SectionLabel collapsed={collapsed}>VẬN HÀNH</SectionLabel>
        <NavItem href="/summary" icon={<FileSpreadsheet size={20} />} label="Tổng hợp" collapsed={collapsed} active={pathname === "/summary" || pathname.startsWith("/summary")} />
        <NavItem href="/buildings" icon={<Building size={20} />} label="Tòa nhà" collapsed={collapsed} active={pathname.startsWith("/buildings")} />
        <NavItem href="/tenants" icon={<User size={20} />} label="Khách thuê" collapsed={collapsed} active={pathname === "/tenants"} />

        <SectionLabel collapsed={collapsed}>HỢP ĐỒNG</SectionLabel>
        <NavItem href="/contracts" icon={<FileText size={20} />} label="Hợp đồng" collapsed={collapsed} active={pathname === "/contracts"} />
        <NavItem href="/deposits" icon={<Bookmark size={20} />} label="Đặt cọc" collapsed={collapsed} active={pathname.startsWith("/deposits")} />
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
        <NavItem href="/activities" icon={<ClipboardList size={20} />} label="Nhật ký vận hành" collapsed={collapsed} active={pathname === "/activities" || pathname.startsWith("/activities")} />
      </nav>

      {/* Account & Logout Section - Always pinned to bottom */}
      <div className={`shrink-0 mt-auto pt-3 px-3 border-t border-border/60 dark:border-white/10 bg-card z-10 ${collapsed ? "flex flex-col items-center px-2" : ""}`}>
        {!collapsed ? (
          <div className="flex items-center gap-3 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border/50 dark:border-white/5 hover:border-border/80 transition-all duration-200">
            {/* Avatar with status indicator */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <img
                src={avatarSrc}
                alt={displayName}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackAvatarUrl;
                }}
                className="h-10 w-10 rounded-full border border-border/60 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 object-cover shadow-sm"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500 shadow-sm"
                aria-hidden
              />
            </div>

            {/* User Info */}
            <div className="whitespace-nowrap overflow-hidden flex-1 min-w-0">
              <div className="font-bold text-[13px] leading-tight truncate text-text" title={displayName}>
                {displayName}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                <span>{roleLabel}</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              aria-label="Đăng xuất"
              title="Đăng xuất"
              data-testid="logout-button"
              onClick={handleLogout}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 dark:hover:text-rose-400 dark:hover:bg-rose-500/20 transition-all duration-200 cursor-pointer group"
            >
              <LogOut size={16} className="transition-transform group-hover:scale-110" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 py-1 w-full">
            {/* Collapsed Avatar */}
            <div
              title={`${displayName} (${roleLabel})`}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center cursor-default"
            >
              <img
                src={avatarSrc}
                alt={displayName}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackAvatarUrl;
                }}
                className="h-10 w-10 rounded-full border border-border/60 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 object-cover shadow-sm"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500 shadow-sm"
                aria-hidden
              />
            </div>

            {/* Collapsed Logout Button */}
            <button
              type="button"
              aria-label="Đăng xuất"
              title="Đăng xuất"
              data-testid="logout-button"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/40 transition-all duration-200 cursor-pointer group shadow-sm"
            >
              <LogOut size={16} className="transition-transform group-hover:scale-110" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function getUserAvatar(user: any, displayName: string, roles?: string[]): { src: string; fallback: string } {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || "Admin")}&background=6366f1&color=fff&bold=true&rounded=true`;
  if (user?.avatarUrl) {
    return { src: user.avatarUrl, fallback };
  }

  const role = roles?.[0]?.toUpperCase() || "ADMIN";
  if (role === "ADMIN") {
    return {
      src: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName || "Admin")}&backgroundColor=6366f1,7c3aed`,
      fallback,
    };
  }
  if (role === "MANAGER") {
    return {
      src: `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(displayName || "Manager")}&backgroundColor=3b82f6,8b5cf6`,
      fallback,
    };
  }
  if (role === "SALES") {
    return {
      src: `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(displayName || "Sales")}&backgroundColor=10b981,06b6d4`,
      fallback,
    };
  }
  if (role === "FINANCE") {
    return {
      src: `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(displayName || "Finance")}&backgroundColor=f59e0b,ef4444`,
      fallback,
    };
  }
  return {
    src: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName || "User")}&backgroundColor=6366f1`,
    fallback,
  };
}

function getRoleLabel(roles?: string[]): string {
  if (!roles || roles.length === 0) return "Quản trị viên";
  if (roles.includes("ADMIN")) return "Quản trị viên";
  if (roles.includes("MANAGER")) return "Quản lý";
  if (roles.includes("SALES")) return "Kinh doanh";
  if (roles.includes("FINANCE")) return "Kế toán";
  return roles[0];
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
