"use client";

import React, { useMemo, useRef, useState } from "react";
import { Camera, Globe2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { authKeys, useCurrentUserQuery } from "@/lib/queries/auth.queries";
import { settingsApi } from "@/lib/api/settings.api";
import { authApi } from "@/lib/api/auth.api";
import { compressImageFile } from "@/lib/utils/image";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth/auth-store";
import toast from "react-hot-toast";

type ProfileSettings = {
  fullName: string;
  phone: string;
  email: string;
  language: string;
  timezone: string;
  avatarUrl?: string;
};

const fallback: ProfileSettings = {
  fullName: "",
  phone: "",
  email: "",
  language: "Tiếng Việt (VN)",
  timezone: "Asia/Ho_Chi_Minh (GMT+7)",
  avatarUrl: "",
};

function Field({ label, value, onChange, type = "text", className = "" }: any) {
  return (
    <div className={`flex flex-col gap-[6px] ${className}`}>
      <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={onChange}
        className="h-[42px] px-[14px] bg-background border border-border rounded-[10px] text-[13px] font-medium text-text focus:outline-none focus:border-primary transition-all"
      />
    </div>
  );
}

export default function SettingsProfile() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data: authUser } = useCurrentUserQuery(accessToken);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const initial = useMemo<ProfileSettings>(
    () => ({
      ...fallback,
      fullName: authUser?.fullName || "",
      phone: (authUser as any)?.phone || "",
      email: authUser?.email || "",
      avatarUrl: (authUser as any)?.avatarUrl || "",
    }),
    [authUser?.email, authUser?.fullName],
  );
  const { draft, setDraft, isLoading, isSaving, save } = useSettingsSection<ProfileSettings>("profile", "USER", initial);
  const [isUploading, setIsUploading] = useState(false);

  const updateField = (field: keyof ProfileSettings) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const initials = useMemo(() => {
    const source = draft.fullName || authUser?.fullName || "VP";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
  }, [authUser?.fullName, draft.fullName]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 384,
        maxHeight: 384,
        quality: 0.75,
        mimeType: "image/webp",
      });
      const uploaded = await settingsApi.uploadAsset(compressed, {
        folder: "avatars",
        purpose: "profile-avatar",
        scope: "USER",
      });
      const next = { ...draft, avatarUrl: uploaded.url || "" };
      setAvatarBroken(false);
      setDraft(next);
      await save(next);
      const updatedUser = await authApi.updateMe({ fullName: next.fullName });
      queryClient.setQueryData(authKeys.me(accessToken), updatedUser);
      useAuthStore.setState((state) => ({
        ...state,
        user: {
          ...(state.user || {}),
          id: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName,
          tenantId: updatedUser.tenantId,
          roles: updatedUser.roles,
          permissions: updatedUser.permissions,
        },
        isAuthenticated: true,
      }));
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải avatar lên");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-[20px]"
      onSubmit={async (event) => {
        event.preventDefault();
        const saved = await save();
        const updatedUser = await authApi.updateMe({ fullName: saved?.value?.fullName || draft.fullName });
        queryClient.setQueryData(authKeys.me(accessToken), updatedUser);
        useAuthStore.setState((state) => ({
          ...state,
          user: {
            ...(state.user || {}),
            id: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.fullName,
            tenantId: updatedUser.tenantId,
            roles: updatedUser.roles,
            permissions: updatedUser.permissions,
          },
          isAuthenticated: true,
        }));
      }}
    >
      <div className="bg-card border border-border rounded-[20px] p-[18px] sm:p-[20px] shadow-sm flex flex-col gap-[20px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">Hồ sơ cá nhân</h3>
        <div className="flex flex-col gap-[18px]">
          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-[14px] items-center">
            <div className="relative w-[88px] h-[88px] shrink-0">
              {draft.avatarUrl && !avatarBroken ? (
                <img
                  src={draft.avatarUrl}
                  alt="Avatar profile"
                  onError={() => setAvatarBroken(true)}
                  className="w-full h-full rounded-full object-cover border border-border shadow-sm bg-background"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-primary via-[#7c3aed] to-warning flex items-center justify-center text-white text-[30px] font-black shadow-sm">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-[30px] h-[30px] rounded-full bg-primary text-white shadow-lg flex items-center justify-center border-2 border-card hover:scale-105 transition-transform"
                aria-label="Đổi ảnh đại diện"
                disabled={isUploading}
              >
                <Camera size={13} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <Field
              label="Họ và tên"
              value={draft.fullName}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const value = event.target.value;
                setDraft((prev) => ({ ...prev, fullName: value }));
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-[10px] sm:gap-[14px]">
            <Field label="Số điện thoại" value={draft.phone} onChange={updateField("phone")} />
            <Field label="Email đăng nhập" value={draft.email} onChange={updateField("email")} type="email" />
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Vai trò</label>
              <div className="min-h-[42px] px-[14px] py-[10px] bg-primary/10 border border-primary/20 rounded-[12px] flex items-center">
                <span className="text-[13px] font-bold text-primary whitespace-nowrap truncate">{authUser?.roles?.[0] || "Administrator"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Trạng thái</label>
              <div className="min-h-[42px] px-[14px] py-[10px] bg-success/10 border border-success/20 rounded-[12px] flex items-center">
                <span className="text-[13px] font-bold text-success whitespace-nowrap">● Hoạt động</span>
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Ngôn ngữ</label>
              <div className="relative">
                <Globe2 size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
                <Select
                  value={draft.language}
                  onChange={updateField("language")}
                  options={[
                    { label: "Tiếng Việt (VN)", value: "Tiếng Việt (VN)" },
                    { label: "English (US)", value: "English (US)" },
                  ]}
                  className="pl-[36px]"
                />
              </div>
            </div>
            <Field label="Múi giờ" value={draft.timezone} onChange={updateField("timezone")} />
            <div className="col-span-2 text-[11px] font-medium text-muted leading-relaxed">JPG, PNG hoặc WebP. Tối đa 2MB.</div>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end border-t border-border pt-[16px] gap-3">
          {isLoading ? <span className="text-[12px] text-muted self-center">Đang tải cấu hình...</span> : null}
          <Button type="submit" className="h-[44px] px-[24px] rounded-[12px] bg-primary text-white font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-sm w-full sm:w-auto" isLoading={isSaving}>
            Cập nhật hồ sơ
          </Button>
        </div>
      </div>
    </form>
  );
}
