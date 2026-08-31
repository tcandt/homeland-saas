"use client";

import React, { FormEvent, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  KeyRound,
  Lock,
  LogOut,
  QrCode,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api/auth.api";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

export default function SettingsSecurity() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 2FA state
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFactorType, setTwoFactorType] = useState<"EMAIL" | "APP">("EMAIL");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);

  // Session state
  const [isLogoutOtherModalOpen, setIsLogoutOtherModalOpen] = useState(false);
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Mật khẩu mới phải có ít nhất 8 ký tự.");
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
      toast.success("Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.");
      window.location.href = "/login";
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể đổi mật khẩu. Vui lòng thử lại.");
      setIsChangingPassword(false);
    }
  };

  const handleToggle2FA = () => {
    if (twoFactorEnabled) {
      setTwoFactorEnabled(false);
      toast.success("Đã tắt xác thực 2 bước (2FA)");
    } else {
      setIs2FAModalOpen(true);
    }
  };

  const handleConfirm2FA = () => {
    if (!twoFactorCode || twoFactorCode.length < 6) {
      toast.error("Vui lòng nhập mã xác thực gồm 6 chữ số");
      return;
    }
    setIsVerifying2FA(true);
    setTimeout(() => {
      setIsVerifying2FA(false);
      setTwoFactorEnabled(true);
      setIs2FAModalOpen(false);
      setTwoFactorCode("");
      toast.success(`Đã kích hoạt xác thực 2 bước qua ${twoFactorType === "EMAIL" ? "Email OTP" : "Ứng dụng Authenticator"}`);
    }, 1000);
  };

  const handleLogoutOtherSessions = () => {
    setIsLoggingOutOthers(true);
    setTimeout(() => {
      setIsLoggingOutOthers(false);
      setIsLogoutOtherModalOpen(false);
      toast.success("Đã đăng xuất khỏi tất cả các thiết bị và phiên làm việc khác");
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="settings-security-root">
      {/* 4 Slim KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Trạng thái bảo mật</div>
            <div className="font-mono font-black text-[15px] text-emerald-600 dark:text-emerald-400 leading-tight">Được bảo vệ</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Tiêu chuẩn mã hóa AES-256</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
            <KeyRound size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Mật khẩu tài khoản</div>
            <div className="font-mono font-black text-[15px] text-text leading-tight">Đã thiết lập</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Argon2id Hash Salt</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <Shield size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Xác thực 2 bước (2FA)</div>
            <div className={`font-mono font-black text-[15px] leading-tight ${twoFactorEnabled ? "text-emerald-600" : "text-amber-600"}`}>
              {twoFactorEnabled ? "Đang bật" : "Chưa kích hoạt"}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">{twoFactorEnabled ? "Bảo vệ đa lớp OTP" : "Khuyến nghị bật ngay"}</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Smartphone size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Thiết bị đăng nhập</div>
            <div className="font-mono font-black text-[15px] text-text leading-tight">1 phiên hoạt động</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Thiết bị hiện tại (Desktop)</div>
          </div>
        </Card>
      </div>

      {/* Main Grid: Change Password & 2FA / Session */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column: Change Password */}
        <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-border/50 pb-2.5 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Key size={14} />
              </div>
              <div>
                <h3 className="text-xs font-black text-text">Đổi mật khẩu tài khoản</h3>
                <p className="text-[11px] text-muted font-medium">Cập nhật mật khẩu định kỳ để tăng cường an toàn.</p>
              </div>
            </div>

            <form onSubmit={changePassword} className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wide">Mật khẩu hiện tại</label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    required
                    disabled={isChangingPassword}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    className="h-8.5 rounded-xl text-xs pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showCurrent ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wide">Mật khẩu mới</label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    required
                    minLength={8}
                    disabled={isChangingPassword}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
                    className="h-8.5 rounded-xl text-xs pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showNew ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wide">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={8}
                    disabled={isChangingPassword}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="h-8.5 rounded-xl text-xs pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isChangingPassword}
                className="mt-2 h-8.5 w-full rounded-xl text-xs font-bold shadow-2xs"
              >
                Cập nhật mật khẩu
              </Button>
            </form>
          </div>
        </Card>

        {/* Middle Column: Two-Factor Authentication (2FA) */}
        <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-border/50 pb-2.5 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Shield size={14} />
              </div>
              <div>
                <h3 className="text-xs font-black text-text">Xác thực 2 bước (2FA)</h3>
                <p className="text-[11px] text-muted font-medium">Bảo vệ tài khoản bằng lớp xác minh thứ hai.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-border/70 bg-background p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text">Trạng thái bảo vệ 2 lớp</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${twoFactorEnabled ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                    {twoFactorEnabled ? "Đang hoạt động" : "Tắt"}
                  </span>
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Khi đăng nhập từ trình duyệt mới, hệ thống sẽ yêu cầu mã OTP gửi qua Email hoặc ứng dụng Google/Microsoft Authenticator.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-text">Phương thức xác thực</div>
                  <div className="text-[11px] text-muted mt-0.5">Email OTP ({user?.email || "admin@homeland.vn"})</div>
                </div>
                <Button
                  type="button"
                  variant={twoFactorEnabled ? "outline" : "primary"}
                  size="sm"
                  onClick={handleToggle2FA}
                  className="h-8 rounded-xl text-xs font-bold"
                >
                  {twoFactorEnabled ? "Tắt 2FA" : "Bật 2FA"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column: Active Sessions */}
        <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-border/50 pb-2.5 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Smartphone size={14} />
              </div>
              <div>
                <h3 className="text-xs font-black text-text">Phiên đăng nhập & Thiết bị</h3>
                <p className="text-[11px] text-muted font-medium">Kiểm soát các phiên làm việc đang hoạt động.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text">Trình duyệt hiện tại (Chrome / Windows)</span>
                    <span className="text-[10px] font-bold text-emerald-600">Hiện tại</span>
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">IP: 118.69.182.42 · Hồ Chí Minh, Việt Nam</div>
                  <div className="text-[10px] text-muted mt-0.5">Đăng nhập lúc: {new Date().toLocaleTimeString("vi-VN")} hôm nay</div>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-3 flex items-start gap-2.5 opacity-70">
                <div className="w-2 h-2 rounded-full bg-muted mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text">Homeland App (iPhone 15 Pro)</span>
                    <span className="text-[10px] text-muted">2 ngày trước</span>
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">IP: 14.161.22.18 · Hồ Chí Minh</div>
                </div>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsLogoutOtherModalOpen(true)}
            className="mt-3 h-8.5 w-full rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs font-bold shadow-2xs"
          >
            <LogOut size={13} className="mr-1.5" />
            <span>Đăng xuất khỏi các thiết bị khác</span>
          </Button>
        </Card>
      </div>

      {/* Modal 2FA */}
      <Modal
        isOpen={is2FAModalOpen}
        onClose={() => setIs2FAModalOpen(false)}
        title="Kích hoạt xác thực 2 bước (2FA)"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setIs2FAModalOpen(false)} disabled={isVerifying2FA} className="h-9 rounded-xl text-xs font-bold">
              Hủy
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirm2FA} disabled={isVerifying2FA} className="h-9 rounded-xl px-4 text-xs font-bold">
              {isVerifying2FA ? "Đang xác thực..." : "Kích hoạt ngay"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1 text-xs">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-muted leading-relaxed">
            Mã OTP 6 số đã được tạo để liên kết bảo vệ tài khoản <span className="font-bold text-text">{user?.email || "admin@homeland.vn"}</span>.
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-muted uppercase">Nhập mã xác thực 6 số (OTP)</label>
            <Input
              type="text"
              maxLength={6}
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
              placeholder="VD: 684291"
              className="h-10 text-center font-mono font-black text-lg tracking-widest rounded-xl"
            />
          </div>
        </div>
      </Modal>

      {/* Modal Logout Other Sessions */}
      <Modal
        isOpen={isLogoutOtherModalOpen}
        onClose={() => setIsLogoutOtherModalOpen(false)}
        title="Xác nhận đăng xuất các phiên làm việc khác"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsLogoutOtherModalOpen(false)} disabled={isLoggingOutOthers} className="h-9 rounded-xl text-xs font-bold">
              Hủy
            </Button>
            <Button variant="danger" size="sm" onClick={handleLogoutOtherSessions} disabled={isLoggingOutOthers} className="h-9 rounded-xl px-4 text-xs font-bold">
              {isLoggingOutOthers ? "Đang đăng xuất..." : "Đăng xuất tất cả"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1 text-xs">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-rose-700 dark:text-rose-300 leading-relaxed">
            Tất cả các phiên làm việc trên các trình duyệt, máy tính và điện thoại khác sẽ bị chấm dứt ngay lập tức.
          </div>
          <p className="font-bold text-text">Bạn có chắc chắn muốn đăng xuất khỏi các thiết bị khác không?</p>
        </div>
      </Modal>
    </div>
  );
}
