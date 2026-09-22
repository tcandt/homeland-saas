"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Moon, Sun, Bell, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import useSWR from "swr";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useCurrentUserQuery } from "@/lib/queries/auth.queries";
import { useSettingsSectionQuery } from "@/lib/queries/settings.queries";
import Link from "next/link";
import { consumeServerSentEvents } from "@/lib/server-sent-events";
import { Button } from "@/components/ui/Button";
import BrandLogo from "@/components/ui/BrandLogo";
import webPackage from "../../package.json";
import {
  playNotificationSound,
  speakPaymentAmount,
  unlockNotificationAudio,
  type NotificationSoundId,
} from "@/lib/notification-sounds";

interface HeaderProps {
  onToggleSidebar: () => void;
}

const routeMeta: Record<string, { title: string; subtitle: string; mobileSubtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Tổng quan hoạt động hôm nay",
    mobileSubtitle: "Chào mừng trở lại",
  },
  "/summary": {
    title: "Tổng hợp",
    subtitle: "Quản lý chốt tháng, tiền điện nước & gửi thông báo",
    mobileSubtitle: "Tổng hợp chốt tháng và dịch vụ",
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
    title: "Đặt cọc",
    subtitle: "Quản lý phiếu cọc, giữ chỗ và tiến trình hợp đồng",
    mobileSubtitle: "Phiếu cọc đang giữ và cần xử lý",
  },
  "/finance": {
    title: "Doanh thu & Tài chính",
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
  "/activities": {
    title: "Nhật ký vận hành",
    subtitle: "Theo dõi toàn bộ lịch sử thao tác và hệ thống",
    mobileSubtitle: "Nhật ký hoạt động và bảo mật",
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

const SPOKEN_PAYMENT_NOTIFICATION_KEY = "homeland-spoken-payment-notification-ids";
const MAX_SPOKEN_PAYMENT_NOTIFICATIONS = 200;

function readSpokenPaymentNotificationIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(SPOKEN_PAYMENT_NOTIFICATION_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item)) : []);
  } catch {
    return new Set<string>();
  }
}

function persistSpokenPaymentNotificationIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const nextIds = Array.from(ids).slice(-MAX_SPOKEN_PAYMENT_NOTIFICATIONS);
    window.localStorage.setItem(SPOKEN_PAYMENT_NOTIFICATION_KEY, JSON.stringify(nextIds));
  } catch {
    // Ignore storage quota/privacy mode errors. The in-memory guard still
    // prevents duplicate speech during the current session.
  }
}

function normalizeNotificationListPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  return [];
}

function mergeNotificationLists(currentPayload: any, incomingNotifications: any[]) {
  const currentNotifications = normalizeNotificationListPayload(currentPayload);
  const byId = new Map<string, any>();
  for (const item of incomingNotifications) {
    if (item?.id) byId.set(String(item.id), item);
  }
  for (const item of currentNotifications) {
    if (item?.id && !byId.has(String(item.id))) byId.set(String(item.id), item);
  }
  return Array.from(byId.values()).sort(
    (left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime(),
  );
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const current =
    routeMeta[pathname] ??
    Object.entries(routeMeta).find(([path]) => path !== "/" && pathname.startsWith(path))?.[1] ??
    routeMeta["/"];
  const [mounted, setMounted] = useState(false);
  const [dropdownMounted, setDropdownMounted] = useState(false);
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data: currentUser } = useCurrentUserQuery(accessToken);
  const { data: profileSection } = useSettingsSectionQuery<{ fullName?: string }>("profile", "USER", Boolean(accessToken));
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationMenuPosition, setNotificationMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [bellAttention, setBellAttention] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsInitializedRef = useRef(false);
  const unreadCountInitializedRef = useRef(false);
  const previousUnreadCountRef = useRef(0);
  const spokenPaymentNotificationIdsRef = useRef<Set<string>>(new Set());
  const pendingAudioNotificationsRef = useRef<any[]>([]);
  const pendingAudioNotificationIdsRef = useRef<Set<string>>(new Set());

  const handleUnauthorizedSession = () => {
    useAuthStore.getState().clearSession();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth-storage");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
  };

  const fetchNotifications = async (url: string) => {
    if (!accessToken) return [];
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 401) {
        handleUnauthorizedSession();
        return [];
      }
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  };

  const { data: notificationList, mutate: mutateNotifications } = useSWR(
    accessToken ? "/api/v1/notifications" : null,
    fetchNotifications,
    { revalidateOnFocus: false, refreshInterval: 30000 },
  );
  const recentNotifications = normalizeNotificationListPayload(notificationList).slice(0, 5);
  const { data: notificationSettings } = useSettingsSectionQuery<any>(
    "notifications",
    "TENANT",
    Boolean(accessToken),
  );
  const audioSettings = {
    enabled: true,
    speakPaymentAmount: true,
    voiceName: "",
    speechRate: 0.95,
    speechPitch: 1,
    paymentSound: "coins",
    reminderSound: "soft",
    overdueSound: "alert",
    systemSound: "pop",
    volume: 0.75,
    ...((notificationSettings?.value?.audioSettings || {}) as Record<string, unknown>),
  };
  const paymentSound = (audioSettings.paymentSound || "coins") as NotificationSoundId;
  const audioVolume = Number(audioSettings.volume ?? 0.75);
  const soundForType = (type?: string) => {
    if (type === "PAYMENT_RECEIVED") return paymentSound;
    if (type === "CONTRACT_EXPIRING") return (audioSettings.reminderSound || "soft") as NotificationSoundId;
    if (type === "INVOICE_OVERDUE" || type === "INVOICE_DUE_SOON") return (audioSettings.overdueSound || "alert") as NotificationSoundId;
    return (audioSettings.systemSound || "pop") as NotificationSoundId;
  };

  const playNotificationAlert = async (type?: string, notification?: any) => {
    if (!audioSettings.enabled) return false;
    const played = await playNotificationSound(soundForType(type), audioVolume);
    if (played) setAudioEnabled(true);
    let speechQueued = false;
    if (
      type === "PAYMENT_RECEIVED"
      && audioSettings.speakPaymentAmount !== false
      && (played || audioEnabled || paymentSound === "none")
    ) {
      const notificationId = notification?.id ? String(notification.id) : "";
      if (notificationId && spokenPaymentNotificationIdsRef.current.has(notificationId)) {
        return true;
      }
      const amount = Number(
        notification?.metadata?.amount
        ?? notification?.metadata?.paymentAmount
        ?? notification?.metadata?.paidAmount,
      );
      if (Number.isFinite(amount) && amount > 0) {
        speechQueued = speakPaymentAmount(amount, audioVolume, {
          voiceName: typeof audioSettings.voiceName === "string" ? audioSettings.voiceName : undefined,
          rate: Number(audioSettings.speechRate ?? 0.95),
          pitch: Number(audioSettings.speechPitch ?? 1),
        });
        if (speechQueued && notificationId) {
          spokenPaymentNotificationIdsRef.current.add(notificationId);
          persistSpokenPaymentNotificationIds(spokenPaymentNotificationIdsRef.current);
        }
      }
    }
    return played || speechQueued;
  };

  const flushPendingAudioNotifications = () => {
    const pending = pendingAudioNotificationsRef.current.splice(0);
    pendingAudioNotificationIdsRef.current.clear();
    for (const notification of pending) {
      void playNotificationAlert(notification.type, notification).then((played) => {
        if (!played && notification?.id) {
          pendingAudioNotificationsRef.current.push(notification);
          pendingAudioNotificationIdsRef.current.add(String(notification.id));
        }
      });
    }
  };

  const queueNotificationAlert = (notification: any) => {
    const id = notification?.id ? String(notification.id) : `${notification?.type || "notification"}:${notification?.createdAt || Date.now()}`;
    if (!pendingAudioNotificationIdsRef.current.has(id)) {
      pendingAudioNotificationsRef.current.push(notification);
      pendingAudioNotificationIdsRef.current.add(id);
    }
    if (audioEnabled) flushPendingAudioNotifications();
  };

  const primeNotificationAudio = async () => {
    if (!audioSettings.enabled) return false;
    const enabled = await unlockNotificationAudio();
    setAudioEnabled(enabled);
    if (enabled) flushPendingAudioNotifications();
    return enabled;
  };

  const invalidatePaymentAffectedQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
    void queryClient.invalidateQueries({ queryKey: ["buildings"] });
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["contracts"] });
    void queryClient.invalidateQueries({ queryKey: ["deposits"] });
    void queryClient.invalidateQueries({ queryKey: ["room-finance-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["rental-cycle-finance-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["finance"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  useEffect(() => {
    setMounted(true);
    setDropdownMounted(true);
    spokenPaymentNotificationIdsRef.current = readSpokenPaymentNotificationIds();
  }, []);

  useEffect(() => {
    if (!accessToken || !audioSettings.enabled || audioEnabled) return;

    let disposed = false;
    const autoEnableAudio = () => {
      if (disposed) return;
      void primeNotificationAudio();
    };

    window.addEventListener("pointerdown", autoEnableAudio, { once: true, capture: true });
    window.addEventListener("keydown", autoEnableAudio, { once: true, capture: true });
    window.addEventListener("touchstart", autoEnableAudio, { once: true, capture: true });

    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", autoEnableAudio, { capture: true });
      window.removeEventListener("keydown", autoEnableAudio, { capture: true });
      window.removeEventListener("touchstart", autoEnableAudio, { capture: true });
    };
  }, [accessToken, audioEnabled, audioSettings.enabled]);

  useEffect(() => {
    if (!Array.isArray(recentNotifications)) return;
    const currentIds = new Set(recentNotifications.map((item: any) => String(item.id)));
    if (!notificationsInitializedRef.current) {
      knownNotificationIdsRef.current = currentIds;
      notificationsInitializedRef.current = true;
      const freshPayment = recentNotifications.find((item: any) => {
        if (item?.type !== "PAYMENT_RECEIVED" || item?.status === "READ") return false;
        const createdAt = new Date(item?.createdAt || 0).getTime();
        return Number.isFinite(createdAt) && Date.now() - createdAt <= 15 * 60 * 1000;
      });
      if (freshPayment) queueNotificationAlert(freshPayment);
      return;
    }

    const newNotifications = recentNotifications.filter(
      (item: any) => !knownNotificationIdsRef.current.has(String(item.id)),
    );
    if (newNotifications.length > 0) {
      if (newNotifications.some((item: any) => item?.type === "PAYMENT_RECEIVED")) {
        invalidatePaymentAffectedQueries();
      }
      setBellAttention(true);
      window.setTimeout(() => setBellAttention(false), 900);
      const soundNotification = newNotifications.find((item: any) => item.status !== "READ");
      if (soundNotification) {
        void playNotificationAlert(soundNotification.type, soundNotification).then((played) => {
          if (!played) queueNotificationAlert(soundNotification);
        });
      }
    }
    knownNotificationIdsRef.current = currentIds;
  }, [queryClient, recentNotifications]);

  useEffect(() => {
    if (!unreadCountInitializedRef.current) {
      unreadCountInitializedRef.current = true;
      previousUnreadCountRef.current = unreadCount;
      return;
    }
    if (unreadCount > previousUnreadCountRef.current) {
      setBellAttention(true);
      window.setTimeout(() => setBellAttention(false), 900);
      void mutateNotifications();
      invalidatePaymentAffectedQueries();
    }
    previousUnreadCountRef.current = unreadCount;
  }, [mutateNotifications, queryClient, unreadCount]);

  useEffect(() => {
    if (!accessToken) return;

    let isSubscribed = true;
    let streamController: AbortController | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;

    const fetchInitialCount = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch("/api/v1/notifications/unread-count", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

          if (res.status === 401) {
            handleUnauthorizedSession();
            return;
          }

          if (res.ok && isSubscribed) {
            const data = await res.json();
            setUnreadCount(data.count || data.data?.count || 0);
          }
      } catch {
        // Silent catch for dev server restarts
      }
    };

    fetchInitialCount();

    const handleSseData = (rawData: string) => {
      try {
        const data = JSON.parse(rawData);
        if (data && data.count !== undefined && isSubscribed) {
          setUnreadCount(data.count);
        }
        const streamedNotifications = normalizeNotificationListPayload(data);
        if (streamedNotifications.length > 0 && isSubscribed) {
          void mutateNotifications(
            (current: any) => mergeNotificationLists(current, streamedNotifications),
            { revalidate: false },
          );
        }
      } catch {
        // ignore malformed events
      }
    };

    const startStream = () => {
      if (!accessToken) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      streamController = new AbortController();
      fetch(`${apiUrl}/notifications/stream`, {
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: streamController.signal,
      })
        .then(async (response) => {
          if (response.status === 401) {
            handleUnauthorizedSession();
            return;
          }

          if (response.ok && isSubscribed) {
            await consumeServerSentEvents(response, handleSseData);
          } else if (isSubscribed && response.status !== 401 && response.status !== 403) {
            // If SSE not available and authenticated, fallback polling at 60s
            if (!pollingTimer) {
              pollingTimer = setInterval(fetchInitialCount, 60000);
            }
          }
        })
        .catch(() => {
          if (isSubscribed && !pollingTimer) {
            pollingTimer = setInterval(fetchInitialCount, 60000);
          }
        });
    };

    startStream();

    return () => {
      isSubscribed = false;
      if (streamController) {
        streamController.abort();
      }
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
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
    void primeNotificationAudio();
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
  const rawVersion = process.env.NEXT_PUBLIC_APP_VERSION || webPackage.version || "1.0.0";
  const appVersion = rawVersion.replace(/^v+/i, "");

  return (
    <header
      data-testid="app-header"
      className="fixed top-0 left-0 right-0 h-[56px] bg-card border-b border-slate-100/80 dark:border-white/[0.04] flex items-center justify-between px-4 md:px-5 z-30 transition-colors w-full box-border"
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Desktop Fixed Brand Logo - Slim & Crisp */}
        <div className="hidden md:flex items-center gap-2 w-[210px] shrink-0 mr-1">
          <Link href="/" className="flex items-center gap-2 min-w-0 group whitespace-nowrap">
            <BrandLogo size="sm" variant="horizontal" showTagline={true} />
            <span className="text-[9px] font-mono font-bold text-muted/60 pl-0.5">v{appVersion}</span>
          </Link>
        </div>

        <button
          onClick={onToggleSidebar}
          aria-label="Mở menu"
          className="hidden md:flex w-[34px] h-[34px] text-text items-center justify-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors shrink-0"
        >
          <Menu size={18} />
        </button>

        <div className="hidden md:block pl-0.5">
          <h1 className="m-0 text-[16px] font-black text-text leading-tight">{current.title}</h1>
          <p className="m-0 text-muted text-[11px] font-medium leading-tight">
            {pathname === "/" ? `Chào mừng trở lại, ${getDisplayName()} 👋` : current.subtitle}
          </p>
        </div>

        <div className="md:hidden pt-0.5 shrink min-w-0 overflow-hidden pr-2">
          <h1 className="m-0 text-[20px] leading-[24px] font-[800] tracking-tight truncate w-full">
            <span className="text-[#22c55e]">HomeLand</span>
            <span className="text-text ml-[3px]">Premium</span>
          </h1>
          <p className="m-0 text-muted text-[11px] font-medium truncate w-full">
            {getMobileSubtitle()}
          </p>
        </div>
      </div>

      <div className="hidden md:flex flex-1 max-w-[480px] mx-4 h-[36px] bg-black/[0.03] dark:bg-white/[0.04] border border-border/60 dark:border-white/5 rounded-xl items-center gap-2 px-3 transition-colors">
        <Search size={15} className="text-muted shrink-0" />
        <input
          type="search"
          name="global_search_query"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Tìm phòng, khách thuê, hợp đồng, hóa đơn..."
          className="border-0 outline-none bg-transparent w-full text-text placeholder:text-muted/70 font-medium text-[13px]"
        />
        <div className="text-muted/80 bg-card border border-border/60 rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors">⌘K</div>
      </div>

      <div className="flex items-center gap-2 relative">
        <button
          onClick={toggleTheme}
          aria-label="Đổi giao diện"
          className="w-[34px] h-[34px] border border-border/60 bg-card hover:bg-black/5 dark:hover:bg-white/5 text-text rounded-xl flex items-center justify-center cursor-pointer transition-colors"
        >
          {mounted ? (theme === "dark" ? <Sun size={16} /> : <Moon size={16} />) : <div className="w-[16px] h-[16px]" />}
        </button>
        <button
          ref={notificationButtonRef}
          type="button"
          onClick={openNotificationsMenu}
          aria-label="Thông báo"
          aria-expanded={notificationsOpen}
          className={`w-[34px] h-[34px] border border-border/60 bg-card hover:bg-black/5 dark:hover:bg-white/5 text-text rounded-xl flex items-center justify-center cursor-pointer relative transition-colors ${bellAttention ? "animate-[bell-ring_0.8s_ease-in-out]" : ""}`}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-[2px] -right-[2px] bg-[#ef4444] text-white text-[9px] w-[16px] h-[16px] flex items-center justify-center rounded-full font-bold border-2 border-card">
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
