"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Moon, Sun, Bell, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useCurrentUserQuery } from "@/lib/queries/auth.queries";
import { useSettingsSectionQuery } from "@/lib/queries/settings.queries";
import { consumeServerSentEvents } from "@/lib/server-sent-events";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  onToggleSidebar: () => void;
}

const routeMeta: Record<string, { title: string; subtitle: string; mobileSubtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Tổng quan hoạt động hôm nay",
    mobileSubtitle: "Chào mừng trở lại",
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
    subtitle: "Theo dõi dòng tiền vào, doanh thu và công nợ",
    mobileSubtitle: "Doanh thu, công nợ và dòng tiền vào",
  },
  "/finance/expenses": {
    title: "Chi phí",
    subtitle: "Quản lý chi phí vận hành, duyệt chi và khấu trừ owner",
    mobileSubtitle: "Chi phí vận hành và duyệt chi",
  },
  "/finance/transactions": {
    title: "Lịch sử giao dịch",
    subtitle: "Toàn bộ tiền vào/ra của các tài khoản ngân hàng",
    mobileSubtitle: "Lịch sử giao dịch ngân hàng",
  },
  "/invoices": {
    title: "Hóa đơn",
    subtitle: "Quản lý hóa đơn thu tiền và trạng thái thanh toán",
    mobileSubtitle: "Hóa đơn đã phát hành và quá hạn",
  },
  "/reports": {
    title: "Báo cáo",
    subtitle: "Tổng hợp báo cáo vận hành, tài chính và hiệu suất",
    mobileSubtitle: "Báo cáo vận hành và tài chính",
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
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const current = pathname.startsWith("/buildings") ? routeMeta["/buildings"] : routeMeta[pathname] ?? routeMeta["/"];
  const [mounted, setMounted] = useState(false);
  const [dropdownMounted, setDropdownMounted] = useState(false);
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data: currentUser } = useCurrentUserQuery(accessToken);
  const { data: profileSection } = useSettingsSectionQuery<{ fullName?: string }>("profile", "USER", Boolean(accessToken));
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationMenuPosition, setNotificationMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);

  const fetchNotifications = async (url: string) => {
    if (!accessToken) return [];
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Unable to load notifications.");
    return res.json();
  };

  const { data: notificationList, mutate: mutateNotifications } = useSWR(
    accessToken ? "/api/v1/notifications" : null,
    fetchNotifications,
    { revalidateOnFocus: false, refreshInterval: 30000 },
  );
  const recentNotifications = Array.isArray(notificationList?.data)
    ? notificationList.data.slice(0, 5)
    : Array.isArray(notificationList)
      ? notificationList.slice(0, 5)
      : [];

  useEffect(() => {
    setMounted(true);
    setDropdownMounted(true);
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    const fetchInitialCount = async () => {
      try {
        const res = await fetch("/api/v1/notifications/unread-count", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count || data.data?.count || 0);
        }
      } catch (error) {
        console.error("[Header] Fetch unread count failed:", error);
      }
    };

    fetchInitialCount();

    const handleSseData = (rawData: string) => {
      try {
        const data = JSON.parse(rawData);
        if (data && data.count !== undefined) {
          setUnreadCount(data.count);
        }
      } catch {
        // ignore malformed events
      }
    };

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
    const streamController = new AbortController();
    void fetch(`${apiUrl}/notifications/stream`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: streamController.signal,
    }).then(async (response) => {
      if (response.ok) {
        await consumeServerSentEvents(response, handleSseData);
      }
    }).catch((error) => {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("[Header] Notification stream failed:", error);
      }
    });

    const pollingFallback = window.setInterval(fetchInitialCount, 30000);

    return () => {
      streamController.abort();
      window.clearInterval(pollingFallback);
    };
  }, [accessToken]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!notificationsOpen) return;
      const target = event.target as Node | null;
      if (notificationButtonRef.current && target && notificationButtonRef.current.contains(target)) return;
      if (notificationMenuRef.current && target && notificationMenuRef.current.contains(target)) return;
      setNotificationsOpen(false);
      setNotificationMenuPosition(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const closeMenu = () => {
      setNotificationsOpen(false);
      setNotificationMenuPosition(null);
    };

    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [notificationsOpen]);

  const getDisplayName = () => {
    const profileName = (profileSection?.value as any)?.fullName?.trim?.() || "";
    return profileName || currentUser?.fullName || user?.fullName || "System Admin";
  };

  const getMobileSubtitle = () => {
    if (pathname === "/") {
      return `Chào mừng trở lại, ${getDisplayName()} 👋`;
    }
    return current.mobileSubtitle;
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const openNotificationsMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setNotificationMenuPosition({
      top: rect.bottom + 10,
      right: Math.max(12, window.innerWidth - rect.right),
    });
    setNotificationsOpen((currentValue) => !currentValue);
  };

  const closeNotificationsMenu = () => {
    setNotificationsOpen(false);
    setNotificationMenuPosition(null);
  };

  const formatNotificationTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  const unreadBadgeCount = useMemo(() => unreadCount > 99 ? "99+" : String(unreadCount), [unreadCount]);

  return (
    <header
      data-testid="app-header"
      className="fixed top-0 left-0 right-0 md:sticky md:top-0 bg-background md:bg-card border-b-0 md:border-b border-border flex flex-col md:flex-row md:items-center gap-[16px] px-[16px] pt-[20px] pb-[20px] md:px-[28px] md:h-[80px] md:py-0 z-50 transition-colors w-full box-border"
    >
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
            <p className="m-0 mt-1 text-muted text-[13px] font-medium">
              {pathname === "/" ? `Chào mừng trở lại, ${getDisplayName()} 👋` : current.subtitle}
            </p>
          </div>

          <div className="md:hidden pt-1 shrink min-w-0 overflow-hidden pr-2">
            <h1 className="m-0 text-[24px] leading-[28px] font-[800] tracking-tight truncate w-full">
              <span className="text-[#22c55e]">HomeLand</span>
              <span className="text-text ml-[3px]">Premium</span>
            </h1>
            <p className="m-0 mt-[4px] text-[#64748b] text-[14px] leading-[20px] font-medium truncate w-full">
              {getMobileSubtitle()}
            </p>
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
          <button
            ref={notificationButtonRef}
            type="button"
            onClick={openNotificationsMenu}
            aria-label="Thông báo"
            aria-expanded={notificationsOpen}
            className="w-[40px] h-[40px] bg-card border border-border/50 text-text rounded-full flex items-center justify-center cursor-pointer relative shadow-sm transition-colors shrink-0"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-[2px] -right-[2px] bg-[#ef4444] text-white text-[10px] w-[16px] h-[16px] flex items-center justify-center rounded-full font-bold border-2 border-card">
                {unreadBadgeCount}
              </span>
            )}
          </button>
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
        <button
          ref={notificationButtonRef}
          type="button"
          onClick={openNotificationsMenu}
          aria-label="Thông báo"
          aria-expanded={notificationsOpen}
          className="w-[42px] h-[42px] border border-border bg-card hover:bg-black/5 dark:hover:bg-white/5 text-text rounded-full flex items-center justify-center cursor-pointer relative transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-[2px] -right-[2px] bg-[#ef4444] text-white text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold border-2 border-card">
              {unreadBadgeCount}
            </span>
          )}
        </button>
      </div>

      {dropdownMounted && notificationsOpen && notificationMenuPosition && createPortal(
        <div className="fixed inset-0 z-[10040] pointer-events-none">
          <div
            ref={notificationMenuRef}
            className="pointer-events-auto fixed w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[12px] border border-border bg-card shadow-2xl"
            style={{
              top: `${notificationMenuPosition.top}px`,
              right: `${notificationMenuPosition.right}px`,
            }}
          >
            <div className="flex items-center justify-between border-b border-border px-[14px] py-[12px]">
              <div>
                <div className="text-[13px] font-black text-text">Thông báo</div>
                <div className="mt-[2px] text-[11px] font-medium text-muted">
                  {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Không có thông báo mới"}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-[30px] px-[10px] text-[12px]"
                onClick={async () => {
                  if (!accessToken) return;
                  await fetch("/api/v1/notifications/read-all", {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  setUnreadCount(0);
                  await mutateNotifications();
                }}
              >
                Đánh dấu đã đọc
              </Button>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {recentNotifications.length > 0 ? recentNotifications.map((item: any) => {
                const isUnread = item.status !== "READ";
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`block w-full border-b border-border px-[14px] py-[12px] text-left transition hover:bg-background last:border-b-0 ${isUnread ? "bg-primary/5" : ""}`}
                    onClick={async () => {
                      if (isUnread && accessToken) {
                        await fetch(`/api/v1/notifications/${item.id}/read`, {
                          method: "PATCH",
                          headers: { Authorization: `Bearer ${accessToken}` },
                        });
                        setUnreadCount((currentValue) => Math.max(0, currentValue - 1));
                        void mutateNotifications();
                      }
                      closeNotificationsMenu();
                      router.push("/notifications");
                    }}
                  >
                    <div className="flex items-start gap-[10px]">
                      <span className={`mt-[4px] h-[8px] w-[8px] shrink-0 rounded-full ${isUnread ? "bg-primary" : "bg-border"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-[10px]">
                          <div className={`min-w-0 text-[12px] font-black ${isUnread ? "text-text" : "text-muted"}`}>
                            {item.title || "Thông báo"}
                          </div>
                          <div className="shrink-0 text-[10px] font-medium text-muted">
                            {formatNotificationTime(item.createdAt)}
                          </div>
                        </div>
                        <div className="mt-[4px] line-clamp-2 text-[11px] font-medium leading-[16px] text-muted">
                          {item.message || ""}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              }) : (
                <div className="px-[14px] py-[24px] text-center text-[12px] font-medium text-muted">
                  Chưa có thông báo mới.
                </div>
              )}
            </div>

            <div className="border-t border-border bg-background/60 px-[14px] py-[10px]">
              <button
                type="button"
                className="w-full rounded-[8px] border border-border bg-card px-[12px] py-[9px] text-[12px] font-bold text-text transition hover:bg-background"
                onClick={() => {
                  closeNotificationsMenu();
                  router.push("/notifications");
                }}
              >
                Xem tất cả thông báo
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
