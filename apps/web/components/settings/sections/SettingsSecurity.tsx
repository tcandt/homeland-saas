"use client";

import React, { FormEvent, useEffect, useState } from "react";
import {
  Clock,
  Eye,
  EyeOff,
  Key,
  KeyRound,
  LogOut,
  Save,
  Shield,
  ShieldCheck,
  Smartphone,
  Timer,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api/auth.api";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

function formatTimeoutLabel(minutes: number): string {
  if (!minutes || minutes <= 0) return "24 giờ";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    if (hours >= 24 && hours % 24 === 0) {
      const days = hours / 24;
      return `${days} ngày (${hours}h)`;
    }
    return `${hours} giờ`;
  }
  return `${hours}h ${remainingMinutes}p`;
}

export default function SettingsSecurity() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const updateTokens = useAuthStore((state) => state.updateTokens);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 2FA state
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorTargetEnabled, setTwoFactorTargetEnabled] = useState(true);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [isRequesting2FA, setIsRequesting2FA] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);

  // Session state
  const [isLogoutOtherModalOpen, setIsLogoutOtherModalOpen] = useState(false);
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);

  // Session Idle Timeout state (in minutes)
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState<number>(1440);
  const [customMinutes, setCustomMinutes] = useState<string>("1440");

  useEffect(() => {
    let active = true;
    void authApi.security()
      .then((settings) => {
        if (!active) return;
        setTwoFactorEnabled(settings.twoFactorEnabled);
        setIdleTimeoutMinutes(settings.idleTimeoutMinutes);
        setCustomMinutes(String(settings.idleTimeoutMinutes));
        localStorage.setItem("homeland_session_idle_timeout_minutes", String(settings.idleTimeoutMinutes));
        window.dispatchEvent(new CustomEvent("homeland:session-timeout-updated"));
      })
      .catch((error) => {
        if (active) toast.error(error instanceof ApiError ? error.message : "Không thể tải cấu hình bảo mật.");
      });
    return () => {
      active = false;
    };
  }, []);

  const saveTimeout = async (minutes: number) => {
    if (minutes <= 0) {
      toast.error("Thời gian giữ phiên phải lớn hơn 0 phút");
      return;
    }
    try {
      const settings = await authApi.updateSecurity({ idleTimeoutMinutes: minutes });
      setIdleTimeoutMinutes(settings.idleTimeoutMinutes);
      setCustomMinutes(String(settings.idleTimeoutMinutes));
      localStorage.setItem("homeland_session_idle_timeout_minutes", String(minutes));
      window.dispatchEvent(new CustomEvent("homeland:session-timeout-updated"));
      toast.success(`Đã lưu thời gian giữ phiên: ${formatTimeoutLabel(minutes)} (${minutes} phút)`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể lưu thời gian giữ phiên.");
    }
  };

  const handleSaveTimeout = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customMinutes.trim(), 10);
    if (isNaN(val) || val <= 0) {
      toast.error("Vui lòng nhập số phút hợp lệ (ví dụ: 15, 30, 60, 120, 1440...)");
      return;
    }
    void saveTimeout(val);
  };

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
      toast.success("Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.");
      window.location.href = "/login";
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể đổi mật khẩu. Vui lòng thử lại.");
      setIsChangingPassword(false);
    }
  };

  const handleToggle2FA = async () => {
    const enabled = !twoFactorEnabled;
    setIsRequesting2FA(true);
    try {
      await authApi.requestTwoFactorChange({ enabled });
      setTwoFactorTargetEnabled(enabled);
      setTwoFactorCode("");
      setIs2FAModalOpen(true);
      toast.success("Mã OTP đã được gửi tới email tài khoản.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể gửi mã OTP.");
    } finally {
      setIsRequesting2FA(false);
    }
  };

  const handleConfirm2FA = async () => {
    if (!twoFactorCode || twoFactorCode.length < 6) {
      toast.error("Vui lòng nhập mã xác thực gồm 6 chữ số");
      return;
    }
    setIsVerifying2FA(true);
    try {
      const result = await authApi.confirmTwoFactorChange({ enabled: twoFactorTargetEnabled, code: twoFactorCode });
      setTwoFactorEnabled(result.twoFactorEnabled);
      setIs2FAModalOpen(false);
      setTwoFactorCode("");
      toast.success(result.twoFactorEnabled ? "Đã bật xác thực 2 bước qua Email OTP" : "Đã tắt xác thực 2 bước");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể xác nhận mã OTP.");
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleLogoutOtherSessions = async () => {
    setIsLoggingOutOthers(true);
    try {
      const session = await authApi.logoutOtherSessions();
      updateTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
      setIsLogoutOtherModalOpen(false);
      toast.success("Đã thu hồi tất cả phiên cũ; thiết bị hiện tại vẫn đăng nhập.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể thu hồi các phiên cũ.");
    } finally {
      setIsLoggingOutOthers(false);
    }
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
            <div className="text-[10px] text-muted truncate mt-0.5">JWT thu hồi được + Email OTP</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
            <KeyRound size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Mật khẩu tài khoản</div>
            <div className="font-mono font-black text-[15px] text-text leading-tight">Đã thiết lập</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Bcrypt có salt</div>
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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Clock size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Thời gian giữ phiên</div>
            <div className="font-mono font-black text-[15px] text-text leading-tight truncate">{formatTimeoutLabel(idleTimeoutMinutes)}</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Tự động ngắt khi không thao tác</div>
          </div>
        </Card>
      </div>

      {/* Session Inactivity Timeout Configuration Card */}
      <Card className="rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-500/20">
              <Timer size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-black text-text">Thời gian giữ phiên đăng nhập (Inactivity Timeout)</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                  Đang áp dụng: {formatTimeoutLabel(idleTimeoutMinutes)} ({idleTimeoutMinutes} phút)
                </span>
              </div>
              <p className="text-[11px] text-muted font-medium mt-0.5">
                Hệ thống duy trì trạng thái đăng nhập khi làm việc. Tự động kết thúc phiên an toàn sau số phút không hoạt động đã thiết lập.
              </p>
            </div>
          </div>

          {/* Clean Minute Input & Save Button (No Stepper / Spin buttons) */}
          <form onSubmit={handleSaveTimeout} className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value.replace(/\D/g, ""))}
                placeholder="VD: 30"
                aria-label="Số phút giữ phiên"
                className="h-9 w-32 rounded-xl text-xs font-mono font-bold pl-3 pr-11 text-left bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all shadow-xs"
              />
              <span className="absolute right-3 text-[11px] text-muted font-semibold pointer-events-none select-none">phút</span>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="h-9 rounded-xl px-4 text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={14} />
              <span>Lưu</span>
            </Button>
          </form>
        </div>
      </Card>

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
                    data-testid="settings-current-password"
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
                    minLength={12}
                    disabled={isChangingPassword}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mật khẩu mới (tối thiểu 12 ký tự)"
                    data-testid="settings-new-password"
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
                    minLength={12}
                    disabled={isChangingPassword}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    data-testid="settings-confirm-password"
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
                data-testid="settings-change-password-submit"
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
                  Khi đăng nhập, hệ thống yêu cầu mã OTP 6 số được gửi tới email tài khoản và hết hạn sau 5 phút.
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
                  disabled={isRequesting2FA}
                  className="h-8 rounded-xl text-xs font-bold"
                >
                  {isRequesting2FA ? "Đang gửi OTP..." : twoFactorEnabled ? "Tắt 2FA" : "Bật 2FA"}
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
                    <span className="text-xs font-bold text-text">Phiên đăng nhập hiện tại</span>
                    <span className="text-[10px] font-bold text-emerald-600">Hiện tại</span>
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">Phiên này sẽ được cấp token mới khi thu hồi các phiên cũ.</div>
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
        title={twoFactorTargetEnabled ? "Kích hoạt xác thực 2 bước (2FA)" : "Tắt xác thực 2 bước (2FA)"}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setIs2FAModalOpen(false)} disabled={isVerifying2FA} className="h-9 rounded-xl text-xs font-bold">
              Hủy
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirm2FA} disabled={isVerifying2FA} className="h-9 rounded-xl px-4 text-xs font-bold">
              {isVerifying2FA ? "Đang xác thực..." : twoFactorTargetEnabled ? "Kích hoạt ngay" : "Xác nhận tắt"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1 text-xs">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-muted leading-relaxed">
            Mã OTP 6 số đã được gửi tới <span className="font-bold text-text">{user?.email || "email tài khoản"}</span> để xác nhận {twoFactorTargetEnabled ? "bật" : "tắt"} 2FA.
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
              {isLoggingOutOthers ? "Đang thu hồi..." : "Thu hồi phiên cũ"}
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
