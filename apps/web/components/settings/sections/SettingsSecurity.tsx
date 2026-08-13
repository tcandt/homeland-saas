"use client";

import React, { FormEvent, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Shield, Smartphone, Key, LogOut, ClipboardList } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api/auth.api";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
      <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-border bg-background p-[20px] text-center">
      <div className="mx-auto mb-[10px] flex h-[40px] w-[40px] items-center justify-center rounded-full bg-card text-muted">
        {icon}
      </div>
      <div className="font-black text-text">{title}</div>
      <div className="mt-[6px] text-[13px] font-medium text-muted">{desc}</div>
    </div>
  );
}

export default function SettingsSecurity() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 12) {
      toast.error("Mật khẩu mới phải có ít nhất 12 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword({
        oldPassword: currentPassword,
        newPassword,
        confirmPassword,
      });
      clearSession();
      toast.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
      window.location.href = "/login";
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể đổi mật khẩu. Vui lòng thử lại.");
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
        <div className="flex items-start gap-[14px]">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-primary/10 text-primary">
            <Shield size={18} />
          </div>
          <div>
            <div className="text-[18px] font-black text-text">Security</div>
            <div className="mt-[4px] text-[13px] font-medium text-muted">
              Không hiển thị security score, thiết bị, IP hoặc API key giả. Các chỉ số này sẽ đồng bộ khi có endpoint bảo mật thật.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
        <Section title="Đổi mật khẩu">
          <form className="flex h-full flex-col gap-[14px]" onSubmit={changePassword}>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="settings-current-password" className="text-[12px] font-bold text-muted uppercase tracking-wide">Mật khẩu hiện tại</label>
              <Input id="settings-current-password" data-testid="settings-current-password" type="password" autoComplete="current-password" required disabled={isChangingPassword} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-[42px] px-[14px] bg-background border border-border rounded-[10px] text-[13px] font-medium focus:outline-none focus:border-primary transition-all" />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="settings-new-password" className="text-[12px] font-bold text-muted uppercase tracking-wide">Mật khẩu mới</label>
              <Input id="settings-new-password" data-testid="settings-new-password" type="password" autoComplete="new-password" required minLength={12} disabled={isChangingPassword} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-[42px] px-[14px] bg-background border border-border rounded-[10px] text-[13px] font-medium focus:outline-none focus:border-primary transition-all" />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="settings-confirm-password" className="text-[12px] font-bold text-muted uppercase tracking-wide">Xác nhận mật khẩu mới</label>
              <Input id="settings-confirm-password" data-testid="settings-confirm-password" type="password" autoComplete="new-password" required minLength={12} disabled={isChangingPassword} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-[42px] px-[14px] bg-background border border-border rounded-[10px] text-[13px] font-medium focus:outline-none focus:border-primary transition-all" />
            </div>
            <div className="flex justify-end mt-auto pt-[14px]">
              <Button type="submit" data-testid="settings-change-password-submit" isLoading={isChangingPassword} className="h-[40px] px-[20px] rounded-[10px] bg-primary text-white font-bold text-[13px] hover:bg-primary/90 transition-colors w-full">Đổi mật khẩu</Button>
            </div>
          </form>
        </Section>

        <Section title="Xác thực 2 bước (2FA)">
          <EmptyState icon={<Shield size={16} />} title="Chưa có dữ liệu 2FA thật" desc="Trạng thái Email OTP, SMS OTP và Authenticator sẽ lấy từ service xác thực." />
        </Section>

        <Section title="Thiết bị đang đăng nhập">
          <EmptyState icon={<Smartphone size={16} />} title="Chưa có dữ liệu thiết bị trong DB" desc="Danh sách phiên đăng nhập sẽ hiển thị khi backend session được kết nối." />
          <Button className="flex items-center justify-center w-full gap-[8px] h-[40px] px-[16px] rounded-[10px] bg-danger/10 text-danger font-bold text-[13px] hover:bg-danger/20 transition-colors" disabled>
            <LogOut size={14} /> Đăng xuất khỏi tất cả
          </Button>
        </Section>
      </div>

      <Section title="API Keys & Webhooks">
        <EmptyState icon={<Key size={16} />} title="Chưa có API key trong DB" desc="API key thật sẽ được hiển thị sau khi backend key management được kết nối." />
      </Section>

      <Section title="Lịch sử đăng nhập">
        <EmptyState icon={<ClipboardList size={16} />} title="Chưa có lịch sử đăng nhập trong DB" desc="Không còn IP, thiết bị hoặc vị trí mẫu trong màn hình settings." />
      </Section>
    </div>
  );
}
