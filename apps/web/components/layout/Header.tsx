"use client";

import React from "react";
import { Search, Moon, Sun, Bell, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth/auth-store";

interface HeaderProps {
  onToggleSidebar: () => void;
}

const routeMeta: Record<string, { title: string; subtitle: string; mobileSubtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Tổng quan hoạt động hôm nay",
    mobileSubtitle: "Chào mừng trở lại, Văn Thể Phan 👋",
  },
  "/buildings": {
    title: "Tòa nhà & Dự án",
    subtitle: "Quản lý tổng quan toàn bộ tòa nhà",
    mobileSubtitle: "Danh sách tòa nhà và tình trạng phòng",
  },
  "/rooms": {
    title: "Danh sách phòng",
    subtitle: "Theo dõi trạng thái phòng theo thời gian thực",
    mobileSubtitle: "Tìm phòng, trạng thái và nhu cầu xử lý",
  },
  "/tenants": {
    title: "Khách thuê",
    subtitle: "Quản lý khách thuê, công nợ và hợp đồng",
    mobileSubtitle: "Danh sách khách thuê và tình trạng công nợ",
  },
  "/contracts": {
    title: "Hợp đồng",
    subtitle: "Theo dõi vòng đời hợp đồng và hạn gia hạn",
    mobileSubtitle: "Hợp đồng đang hiệu lực và sắp hết hạn",
  },
  "/deposits": {
    title: "Phiếu cọc",
    subtitle: "Quản lý phiếu cọc, giữ chỗ và hoàn trả",
    mobileSubtitle: "Phiếu cọc đang giữ và cần xử lý",
  },
  "/finance": {
    title: "Tài chính & Báo cáo",
    subtitle: "Theo dõi dòng tiền, doanh thu và chi phí",
    mobileSubtitle: "Biểu đồ thu chi và báo cáo tài chính",
  },
  "/invoices": {
    title: "Hóa đơn",
    subtitle: "Quản lý hóa đơn thu tiền và trạng thái thanh toán",
    mobileSubtitle: "Hóa đơn đã phát hành và quá hạn",
  },
  "/sales": {
    title: "Sales CRM",
    subtitle: "Theo dõi pipeline tư vấn và chốt phòng",
    mobileSubtitle: "Pipeline khách hàng mới và lịch xem phòng",
  },
  "/tasks": {
    title: "Công việc",
    subtitle: "Quản lý bảo trì, xử lý và vận hành hằng ngày",
    mobileSubtitle: "Công việc cần xử lý ngay hôm nay",
  },
  "/settings": {
    title: "Cài đặt",
    subtitle: "Tùy chỉnh giao diện, thông báo và hệ thống",
    mobileSubtitle: "Thiết lập cá nhân và hệ thống",
  },
  "/menu": {
    title: "Menu",
    subtitle: "Truy cập nhanh toàn bộ phân hệ",
    mobileSubtitle: "Điều hướng nhanh đến các khu vực chính",
  },
};

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const current = routeMeta[pathname] ?? routeMeta["/"];
  const [mounted, setMounted] = useState(false);
  const { user } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    
    // Fallback Fetch
    const fetchInitialCount = async () => {
       const token = localStorage.getItem('token');
       console.log('[Header] Token present? ' + !!token);
       if(!token) return;
        try {
         const res = await fetch('/api/v1/notifications/unread-count', {
           headers: { Authorization: `Bearer ${token}` }
         });
         if (res.ok) {
           const data = await res.json();
           console.log('[Header] Fetched unread count:', data);
           setUnreadCount(data.count || data.data?.count || 0);
         } else {
           console.error('[Header] Fetch failed:', res.status);
         }
        } catch(e) {
           console.error('[Header] Fetch error', e);
        }
    };
    
    fetchInitialCount();

    // SSE connection
    const token = localStorage.getItem('token');
    const sse = new EventSource(`/api/v1/notifications/stream?token=${token}`);
    
    sse.onmessage = (event) => {
       try {
         const data = JSON.parse(event.data);
         if (data && data.count !== undefined) {
            setUnreadCount(data.count);
         }
       } catch (e) {}
    };

    sse.onerror = () => {
       console.error('SSE Error, falling back to polling');
       sse.close();
       // Polling fallback every 30s
       const interval = setInterval(fetchInitialCount, 30000);
       return () => clearInterval(interval);
    };

    return () => sse.close();
  }, []);

  const getMobileSubtitle = () => {
    if (pathname === "/") {
      return `Chào mừng trở lại, ${user?.fullName || "User"} 👋`;
    }
    return current.mobileSubtitle;
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header data-testid="app-header" className="fixed top-0 left-0 right-0 md:sticky md:top-0 bg-background md:bg-card border-b-0 md:border-b border-border flex flex-col md:flex-row md:items-center gap-[16px] px-[16px] pt-[20px] pb-[20px] md:px-[28px] md:h-[80px] md:py-0 z-50 transition-colors w-full box-border">
      <div className="flex justify-between items-start md:items-center w-full md:w-auto md:min-w-[210px] gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            aria-label="Mở menu"
            className="hidden md:flex w-[40px] h-[40px] text-text items-center justify-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="hidden md:block">
            <h1 className="m-0 text-[20px] font-black text-text">{current.title}</h1>
            <p className="m-0 mt-1 text-muted text-[13px] font-medium">{current.subtitle}</p>
          </div>

          <div className="md:hidden pt-1 shrink min-w-0 overflow-hidden pr-2">
            <h1 className="m-0 text-[24px] leading-[28px] font-[800] tracking-tight truncate w-full">
              <span className="text-[#22c55e]">HomeLand</span>
              <span className="text-text ml-[3px]">Premium</span>
            </h1>
            <p className="m-0 mt-[4px] text-[#64748b] text-[14px] leading-[20px] font-medium truncate w-full">{getMobileSubtitle()}</p>
          </div>
        </div>

        <div className="flex md:hidden gap-[8px] relative pt-1 shrink-0">
          <button
            onClick={toggleTheme}
            aria-label="Đổi giao diện"
            className="w-[40px] h-[40px] bg-card border border-border/50 text-text rounded-full flex items-center justify-center cursor-pointer shadow-sm transition-colors shrink-0"
          >
            {mounted ? (theme === "dark" ? <Sun size={20} /> : <Moon size={20} />) : <div className="w-[20px] h-[20px]" />}
          </button>
          <a href="/notifications" aria-label="Thông báo" className="w-[40px] h-[40px] bg-card border border-border/50 text-text rounded-full flex items-center justify-center cursor-pointer relative shadow-sm transition-colors shrink-0">
            <Bell size={20} />
            {unreadCount > 0 && (
               <span className="absolute -top-[2px] -right-[2px] bg-[#ef4444] text-white text-[10px] w-[16px] h-[16px] flex items-center justify-center rounded-full font-bold border-2 border-card">{unreadCount}</span>
            )}
          </a>
        </div>
      </div>

      <div className="hidden md:flex flex-1 max-w-[600px] h-[44px] bg-black/5 dark:bg-white/5 border border-border rounded-[12px] items-center gap-[10px] px-[16px] transition-colors">
        <Search size={18} className="text-muted" />
        <input
          placeholder="Tìm phòng, khách thuê, hợp đồng, hóa đơn..."
          className="border-0 outline-none bg-transparent w-full text-text placeholder:text-muted font-medium text-[14px]"
        />
        <div className="text-muted bg-card border border-border rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors">⌘K</div>
      </div>

      <div className="ml-auto hidden md:flex gap-[12px] relative">
        <button
          onClick={toggleTheme}
          aria-label="Đổi giao diện"
          className="w-[42px] h-[42px] border border-border bg-card hover:bg-black/5 dark:hover:bg-white/5 text-text rounded-full flex items-center justify-center cursor-pointer transition-colors"
        >
          {mounted ? (theme === "dark" ? <Sun size={18} /> : <Moon size={18} />) : <div className="w-[18px] h-[18px]" />}
        </button>
        <a href="/notifications" aria-label="Thông báo" className="w-[42px] h-[42px] border border-border bg-card hover:bg-black/5 dark:hover:bg-white/5 text-text rounded-full flex items-center justify-center cursor-pointer relative transition-colors">
          <Bell size={18} />
          {unreadCount > 0 && (
             <span className="absolute -top-[2px] -right-[2px] bg-[#ef4444] text-white text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold border-2 border-card">{unreadCount}</span>
          )}
        </a>
      </div>
    </header>
  );
}
