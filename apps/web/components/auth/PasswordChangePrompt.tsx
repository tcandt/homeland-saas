"use client";

import React, { FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Clock3,
  KeyRound,
  ShieldCheck,
  X,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api/client";
import { authApi, type User } from "@/lib/api/auth.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  clearPasswordChangePromptDeferral,
  deferPasswordChangePrompt,
} from "@/lib/auth/password-change-prompt";

interface PasswordChangePromptProps {
  isOpen: boolean;
  user: User;
  onDeferred: () => void;
}

function passwordErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Không thể cập nhật mật khẩu. Vui lòng thử lại.";
  if (error.code === "AUTH_INVALID_CREDENTIALS") return "Mật khẩu hiện tại không chính xác.";
  if (error.code === "AUTH_PASSWORD_REUSED") return "Mật khẩu mới phải khác mật khẩu hiện tại.";
  return error.message || "Không thể cập nhật mật khẩu. Vui lòng thử lại.";
}

export default function PasswordChangePrompt({ isOpen, user, onDeferred }: PasswordChangePromptProps) {
  const updateTokens = useAuthStore((state) => state.updateTokens);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [isDeferring, setIsDeferring] = useState(false);
  const isBusy = isChanging || isDeferring;

  if (!isOpen || typeof document === "undefined") return null;

  const calculateStrength = () => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)) score += 1;
    if (newPassword.length >= 12 && /[^A-Za-z0-9]/.test(newPassword)) score += 1;
    return score;
  };

  const strengthScore = calculateStrength();
  const strengthLabels = ["Chưa nhập", "Mức yếu (cần ≥ 12 ký tự)", "Mức trung bình", "Mức mạnh & an toàn"];
  const strengthColors = ["bg-slate-200 dark:bg-slate-700", "bg-rose-500", "bg-amber-500", "bg-emerald-500"];

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < 12) {
      setError("Mật khẩu mới phải có ít nhất 12 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không trùng khớp.");
      return;
    }

    setIsChanging(true);
    try {
      await authApi.changePassword({ oldPassword, newPassword, confirmPassword });
      clearPasswordChangePromptDeferral(user.id);
      clearSession();
      toast.success("Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.");
      window.location.href = "/login";
    } catch (caught) {
      setError(passwordErrorMessage(caught));
      setIsChanging(false);
    }
  };

  const handleDefer = async () => {
    if (isBusy) return;
    setError("");
    setIsDeferring(true);
    try {
      const tokens = await authApi.deferPasswordChange();
      updateTokens(tokens);
      deferPasswordChangePrompt(user.id);
      onDeferred();
      toast("Bạn có thể đổi mật khẩu bất kỳ lúc nào trong phần Cài đặt.");
      window.location.reload();
    } catch (caught) {
      setError(passwordErrorMessage(caught));
      setIsDeferring(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-[100100] selection:bg-indigo-600 selection:text-white"
      data-testid="password-change-prompt"
    >
      {/* Dark Blur Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={handleDefer}
      />

      {/* Solid Opaque Premium Modal Card */}
      <div className="relative w-full max-w-[440px] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Slim Refined Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck size={16} />
            </div>
            <h2 className="text-sm sm:text-[15px] font-black tracking-tight text-slate-900 dark:text-white truncate">
              Bảo vệ tài khoản
            </h2>
          </div>

          <button
            type="button"
            onClick={handleDefer}
            disabled={isBusy}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Notice Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-50/90 dark:bg-amber-950/40 p-3 text-amber-950 dark:text-amber-100">
            <KeyRound size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-amber-900 dark:text-amber-200">Bạn đang dùng mật khẩu tạm.</p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 mt-0.5">
                Thiết lập mật khẩu riêng để bảo vệ dữ liệu và lịch sử vận hành của bạn.
              </p>
            </div>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 p-2.5 text-xs font-semibold text-rose-600 dark:text-rose-200 animate-in fade-in"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-500" />
              <div className="flex-1 leading-snug">{error}</div>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5">
            {/* Input 1: Old Password */}
            <div className="space-y-1">
              <label
                htmlFor="prompt-old-pass"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Mật khẩu tạm hiện tại
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  id="prompt-old-pass"
                  type={showOld ? "text" : "password"}
                  placeholder="Nhập mật khẩu tạm..."
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  disabled={isBusy}
                  autoComplete="current-password"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-950 pl-10 pr-10 font-mono text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowOld(!showOld)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Input 2: New Password */}
            <div className="space-y-1">
              <label
                htmlFor="prompt-new-pass"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Mật khẩu mới (tối thiểu 12 ký tự)
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <KeyRound size={15} />
                </div>
                <input
                  id="prompt-new-pass"
                  type={showNew ? "text" : "password"}
                  placeholder="Nhập mật khẩu mới..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                  disabled={isBusy}
                  autoComplete="new-password"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-950 pl-10 pr-10 font-mono text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength */}
              <div className="pt-1 space-y-1">
                <div className="flex gap-1.5 h-1">
                  {[0, 1, 2].map((idx) => (
                    <div
                      key={idx}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        strengthScore > idx ? strengthColors[strengthScore] : "bg-slate-200 dark:bg-slate-800"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between items-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  <span>Độ an toàn:</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {strengthLabels[strengthScore]}
                  </span>
                </div>
              </div>
            </div>

            {/* Input 3: Confirm Password */}
            <div className="space-y-1">
              <label
                htmlFor="prompt-confirm-pass"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  id="prompt-confirm-pass"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                  disabled={isBusy}
                  autoComplete="new-password"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-950 pl-10 pr-10 font-mono text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDefer}
                disabled={isBusy}
                className="inline-flex h-10 items-center justify-center gap-1.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-60"
              >
                <Clock3 size={15} />
                <span>Bỏ qua lúc này</span>
              </button>

              <button
                type="submit"
                disabled={isBusy}
                className="inline-flex h-10 items-center justify-center gap-2 px-5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-xs font-black text-white shadow-md shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
              >
                {isChanging ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-white" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={15} />
                    <span>Đổi mật khẩu</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
