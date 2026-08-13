"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building, DollarSign, FileText, Grid, Plus, X, Receipt, UserPlus, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth-store";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const hasFinanceAccess = mounted && (user?.permissions?.includes('finance.read') || user?.roles?.includes('ADMIN') || user?.roles?.includes('FINANCE') || user?.roles?.includes('MANAGER'));

  const isDashboard = pathname === "/";
  const isProperties = pathname === "/buildings" || pathname === "/tenants";
  const isFinance = pathname.startsWith("/finance") || pathname === "/invoices";
  const isContracts = pathname === "/contracts";
  const isMore = pathname === "/menu";

  const base = "flex flex-col items-center justify-center gap-1 no-underline transition-all duration-200 w-full h-full pt-1.5";

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      {/* Backdrop blur overlay for Quick Actions menu */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9985] animate-in fade-in duration-200"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Quick Actions Sheet (Floats beautifully right above the bottom nav bar) */}
      {isMenuOpen && (
        <div className="fixed bottom-[84px] left-4 right-4 bg-card rounded-[24px] p-5 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] z-[9986] border border-border/50 animate-in slide-in-from-bottom duration-200">
          {/* Close button at top right */}
          <button 
            onClick={() => setIsMenuOpen(false)}
            aria-label="Đóng"
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center text-muted hover:text-text active:scale-95 transition-transform"
          >
            <X size={12} />
          </button>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <Link 
              href="/contracts" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-2.5 bg-[#8b5cf6]/5 border border-[#8b5cf6]/10 rounded-2xl active:scale-[0.98] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-[#8b5cf6]" />
              </div>
              <div className="text-left">
                <div className="text-[12px] font-black text-text">Tạo Hợp đồng</div>
                <span className="text-[9px] font-bold text-muted">Ký mới</span>
              </div>
            </Link>

            <Link 
              href="/invoices" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-2.5 bg-[#f43f5e]/5 border border-[#f43f5e]/10 rounded-2xl active:scale-[0.98] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-[#f43f5e]/10 flex items-center justify-center shrink-0">
                <Receipt size={18} className="text-[#f43f5e]" />
              </div>
              <div className="text-left">
                <div className="text-[12px] font-black text-text">Tạo Hóa đơn</div>
                <span className="text-[9px] font-bold text-muted">Hóa đơn mới</span>
              </div>
            </Link>

            <Link 
              href="/tenants" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-2.5 bg-[#3b82f6]/5 border border-[#3b82f6]/10 rounded-2xl active:scale-[0.98] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
                <UserPlus size={18} className="text-[#3b82f6]" />
              </div>
              <div className="text-left">
                <div className="text-[12px] font-black text-text">Thêm Khách</div>
                <span className="text-[9px] font-bold text-muted">Khách thuê mới</span>
              </div>
            </Link>

            <Link 
              href="/buildings" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-2.5 bg-[#6366f1]/5 border border-[#6366f1]/10 rounded-2xl active:scale-[0.98] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-[#6366f1]/10 flex items-center justify-center shrink-0">
                <Building size={18} className="text-[#6366f1]" />
              </div>
              <div className="text-left">
                <div className="text-[13px] font-black text-text">Thêm Tòa nhà</div>
                <span className="text-[9px] font-bold text-muted">Khai báo tòa nhà</span>
              </div>
            </Link>

            {hasFinanceAccess && (
              <Link 
                href="/finance" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 p-2.5 bg-[#eab308]/5 border border-[#eab308]/10 rounded-2xl active:scale-[0.98] transition-transform col-span-2 justify-center"
              >
                <div className="w-9 h-9 rounded-xl bg-[#eab308]/10 flex items-center justify-center shrink-0">
                  <TrendingUp size={18} className="text-[#eab308]" />
                </div>
                <div className="text-left">
                  <div className="text-[12px] font-black text-text">Báo cáo Tài chính</div>
                  <span className="text-[9px] font-bold text-muted">Xem nhanh doanh thu, công nợ</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Symmetrical Bottom Tabbar with soft rounded top corners */}
      <nav className="fixed md:hidden left-0 right-0 bottom-0 h-[72px] bg-card border-t border-border/50 shadow-[0_-8px_25px_rgba(0,0,0,0.05)] z-[9990] rounded-t-[24px] flex items-center px-1 pb-safe overflow-visible">
        
        {/* 5-Column Grid */}
        <div className="w-full h-full grid grid-cols-5 items-center relative z-[9980]">
          {/* Tab 1: Home (Dashboard) */}
          <Link href="/" prefetch={false} className={`${base} ${isDashboard ? 'text-[#8b5cf6]' : 'text-muted hover:text-text'}`}>
            <Home size={20} fill={isDashboard ? "currentColor" : "none"} className="transition-transform duration-200" />
            <span className="text-[9px] font-bold tracking-tight">Home</span>
          </Link>

          {/* Tab 2: Properties */}
          <Link href="/buildings" prefetch={false} className={`${base} ${isProperties ? 'text-[#8b5cf6]' : 'text-muted hover:text-text'}`}>
            <Building size={20} fill={isProperties ? "currentColor" : "none"} className="transition-transform duration-200" />
            <span className="text-[9px] font-bold tracking-tight">Properties</span>
          </Link>

          {/* Tab 3: Center Plus Action Button (30% larger, positioned slightly protruding -top-[6px]) */}
          <div className="flex items-center justify-center h-full relative z-[9981]">
            <button 
              onClick={toggleMenu}
              aria-label="Thêm mới"
              className={`absolute -top-[6px] left-1/2 -translate-x-1/2 w-[58px] h-[58px] rounded-full bg-gradient-to-tr from-[#8b5cf6] to-[#6366f1] text-white flex items-center justify-center shadow-[0_4px_15px_rgba(139,92,246,0.35)] active:scale-95 transition-all duration-200 z-[9991] ${isMenuOpen ? 'rotate-[135deg]' : ''}`}
            >
              <Plus size={26} className="transition-transform duration-200" />
            </button>
          </div>

          {/* Tab 4: Finances (if hasFinanceAccess) OR Contracts (if not hasFinanceAccess) */}
          {hasFinanceAccess ? (
            <Link href="/finance" prefetch={false} className={`${base} ${isFinance ? 'text-[#8b5cf6]' : 'text-muted'}`} data-testid="finance-nav-link-mobile">
              <DollarSign size={20} fill={isFinance ? "currentColor" : "none"} className="transition-transform duration-200" />
              <span className="text-[9px] font-bold tracking-tight">Finances</span>
            </Link>
          ) : (
            <Link href="/contracts" prefetch={false} className={`${base} ${isContracts ? 'text-[#8b5cf6]' : 'text-muted'}`}>
              <FileText size={20} fill={isContracts ? "currentColor" : "none"} className="transition-transform duration-200" />
              <span className="text-[9px] font-bold tracking-tight">Contracts</span>
            </Link>
          )}

          {/* Tab 5: More */}
          <Link href="/menu" prefetch={false} className={`${base} ${isMore ? 'text-[#8b5cf6]' : 'text-muted hover:text-text'}`}>
            <Grid size={20} fill={isMore ? "currentColor" : "none"} className="transition-transform duration-200" />
            <span className="text-[9px] font-bold tracking-tight">More</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
