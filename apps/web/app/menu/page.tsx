"use client";

import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import {
  ChevronRight,
  FileText,
  Gift,
  HelpCircle,
  LogOut,
  PhoneCall,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/lib/auth/auth-store";
import type { CurrentUserProfile } from "@/lib/api/auth.api";
import { useCurrentUserQuery } from "@/lib/queries/auth.queries";
import { useSettingsSectionQuery } from "@/lib/queries/settings.queries";
import webPackage from "../../package.json";

const quickTools = [
  { href: "/contracts", label: "Hợp đồng", icon: FileText, color: "text-[#22c55e]", bg: "bg-[#22c55e]/10" },
  { href: "/invoices", label: "Hóa đơn", icon: Receipt, color: "text-[#ef4444]", bg: "bg-[#ef4444]/10" },
  { href: "/tenants", label: "Khách thuê", icon: Users, color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10" },
];

const advancedFeatures = [
  { href: "/settings", label: "Cài đặt hệ thống", desc: "Tùy chỉnh & Phân quyền", icon: Settings, color: "text-[#64748b]", bg: "bg-[#64748b]/10" },
];

const supportFeatures = [
  { href: "#", label: "Trung tâm trợ giúp", icon: HelpCircle, color: "text-[#06b6d4]", bg: "bg-[#06b6d4]/10" },
  { href: "#", label: "Giới thiệu bạn bè", icon: Gift, color: "text-[#f97316]", bg: "bg-[#f97316]/10", badge: "Quà" },
];

export default function MenuPage() {
  const storedUser = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { data: currentUser, isLoading } = useCurrentUserQuery(accessToken);
  const { data: profileSection } = useSettingsSectionQuery<{ avatarUrl?: string; fullName?: string; email?: string }>("profile", "USER", Boolean(accessToken));

  useEffect(() => {
    if (!currentUser) return;
    const existing = useAuthStore.getState();
    useAuthStore.setState({
      ...existing,
      user: currentUser,
      isAuthenticated: true,
    });
  }, [currentUser]);

  const user = (currentUser || storedUser) as CurrentUserProfile | null;
  const profileFullName = (profileSection?.value as any)?.fullName?.trim?.() || "";
  const profileEmail = (profileSection?.value as any)?.email?.trim?.() || "";
  const avatarUrl = profileSection?.value?.avatarUrl || (user as any)?.avatarUrl || "";
  const initials = useMemo(() => {
    const source = profileFullName || user?.fullName || user?.email || "VP";
    return (
      source
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase())
        .join("")
        .slice(0, 2) || "VP"
    );
  }, [user?.email, user?.fullName, profileFullName]);

  const accountLabel = user?.tenant?.name || "Tài khoản hệ thống";
  const emailLabel = profileEmail || user?.email || "Đang đồng bộ email...";
  const rawVersion = process.env.NEXT_PUBLIC_APP_VERSION || webPackage.version || "1.0.0";
  const appVersion = rawVersion.replace(/^v+/i, "");
  const handleLogout = () => {
    clearSession();
    window.location.assign("/login");
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-[16px] w-full max-w-4xl mx-auto pb-[100px] bg-background pt-2">
        {isLoading && !user ? (
          <Card className="rounded-[18px] p-[16px] shadow-sm flex items-center justify-between gap-4 mx-1">
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="w-[48px] h-[48px] rounded-full" />
              <div className="space-y-2 min-w-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="w-4 h-4 rounded-full" />
          </Card>
        ) : (
          <Link
            href="/settings/profile"
            className="bg-card border border-border rounded-[18px] p-[16px] shadow-sm flex items-center justify-between gap-4 active:scale-[0.98] transition-transform cursor-pointer mx-1"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-[48px] h-[48px] rounded-full bg-gradient-to-tr from-[#4f46e5] to-[#f97316] flex items-center justify-center text-white text-[16px] font-black shadow-sm overflow-hidden border border-white/70">
                  {avatarUrl ? <img src={avatarUrl} alt="Avatar profile" className="w-full h-full object-cover" /> : initials}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-indigo-500 border-2 border-card rounded-full flex items-center justify-center">
                  <ShieldCheck size={8} className="text-white" />
                </div>
              </div>
              <div className="min-w-0 flex flex-col gap-0.5">
                <h2 className="text-[15px] font-black text-text leading-tight truncate">{profileFullName || user?.fullName || "Chưa có tên"}</h2>
                <p className="text-[12px] font-bold text-[#4f46e5] truncate">{emailLabel}</p>
                <p className="text-[11px] font-medium text-muted truncate">{accountLabel}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-muted/60 shrink-0" />
          </Link>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-black text-muted uppercase tracking-wider px-3">Nghiệp vụ thường xuyên</h3>
          <div className="grid grid-cols-3 gap-2 px-1">
            {quickTools.map((tool, i) => {
              const Icon = tool.icon;
              return (
                <Link key={i} href={tool.href} className="bg-card border border-border rounded-[12px] p-2.5 flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform group">
                  <div className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center ${tool.bg} ${tool.color}`}>
                    <Icon size={18} />
                  </div>
                  <span className="text-[10px] font-bold text-text text-center leading-tight">{tool.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2 px-1">
          <h3 className="text-[11px] font-black text-muted uppercase tracking-wider px-2">Tính năng mở rộng</h3>
          <div className="bg-card border border-border rounded-[14px] shadow-sm overflow-hidden flex flex-col divide-y divide-border/50">
            {advancedFeatures.map((item, i) => {
              const Icon = item.icon;
              return (
                <Link key={i} href={item.href} className="flex items-center justify-between p-3 hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-[32px] h-[32px] rounded-[8px] flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex flex-col">
                      <div className="text-[13px] font-bold text-text">{item.label}</div>
                      <div className="text-[11px] font-medium text-muted mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2 px-1 mt-1">
          <div className="bg-card border border-border rounded-[14px] shadow-sm overflow-hidden flex flex-col divide-y divide-border/50">
            {supportFeatures.map((item, i) => {
              const Icon = item.icon;
              return (
                <Link key={i} href={item.href} className="flex items-center justify-between p-3 hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-[32px] h-[32px] rounded-[8px] flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="text-[13px] font-bold text-text flex items-center gap-2">
                      {item.label}
                      {item.badge && <span className="bg-[#f97316] text-white text-[9px] font-black px-1.5 py-0.5 rounded-[4px]">{item.badge}</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </Link>
              );
            })}

            <button type="button" onClick={handleLogout} className="flex items-center gap-3 p-3 hover:bg-rose-500/5 active:bg-rose-500/10 transition-colors text-rose-500 text-left w-full">
              <div className="w-[32px] h-[32px] rounded-[8px] bg-rose-500/10 flex items-center justify-center shrink-0">
                <LogOut size={16} />
              </div>
              <span className="text-[13px] font-bold">Đăng xuất</span>
            </button>
          </div>
        </section>

        <div className="text-center mt-2">
          <p className="font-mono text-[10px] font-medium text-muted">v{appVersion}</p>
        </div>
      </div>
    </AppShell>
  );
}
