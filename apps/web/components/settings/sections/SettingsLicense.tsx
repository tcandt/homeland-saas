"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Eye,
  KeyRound,
  LockKeyhole,
  Monitor,
  Moon,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Sun,
  UserPlus,
  Wrench,
  X,
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
  const theme = forcedTheme ?? localTheme;
  const isDark = theme === "dark";

  return (
    <section
      data-testid={isPreview ? "maintenance-screen-preview" : "maintenance-screen-live"}
      data-theme={theme}
      className={`w-full overflow-hidden rounded-xl border ${
        isDark ? "border-slate-800 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"}`}>
            <Wrench size={16} aria-hidden="true" />
          </span>
          <div>
            <strong className="block text-xs font-black">HomeLand Premium</strong>
            <span className={`block text-[10px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>Mẫu màn hình bảo trì</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPreview && (
            <div className="flex items-center gap-1 rounded-lg border border-border/70 p-0.5">
              <button
                type="button"
                onClick={() => setLocalTheme("dark")}
                className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold ${
                  isDark ? "bg-primary text-white" : "text-muted hover:text-text"
                }`}
              >
                <Moon size={11} /> Tối
              </button>
              <button
                type="button"
                onClick={() => setLocalTheme("light")}
                className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold ${
                  !isDark ? "bg-primary text-white" : "text-muted hover:text-text"
                }`}
              >
                <Sun size={11} /> Sáng
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-3 border border-amber-500/20">
          <Wrench size={22} className="animate-pulse" />
        </div>
        <h3 className="text-base font-black text-text">Hệ thống đang bảo trì định kỳ</h3>
        <p className="max-w-md text-xs text-muted mt-1 leading-relaxed">
          Chúng tôi đang nâng cấp cơ sở dữ liệu và tối ưu hiệu năng. Hệ thống sẽ quay trở lại hoạt động bình thường trong ít phút.
        </p>
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

        <MaintenanceScreen isPreview forcedTheme="dark" />
      </Card>
    </div>
  );
}
