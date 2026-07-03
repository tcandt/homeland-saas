"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Building, User, FileText, Wallet, Receipt, BarChart, PieChart, Settings, LayoutDashboard, Inbox, LogOut, Zap } from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth-store";

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const { user, clearSession } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const hasFinanceAccess = mounted && (user?.permissions?.includes('finance.read') || user?.roles?.includes('ADMIN') || user?.roles?.includes('FINANCE') || user?.roles?.includes('MANAGER'));
  const hasSettingsAccess = mounted && (user?.permissions?.includes('setting.read') || user?.roles?.includes('ADMIN'));

  const handleLogout = () => {
    clearSession();
    window.location.href = "/login";
  };

  return (
    <aside data-testid="app-sidebar" className="h-full bg-card dark:bg-slate-900 border-r border-border p-[24px_0] flex flex-col overflow-y-auto hide-scrollbar">
      {/* Brand */}
      <div className={`flex items-center gap-3 px-[20px] mb-8 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-[42px] h-[42px] rounded-[12px] bg-gradient-to-br from-[#4f46e5] to-[#8b5cf6] text-white flex items-center justify-center text-xl shrink-0">
          <Home size={22} fill="currentColor" />
        </div>
        {!collapsed && (
          <div className="whitespace-nowrap overflow-hidden">
            <div className="text-[20px] font-black text-text tracking-tight">HomeLand</div>
            <div className="text-[12px] font-semibold text-muted">Premium CRM</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-[10px]">
        <NavItem href="/" icon={<LayoutDashboard size={20} />} label="Dashboard" collapsed={collapsed} active={pathname === "/"} />

        {!collapsed && <div className="mt-6 mb-2 mx-[14px] text-[10px] font-bold text-muted uppercase tracking-wider">OPERATIONS</div>}
        {collapsed && <div className="h-px bg-border my-4 mx-[14px]"></div>}
        
        <NavItem href="/buildings" icon={<Building size={20} />} label="Tòa nhà" collapsed={collapsed} active={pathname === "/buildings"} />
        <NavItem href="/rooms" icon={<Home size={20} />} label="Phòng" collapsed={collapsed} active={pathname === "/rooms"} />
        <NavItem href="/tenants" icon={<User size={20} />} label="Khách thuê" collapsed={collapsed} active={pathname === "/tenants"} />

        {!collapsed && <div className="mt-6 mb-2 mx-[14px] text-[10px] font-bold text-muted uppercase tracking-wider">CONTRACTS</div>}
        {collapsed && <div className="h-px bg-border my-4 mx-[14px]"></div>}

        <NavItem href="/tasks" icon={<Inbox size={20} />} label="Vận Hành" collapsed={collapsed} active={pathname === "/tasks"} />
        <NavItem href="/contracts" icon={<FileText size={20} />} label="Hợp đồng" collapsed={collapsed} active={pathname === "/contracts"} />
        <NavItem href="/deposits" icon={<Wallet size={20} />} label="Đặt cọc" collapsed={collapsed} active={pathname === "/deposits"} />
        <NavItem href="/invoices" icon={<Receipt size={20} />} label="Hóa đơn" collapsed={collapsed} active={pathname === "/invoices"} />

        {hasFinanceAccess && !collapsed && <div className="mt-6 mb-2 mx-[14px] text-[10px] font-bold text-muted uppercase tracking-wider">FINANCE</div>}
        {hasFinanceAccess && collapsed && <div className="h-px bg-border my-4 mx-[14px]"></div>}

        {hasFinanceAccess && <NavItem href="/finance" icon={<PieChart size={20} />} label="Tài chính & Báo cáo" collapsed={collapsed} active={pathname === "/finance"} dataTestId="sidebar-nav-finance" />}
        {hasFinanceAccess && <NavItem href="/documents" icon={<FileText size={20} />} label="Tài liệu & Ký số" collapsed={collapsed} active={pathname === "/documents"} />}
        {hasFinanceAccess && <NavItem href="/ai" icon={<Zap size={20} className="text-[#6366f1]" />} label="AI Command Center" collapsed={collapsed} active={pathname === "/ai"} />}

        {!collapsed && <div className="mt-6 mb-2 mx-[14px] text-[10px] font-bold text-muted uppercase tracking-wider">SALES</div>}
        {collapsed && <div className="h-px bg-border my-4 mx-[14px]"></div>}

        <NavItem href="/sales" icon={<BarChart size={20} />} label="Sales CRM" collapsed={collapsed} active={pathname === "/sales"} />
      </nav>

      {/* Footer */}
      <div className={`mt-4 px-[10px] pt-[14px] ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {hasSettingsAccess && (
          <NavItem href="/settings" icon={<Settings size={20} />} label="Cài đặt" collapsed={collapsed} active={pathname === "/settings"} dataTestId="sidebar-nav-settings" />
        )}
        <div className={`flex items-center gap-3 mt-4 px-[14px] ${collapsed ? 'justify-center px-0 flex-col' : ''}`}>
          <img src="https://i.pravatar.cc/100?img=11" alt="Avatar" width="40" height="40" className="w-[40px] h-[40px] rounded-full shrink-0 border border-border object-cover" />
          {!collapsed && (
            <div className="whitespace-nowrap overflow-hidden flex-1">
              <div className="font-bold text-text text-sm truncate">{user?.fullName || "User"}</div>
              <div className="text-[12px] font-medium text-muted truncate">{user?.roles?.[0] || "Admin"}</div>
            </div>
          )}
          <button aria-label="Đăng xuất" data-testid="logout-button" onClick={handleLogout} className="text-muted hover:text-danger transition-colors p-1 rounded-md hover:bg-danger/10">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, collapsed, active, dataTestId }: { href: string; icon: React.ReactNode; label: string; collapsed: boolean; active?: boolean; dataTestId?: string }) {
  return (
    <Link 
      href={href} 
      data-testid={dataTestId}
      aria-label={label} 
      className={`flex items-center gap-[12px] px-[14px] py-[10px] rounded-[10px] font-semibold mb-1 transition-colors ${
        active 
          ? "bg-[#4f46e5]/10 text-[#4f46e5]" 
          : "text-muted hover:bg-black/5 dark:hover:bg-white/5 dark:hover:bg-slate-800 hover:text-text"
      }`}
    >
      <span className={`shrink-0 ${active ? "text-[#4f46e5]" : ""}`}>
        {active ? React.cloneElement(icon as React.ReactElement, { fill: "currentColor" }) : icon}
      </span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
