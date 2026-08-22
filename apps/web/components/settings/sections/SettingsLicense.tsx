"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Eye,
  LockKeyhole,
  Monitor,
  Moon,
  ServerCog,
  ShieldCheck,
  Sun,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
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
    <div className="flex min-h-[146px] items-start gap-[14px] rounded-[8px] border border-border bg-card p-[18px] shadow-sm">
      <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] bg-background text-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-[10px] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-[8px]">
            <h3 className="text-[15px] font-black text-text">{title}</h3>
            <span className="rounded-[6px] border border-warning/30 bg-warning/10 px-[8px] py-[3px] text-[10px] font-black text-warning">
              {badge}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-[8px]" data-testid={`${testId}-state`}>
            <span className={`text-[11px] font-black uppercase ${enabled ? "text-success" : "text-muted"}`}>
              {enabled ? "Đang bật" : "Đang tắt"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={`${title} ${enabled ? "đang bật" : "đang tắt"}`}
              disabled={isSaving}
              onClick={onToggle}
              data-testid={testId}
              className={`relative h-[26px] w-[46px] shrink-0 rounded-full border transition ${
                enabled
                  ? "border-primary bg-primary"
                  : "border-border bg-muted/20"
              } ${isSaving ? "cursor-wait opacity-60" : "cursor-pointer"}`}
            >
              <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-card shadow-sm ring-1 ring-border transition ${enabled ? "left-[23px]" : "left-[3px]"}`} />
            </button>
          </div>
        </div>
        <p className="mt-[8px] text-[12px] font-medium leading-[19px] text-muted">{description}</p>
      </div>
    </div>
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
      className={`w-full overflow-hidden rounded-[8px] border ${
        isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className={`flex flex-wrap items-center justify-between gap-[12px] border-b px-[20px] py-[16px] ${isDark ? "border-slate-800" : "border-slate-200"}`}>
        <div className="flex items-center gap-[10px]">
          <span className={`flex h-[36px] w-[36px] items-center justify-center rounded-[8px] ${isDark ? "bg-indigo-500/15 text-indigo-300" : "bg-indigo-50 text-indigo-600"}`}>
            <Wrench size={18} aria-hidden="true" />
          </span>
          <div>
            <strong className="block text-[14px] font-black">HomeLand Premium</strong>
            <span className={`block text-[11px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>Mẫu màn hình bảo trì</span>
          </div>
        </div>

        <div className="flex items-center gap-[8px]">
          {!forcedTheme && (
            <div className={`flex rounded-[7px] border p-[2px] ${isDark ? "border-slate-700" : "border-slate-200"}`}>
              <button
                type="button"
                onClick={() => setLocalTheme("light")}
                data-testid="maintenance-preview-theme-light"
                aria-label="Xem giao diện sáng"
                className={`flex h-[28px] w-[30px] items-center justify-center rounded-[5px] ${!isDark ? "bg-indigo-600 text-white" : "text-slate-400"}`}
              >
                <Sun size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setLocalTheme("dark")}
                data-testid="maintenance-preview-theme-dark"
                aria-label="Xem giao diện tối"
                className={`flex h-[28px] w-[30px] items-center justify-center rounded-[5px] ${isDark ? "bg-indigo-600 text-white" : "text-slate-500"}`}
              >
                <Moon size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <span className="rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-[9px] py-[5px] text-[10px] font-black text-amber-500">
            BẢN XEM TRƯỚC
          </span>
        </div>
      </div>

      <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className={`flex flex-col justify-center px-[24px] py-[34px] sm:px-[40px] ${isDark ? "border-slate-800" : "border-slate-200"} lg:border-r`}>
          <span className={`w-fit rounded-[6px] px-[9px] py-[5px] text-[10px] font-black ${isDark ? "bg-indigo-500/15 text-indigo-300" : "bg-indigo-50 text-indigo-700"}`}>
            GIAO DIỆN DỰ KIẾN
          </span>
          <h1 className="mt-[16px] max-w-[620px] text-[30px] font-black leading-[38px] sm:text-[36px] sm:leading-[44px]">
            Hệ thống tạm thời không khả dụng
          </h1>
          <p className={`mt-[12px] max-w-[620px] text-[14px] font-medium leading-[23px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            Quản trị viên đang thực hiện công việc bảo trì đã được phê duyệt. Vui lòng quay lại sau khi hệ thống có thông báo chính thức.
          </p>
          <div className={`mt-[22px] flex items-start gap-[10px] rounded-[7px] border px-[13px] py-[11px] ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
            <AlertTriangle className="mt-[1px] shrink-0 text-amber-500" size={16} aria-hidden="true" />
            <p className={`text-[12px] font-medium leading-[18px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              Đây chỉ là nội dung mẫu. Không hiển thị tiến độ, thời gian hoàn tất hoặc trạng thái kỹ thuật khi máy chủ chưa cung cấp dữ liệu thật.
            </p>
          </div>
        </div>

        <div className={`flex flex-col justify-center px-[24px] py-[30px] sm:px-[32px] ${isDark ? "bg-slate-900/40" : "bg-slate-50"}`}>
          <ShieldCheck className={isDark ? "text-indigo-300" : "text-indigo-600"} size={28} aria-hidden="true" />
          <h2 className="mt-[14px] text-[16px] font-black">Trạng thái triển khai</h2>
          <dl className={`mt-[16px] divide-y ${isDark ? "divide-slate-800" : "divide-slate-200"}`}>
            <div className="flex items-center justify-between gap-[16px] py-[11px] text-[12px]">
              <dt className={isDark ? "text-slate-400" : "text-slate-500"}>Middleware</dt>
              <dd className="font-black">Chưa kết nối</dd>
            </div>
            <div className="flex items-center justify-between gap-[16px] py-[11px] text-[12px]">
              <dt className={isDark ? "text-slate-400" : "text-slate-500"}>Admin bypass</dt>
              <dd className="font-black">Chưa kiểm thử</dd>
            </div>
            <div className="flex items-center justify-between gap-[16px] py-[11px] text-[12px]">
              <dt className={isDark ? "text-slate-400" : "text-slate-500"}>Chế độ bảo trì</dt>
              <dd className="font-black text-amber-500">Chưa kích hoạt</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export default function SettingsLicense() {
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [modalTheme, setModalTheme] = useState<PreviewTheme>("dark");
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();
  const fallback = useMemo<AccessControlSettings>(() => ({
    registrationEnabled: process.env.NEXT_PUBLIC_ALLOW_REGISTRATION === "true",
    maintenanceEnabled: process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true",
  }), []);
  const { draft, isLoading, isSaving, save } = useSettingsSection<AccessControlSettings>("access-control", "TENANT", fallback);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateAccessControl = async (patch: Partial<AccessControlSettings>) => {
    const saved = await save({ ...draft, ...patch });
    queryClient.setQueryData(settingsKeys.section("access-control", "TENANT"), saved);
  };

  return (
    <div data-testid="settings-license-root" className="flex flex-col gap-[20px]">
      <section className="rounded-[8px] border border-warning/30 bg-warning/5 px-[20px] py-[18px] sm:px-[24px]">
        <div className="flex items-start gap-[12px]">
          <LockKeyhole className="mt-[1px] shrink-0 text-warning" size={19} aria-hidden="true" />
          <div>
            <h2 className="text-[15px] font-black text-text">Kiểm soát truy cập runtime</h2>
            <p className="mt-[5px] text-[13px] font-medium leading-[20px] text-muted">
              Các công tắc bên dưới lưu trực tiếp vào cấu hình runtime của hệ thống. Thay đổi có hiệu lực ngay sau khi lưu, không cần sửa file env.
            </p>
          </div>
        </div>
      </section>

      <div data-testid="settings-license-control-grid" className="grid grid-cols-1 gap-[14px] xl:grid-cols-2">
        <AccessControlSwitch
          icon={<UserPlus size={20} aria-hidden="true" />}
          title="Đăng ký tài khoản"
          badge={draft.registrationEnabled ? "ĐANG MỞ" : "ĐANG ĐÓNG"}
          enabled={draft.registrationEnabled}
          isSaving={isLoading || isSaving}
          onToggle={() => updateAccessControl({ registrationEnabled: !draft.registrationEnabled })}
          description="Bật để cho phép người dùng truy cập /register và tạo tenant mới. Tắt để API /auth/register trả về trạng thái đăng ký đang đóng."
          testId="registration-control-switch"
        />
        <AccessControlSwitch
          icon={<Wrench size={20} aria-hidden="true" />}
          title="Bảo trì hệ thống"
          badge={draft.maintenanceEnabled ? "ĐANG BẢO TRÌ" : "ĐANG TẮT"}
          enabled={draft.maintenanceEnabled}
          isSaving={isLoading || isSaving}
          onToggle={() => updateAccessControl({ maintenanceEnabled: !draft.maintenanceEnabled })}
          description="Bật để người dùng thường thấy màn hình bảo trì. Tài khoản quản trị vẫn được vào Settings để tắt lại khi cần."
          testId="maintenance-control-switch"
        />
      </div>

      <section data-testid="maintenance-preview-card" className="flex flex-col gap-[16px] rounded-[8px] border border-border bg-card p-[20px] shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-[24px]">
        <div className="flex min-w-0 items-start gap-[12px]">
          <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
            <Monitor size={19} aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-[8px]">
              <h3 className="text-[15px] font-black text-text">Mẫu màn hình bảo trì</h3>
              <span className="rounded-[6px] border border-border bg-background px-[8px] py-[3px] text-[10px] font-black text-muted">CHỈ XEM TRƯỚC</span>
            </div>
            <p className="mt-[4px] text-[12px] font-medium leading-[18px] text-muted">Kiểm tra bố cục sáng/tối. Thao tác này không bật chế độ bảo trì.</p>
          </div>
        </div>
        <Button type="button" onClick={() => setIsPreviewModalOpen(true)} data-testid="maintenance-preview-open" className="shrink-0 gap-[7px] rounded-[8px]">
          <Eye size={16} aria-hidden="true" />
          Xem bản mẫu
        </Button>
      </section>

      <section className="rounded-[8px] border border-border bg-card px-[20px] py-[16px] shadow-sm sm:px-[24px]">
        <div className="flex items-start gap-[10px]">
          <ServerCog className="mt-[1px] shrink-0 text-primary" size={18} aria-hidden="true" />
          <p className="text-[12px] font-medium leading-[19px] text-muted">
            Cấu hình được lưu trong Settings và ghi audit log khi thay đổi. Đăng ký public được chặn tại API; bảo trì runtime áp dụng cho người dùng thường trong web app, còn quản trị viên được bypass để có thể tắt lại.
          </p>
        </div>
      </section>

      {mounted && isPreviewModalOpen && createPortal(
        <div data-testid="maintenance-preview-modal-backdrop" className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-[12px] backdrop-blur-sm sm:p-[20px]">
          <div data-testid="maintenance-preview-modal" className="flex max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[8px] border border-border bg-card shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-[14px] border-b border-border px-[16px] py-[12px] sm:px-[20px]">
              <div className="flex min-w-0 items-center gap-[9px]">
                <Eye size={17} className="shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-[14px] font-black text-text">Bản mẫu màn hình bảo trì</h3>
                  <p className="text-[10px] font-medium text-muted">Không thay đổi trạng thái hệ thống</p>
                </div>
              </div>
              <div className="flex items-center gap-[8px]">
                <div className="flex rounded-[7px] border border-border bg-background p-[2px]">
                  <button type="button" onClick={() => setModalTheme("light")} data-testid="maintenance-modal-theme-light" aria-label="Bản mẫu sáng" className={`flex h-[28px] items-center gap-[5px] rounded-[5px] px-[9px] text-[11px] font-bold ${modalTheme === "light" ? "bg-card text-primary shadow-sm" : "text-muted"}`}>
                    <Sun size={13} aria-hidden="true" /> Sáng
                  </button>
                  <button type="button" onClick={() => setModalTheme("dark")} data-testid="maintenance-modal-theme-dark" aria-label="Bản mẫu tối" className={`flex h-[28px] items-center gap-[5px] rounded-[5px] px-[9px] text-[11px] font-bold ${modalTheme === "dark" ? "bg-primary text-white" : "text-muted"}`}>
                    <Moon size={13} aria-hidden="true" /> Tối
                  </button>
                </div>
                <button type="button" onClick={() => setIsPreviewModalOpen(false)} data-testid="maintenance-preview-close" aria-label="Đóng bản mẫu" className="flex h-[32px] w-[32px] items-center justify-center rounded-[7px] text-muted hover:bg-background hover:text-text">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto bg-background p-[10px] sm:p-[16px]">
              <MaintenanceScreen isPreview forcedTheme={modalTheme} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
