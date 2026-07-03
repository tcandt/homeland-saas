"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building, DollarSign, Inbox, Grid } from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth-store";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const hasFinanceAccess = mounted && (user?.permissions?.includes('finance.read') || user?.roles?.includes('ADMIN') || user?.roles?.includes('FINANCE') || user?.roles?.includes('MANAGER'));

  const isDashboard = pathname === "/";
  const isProperties = pathname === "/buildings" || pathname === "/rooms" || pathname === "/tenants";
  const isFinance = pathname === "/finance" || pathname === "/invoices" || pathname === "/deposits";
  const isTasks = pathname === "/tasks";
  const isMore = pathname === "/menu";

  const base = "flex flex-col items-center justify-center gap-1 no-underline transition-colors";

  return (
    <nav className={`fixed md:hidden left-0 right-0 bottom-0 pb-6 pt-2 bg-card border-t border-border shadow-[0_-10px_30px_rgba(15,23,42,0.05)] grid ${hasFinanceAccess ? 'grid-cols-5' : 'grid-cols-4'} z-40 rounded-t-3xl transition-colors w-auto max-w-full overflow-hidden`}>
      <Link href="/" className={`${base} ${isDashboard ? 'text-[#4f46e5]' : 'text-muted'}`}>
        <Home size={22} fill={isDashboard ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">Dashboard</span>
      </Link>
      <Link href="/buildings" className={`${base} ${isProperties ? 'text-[#4f46e5]' : 'text-muted'}`}>
        <Building size={22} fill={isProperties ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">Properties</span>
      </Link>
      {hasFinanceAccess && (
        <Link href="/finance" className={`${base} ${isFinance ? 'text-[#4f46e5]' : 'text-muted'}`} data-testid="finance-nav-link-mobile">
          <DollarSign size={22} fill={isFinance ? "currentColor" : "none"} />
          <span className="text-[10px] font-bold">Finances</span>
        </Link>
      )}
      <Link href="/tasks" className={`${base} ${isTasks ? 'text-[#4f46e5]' : 'text-muted'}`}>
        <Inbox size={22} fill={isTasks ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">Vận Hành</span>
      </Link>
      <Link href="/menu" className={`${base} ${isMore ? 'text-[#4f46e5]' : 'text-muted'}`}>
        <Grid size={22} fill={isMore ? "currentColor" : "none"} />
        <span className="text-[10px] font-bold">More</span>
      </Link>
    </nav>
  );
}
