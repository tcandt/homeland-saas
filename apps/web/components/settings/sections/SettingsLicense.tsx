"use client";

import React, { useMemo, useState } from "react";
import {
  Award,
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
import { Modal } from "@/components/ui/Modal";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { useQueryClient } from "@tanstack/react-query";
import { settingsKeys } from "@/lib/queries/settings.queries";

type PreviewTheme = "dark" | "light";
type AccessControlSettings = {
  registrationEnabled: boolean;
  maintenanceEnabled: boolean;
};

export function MaintenanceScreen({
  isPreview = true,
  forcedTheme,
}: {
  isPreview?: boolean;
  forcedTheme?: PreviewTheme;
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
      className={`relative w-full overflow-hidden rounded-2xl border transition-all duration-300 shadow-2xl p-6 ${
        isDark
          ? "border-slate-800/80 bg-gradient-to-b from-slate-950 via-[#0B0F19] to-slate-950 text-slate-100"
          : "border-slate-200/90 bg-gradient-to-b from-slate-50 via-white to-slate-100/70 text-slate-900 shadow-slate-200/50"
      }`}
    >
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between w-full border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
              BẢN XEM TRƯỚC
            </span>
            <span className="text-xs font-black">Chế độ bảo trì</span>
            <span className="text-xs font-bold text-muted">Chưa kích hoạt</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="maintenance-modal-theme-dark"
              onClick={() => setLocalTheme("dark")}
              className={`px-2 py-1 rounded text-xs font-bold ${isDark ? "bg-primary text-white" : "text-muted"}`}
            >
              <Moon size={12} className="inline mr-1" /> Tối
            </button>
            <button
              type="button"
              data-testid="maintenance-modal-theme-light"
              onClick={() => setLocalTheme("light")}
              className={`px-2 py-1 rounded text-xs font-bold ${!isDark ? "bg-primary text-white" : "text-muted"}`}
            >
              <Sun size={12} className="inline mr-1" /> Sáng
            </button>
          </div>
        </div>

        <div className="py-6 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-lg">
            <ServerCog size={32} />
          </div>
          <h2 className="text-lg font-black">Hệ thống đang được bảo trì nâng cấp</h2>
          <p className="text-xs text-muted max-w-md">
            Chúng tôi đang cập nhật các tính năng và tăng cường bảo mật. Vui lòng quay lại sau khi hệ thống hoàn tất bảo trì.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            className="h-9 px-4 text-xs font-bold"
          >
            <RefreshCw size={13} className="mr-1.5" /> Làm mới trang (F5)
          </Button>
          <a
            href="/login"
            className="h-9 px-4 inline-flex items-center justify-center text-xs font-bold rounded-xl bg-primary text-white"
          >
            <KeyRound size={13} className="mr-1.5" /> Đăng nhập Quản trị
          </a>
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

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

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
            <div className="font-mono font-black text-[15px] leading-tight text-muted">
              Khóa / Chỉ mời
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">Kiểm soát truy cập chưa được kết nối</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <Wrench size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Chế độ bảo trì</div>
            <div className="font-mono font-black text-[15px] leading-tight text-emerald-600">
              Hoạt động bình thường
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">Kiểm soát truy cập chưa được kết nối</div>
          </div>
        </Card>
      </div>

      {/* Disabled switches notice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-2xs opacity-75">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <UserPlus size={18} />
              </span>
              <div>
                <h3 className="text-xs md:text-sm font-black text-text">Đăng ký tài khoản công khai</h3>
                <p className="text-[11px] text-muted mt-0.5">Kiểm soát truy cập chưa được kết nối backend</p>
              </div>
            </div>
            <button
              type="button"
              disabled
              data-testid="registration-control-disabled"
              className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed rounded-full bg-muted/30 opacity-50"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-0" />
            </button>
          </div>
        </Card>

        <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-2xs opacity-75">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <ServerCog size={18} />
              </span>
              <div>
                <h3 className="text-xs md:text-sm font-black text-text">Chế độ bảo trì toàn hệ thống</h3>
                <p className="text-[11px] text-muted mt-0.5">Kiểm soát truy cập chưa được kết nối backend</p>
              </div>
            </div>
            <button
              type="button"
              disabled
              data-testid="maintenance-control-disabled"
              className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed rounded-full bg-muted/30 opacity-50"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-0" />
            </button>
          </div>
        </Card>
      </div>

      {/* Maintenance Preview Action */}
      <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Monitor size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black text-text">Xem trước màn hình bảo trì</h3>
            <p className="text-[11px] text-muted">Mở modal xem thử giao diện bảo trì với chế độ Sáng / Tối</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          data-testid="maintenance-preview-open"
          onClick={() => setIsPreviewModalOpen(true)}
          className="h-8 rounded-xl px-3 text-xs font-bold gap-1.5"
        >
          <Eye size={13} /> Mở bản xem trước
        </Button>
      </Card>

      {/* Maintenance Preview Modal */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Bản xem trước màn hình bảo trì"
        testId="maintenance-preview-modal"
        maxWidth="max-w-[700px]"
      >
        <div className="py-2">
          <MaintenanceScreen isPreview={true} />
        </div>
      </Modal>
    </div>
  );
}
