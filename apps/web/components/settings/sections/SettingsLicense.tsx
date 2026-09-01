"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  KeyRound,
  LockKeyhole,
  Monitor,
  Moon,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Sun,
  UserPlus,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { useQueryClient } from "@tanstack/react-query";
import { settingsKeys } from "@/lib/queries/settings.queries";

type PreviewTheme = "dark" | "light";
type AccessControlSettings = {
  registrationEnabled: boolean;
  maintenanceEnabled: boolean;
};

function AccessControlSwitch({
  icon,
  title,
  description,
  badge,
  enabled,
  isSaving,
  onToggle,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  enabled: boolean;
  isSaving: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs md:text-sm font-black text-text">{title}</h3>
              <span className="rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                {badge}
              </span>
            </div>
            <div className="flex items-center gap-2" data-testid={`${testId}-state`}>
              <span className={`text-[10px] font-bold uppercase ${enabled ? "text-emerald-600" : "text-muted"}`}>
                {enabled ? "Bật" : "Tắt"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${title} ${enabled ? "đang bật" : "đang tắt"}`}
                disabled={isSaving}
                onClick={onToggle}
                data-testid={testId}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enabled ? "bg-primary" : "bg-muted/30"
                } ${isSaving ? "cursor-wait opacity-60" : "cursor-pointer"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted">{description}</p>
        </div>
      </div>
    </Card>
  );
}

export function MaintenanceScreen({
  isPreview = true,
  forcedTheme,
}: {
  isPreview?: boolean;
  forcedTheme?: PreviewTheme;
  hideHeaderBar?: boolean;
}) {
  const [localTheme, setLocalTheme] = useState<PreviewTheme>("dark");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const theme = forcedTheme ?? localTheme;
  const isDark = theme === "dark";

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <section
      data-testid={isPreview ? "maintenance-screen-preview" : "maintenance-screen-live"}
      data-theme={theme}
      className={`relative w-full overflow-hidden rounded-2xl border transition-all duration-300 shadow-2xl ${
        isDark
          ? "border-slate-800/80 bg-gradient-to-b from-slate-950 via-[#0B0F19] to-slate-950 text-slate-100"
          : "border-slate-200/90 bg-gradient-to-b from-slate-50 via-white to-slate-100/70 text-slate-900 shadow-slate-200/50"
      }`}
    >
      {/* Background ambient neon glow */}
      <div
        className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-[100px] opacity-25 ${
          isDark ? "bg-amber-500/20" : "bg-amber-400/30"
        }`}
      />
      <div
        className={`pointer-events-none absolute -bottom-24 right-10 w-80 h-80 rounded-full blur-[100px] opacity-20 ${
          isDark ? "bg-primary/20" : "bg-primary/25"
        }`}
      />

      {/* Top Bar */}
      <div
        className={`relative z-10 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5 backdrop-blur-md ${
          isDark ? "border-slate-800/80 bg-slate-950/60" : "border-slate-200/80 bg-white/70"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-inner ${
              isDark
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-amber-500/5"
                : "border-amber-400/40 bg-amber-50 text-amber-600 shadow-amber-100"
            }`}
          >
            <Wrench size={17} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-tight">HomeLand System Core</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
                  isDark
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-amber-500/30 bg-amber-50 text-amber-700"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                Đang bảo trì
              </span>
            </div>
            <span className={`block text-[10px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {isPreview ? "Xem trước giao diện khách hàng nhìn thấy" : "Hệ thống tạm ngưng phục vụ để nâng cấp"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPreview && (
            <div
              className={`flex items-center gap-1 rounded-xl border p-1 shadow-2xs ${
                isDark ? "border-slate-800 bg-slate-900/90" : "border-slate-200 bg-slate-100/90"
              }`}
            >
              <button
                type="button"
                onClick={() => setLocalTheme("dark")}
                className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition-all ${
                  isDark
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Moon size={12} /> Tối
              </button>
              <button
                type="button"
                onClick={() => setLocalTheme("light")}
                className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition-all ${
                  !isDark
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sun size={12} /> Sáng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 py-10 md:py-12 text-center max-w-2xl mx-auto">
        {/* Animated Badge Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-3xl bg-amber-500/20 blur-xl animate-pulse" />
          <div
            className={`relative flex h-20 w-20 items-center justify-center rounded-3xl border-2 shadow-2xl transition-transform hover:scale-105 ${
              isDark
                ? "border-amber-500/40 bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 text-amber-400 shadow-amber-500/10"
                : "border-amber-400/50 bg-gradient-to-br from-amber-100 via-white to-amber-50 text-amber-600 shadow-amber-200/50"
            }`}
          >
            <ServerCog size={38} className="animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-slate-950 border-2 border-slate-950 shadow-md">
            <Sparkles size={12} />
          </span>
        </div>

        {/* Headlines */}
        <h2 className="text-xl md:text-2xl font-black tracking-tight mb-2">
          Hệ thống đang được nâng cấp định kỳ
        </h2>
        <p className={`text-xs md:text-sm max-w-lg leading-relaxed mb-8 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          Chúng tôi đang tối ưu hóa cơ sở dữ liệu, nâng cấp tính năng tự động hóa và tăng cường bảo mật. Mọi dữ liệu phòng & hợp đồng của quý khách vẫn được bảo vệ tuyệt đối an toàn.
        </p>

        {/* 3 Status Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8 text-left">
          {/* Card 1: Estimated Time */}
          <div
            className={`flex flex-col gap-1.5 p-3.5 rounded-xl border backdrop-blur-xs transition-all hover:border-amber-500/40 ${
              isDark ? "border-slate-800/80 bg-slate-900/50" : "border-slate-200/80 bg-white/80"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-500">
              <span className="flex items-center gap-1.5">
                <Clock size={13} /> Thời gian dự kiến
              </span>
              <span className="text-[10px] font-mono bg-amber-500/10 px-1.5 py-0.5 rounded-md">85%</span>
            </div>
            <div className="font-mono font-black text-sm text-text">15 - 30 phút</div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-800/30 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
              <div className="bg-gradient-to-r from-amber-500 to-primary h-full rounded-full w-[85%] animate-pulse" />
            </div>
          </div>

          {/* Card 2: Upgrade Scope */}
          <div
            className={`flex flex-col gap-1.5 p-3.5 rounded-xl border backdrop-blur-xs transition-all hover:border-primary/40 ${
              isDark ? "border-slate-800/80 bg-slate-900/50" : "border-slate-200/80 bg-white/80"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-primary">
              <span className="flex items-center gap-1.5">
                <Zap size={13} /> Hạng mục nâng cấp
              </span>
              <span className="text-[10px] font-mono bg-primary/10 px-1.5 py-0.5 rounded-md">v1.1.8</span>
            </div>
            <div className="font-semibold text-xs text-text truncate">Database & Bot Zalo</div>
            <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Tối ưu tốc độ xử lý</span>
          </div>

          {/* Card 3: Data Safety */}
          <div
            className={`flex flex-col gap-1.5 p-3.5 rounded-xl border backdrop-blur-xs transition-all hover:border-emerald-500/40 ${
              isDark ? "border-slate-800/80 bg-slate-900/50" : "border-slate-200/80 bg-white/80"
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={13} /> An toàn dữ liệu
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded-md">100%</span>
            </div>
            <div className="font-semibold text-xs text-text truncate">Đã tự động sao lưu</div>
            <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Mã hóa nhiều lớp</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            className="h-10 rounded-xl px-5 text-xs font-bold gap-2 border-border/80 hover:bg-slate-800/20"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
            Làm mới trang (F5)
          </Button>

          <a
            href="/login"
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold transition-all shadow-md ${
              isDark
                ? "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
                : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20"
            }`}
          >
            <KeyRound size={13} />
            Đăng nhập Quản trị viên (Bypass)
          </a>
        </div>

        {/* Emergency support notice */}
        <div className={`mt-8 pt-5 border-t w-full text-center text-[11px] flex flex-wrap items-center justify-center gap-4 ${
          isDark ? "border-slate-800/80 text-slate-400" : "border-slate-200/80 text-slate-500"
        }`}>
          <span>Hotline hỗ trợ kỹ thuật: <strong className="text-text font-mono">0909.888.xxx</strong></span>
          <span>•</span>
          <span>Email: <strong className="text-text">support@homeland.vn</strong></span>
        </div>
      </div>
    </section>
  );
}

export default function SettingsLicense() {
  const queryClient = useQueryClient();
  const fallback = useMemo<AccessControlSettings>(
    () => ({ registrationEnabled: false, maintenanceEnabled: false }),
    [],
  );

  const { draft, setDraft, save, isSaving } = useSettingsSection<AccessControlSettings>(
    "access-control",
    "TENANT",
    fallback,
  );

  const registrationEnabled = Boolean(draft.registrationEnabled);
  const maintenanceEnabled = Boolean(draft.maintenanceEnabled);

  const handleToggleRegistration = async () => {
    const next = !registrationEnabled;
    setDraft({ ...draft, registrationEnabled: next });
    await save({ ...draft, registrationEnabled: next });
    queryClient.invalidateQueries({ queryKey: settingsKeys.all });
  };

  const handleToggleMaintenance = async () => {
    const next = !maintenanceEnabled;
    setDraft({ ...draft, maintenanceEnabled: next });
    await save({ ...draft, maintenanceEnabled: next });
    queryClient.invalidateQueries({ queryKey: settingsKeys.all });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="settings-license-root">
      {/* 4 Slim KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0">
            <Award size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Gói giải pháp</div>
            <div className="font-mono font-black text-[15px] text-text leading-tight">Enterprise Unlimited</div>
            <div className="text-[10px] text-emerald-600 truncate mt-0.5">Không giới hạn tòa & phòng</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Bản quyền phần mềm</div>
            <div className="font-mono font-black text-[15px] text-emerald-600 leading-tight">Vĩnh viễn (Active)</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Tự động cập nhật phiên bản</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
            <UserPlus size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Đăng ký thành viên</div>
            <div className={`font-mono font-black text-[15px] leading-tight ${registrationEnabled ? "text-emerald-600" : "text-amber-600"}`}>
              {registrationEnabled ? "Đang mở công khai" : "Khóa / Chỉ mời"}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">{registrationEnabled ? "Người dùng tự tạo tk" : "Chỉ Admin tạo"}</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <Wrench size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Chế độ bảo trì</div>
            <div className={`font-mono font-black text-[15px] leading-tight ${maintenanceEnabled ? "text-rose-600" : "text-emerald-600"}`}>
              {maintenanceEnabled ? "Đang bảo trì" : "Hoạt động bình thường"}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">{maintenanceEnabled ? "Chỉ Admin đăng nhập" : "Hệ thống online 24/7"}</div>
          </div>
        </Card>
      </div>

      {/* Switches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AccessControlSwitch
          icon={<UserPlus size={18} />}
          title="Đăng ký tài khoản công khai"
          description="Cho phép khách hàng và nhân viên tự đăng ký tài khoản từ trang đăng nhập mà không cần link mời trực tiếp."
          badge="Global Access"
          enabled={registrationEnabled}
          isSaving={isSaving}
          onToggle={handleToggleRegistration}
          testId="settings-switch-registration"
        />

        <AccessControlSwitch
          icon={<ServerCog size={18} />}
          title="Chế độ bảo trì toàn hệ thống"
          description="Khóa truy cập của tất cả người dùng thông thường và chuyển hướng sang màn hình bảo trì. Chỉ Admin mới có thể truy cập."
          badge="Disaster Mode"
          enabled={maintenanceEnabled}
          isSaving={isSaving}
          onToggle={handleToggleMaintenance}
          testId="settings-switch-maintenance"
        />
      </div>

      {/* Maintenance Preview Screen */}
      <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Monitor size={14} />
            </div>
            <div>
              <h3 className="text-xs font-black text-text">Xem trước màn hình bảo trì (Maintenance Preview)</h3>
              <p className="text-[11px] text-muted">Giao diện mà khách hàng và người dùng nhìn thấy khi chế độ bảo trì được bật.</p>
            </div>
          </div>
        </div>

        <MaintenanceScreen isPreview />
      </Card>
    </div>
  );
}
