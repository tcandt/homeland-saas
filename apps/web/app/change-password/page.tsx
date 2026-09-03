"use client";

import React, { FormEvent, useState, useEffect } from "react";
import { AlertCircle, KeyRound, Loader2, Lock, Eye, EyeOff, ShieldCheck, Sun, Moon, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import BrandLogo from "@/components/ui/BrandLogo";

export default function ChangePasswordPage() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("homeland_login_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("homeland_login_theme", nextTheme);
    } catch {
      // Ignore
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    setIsSubmitting(true);
    try {
      await authApi.changePassword({ oldPassword, newPassword, confirmPassword });
      clearSession();
      toast.success("Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.");
      router.replace("/login");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không thể đổi mật khẩu. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  };

  const isDark = theme === "dark";

  return (
    <div
      className={`relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden transition-colors duration-300 selection:bg-indigo-600 selection:text-white ${
        isDark
          ? "bg-slate-950 text-slate-100"
          : "bg-gradient-to-br from-slate-100 via-indigo-50/40 to-slate-200/80 text-slate-900"
      }`}
    >
      {/* Autofill CSS */}
      <style jsx global>{`
        input::selection {
          background-color: #4f46e5 !important;
          color: #ffffff !important;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: ${isDark ? "#f8fafc" : "#0f172a"} !important;
          -webkit-box-shadow: 0 0 0px 1000px ${isDark ? "#020617" : "#ffffff"} inset !important;
          caret-color: ${isDark ? "#ffffff" : "#0f172a"} !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* Atmospheric backgrounds */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-[130px] animate-pulse transition-opacity duration-500 ${
          isDark
            ? "bg-gradient-to-tr from-indigo-600/30 via-purple-600/25 to-pink-500/10 opacity-100"
            : "bg-gradient-to-tr from-indigo-400/25 via-purple-400/20 to-pink-400/10 opacity-70"
        }`}
        style={{ animationDuration: "8s" }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full blur-[140px] transition-opacity duration-500 ${
          isDark
            ? "bg-gradient-to-bl from-violet-600/30 via-indigo-600/20 to-cyan-500/15 opacity-100"
            : "bg-gradient-to-bl from-violet-400/25 via-indigo-300/20 to-cyan-300/15 opacity-70"
        }`}
      />

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_75%_75%_at_50%_50%,#000_65%,transparent_100%)] opacity-80 ${
          isDark
            ? "bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
            : "bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)]"
        }`}
      />

      {/* Centered Popup Card */}
      <div className="relative z-10 w-full max-w-[440px]">
        <div
          aria-hidden="true"
          className={`absolute -inset-1 rounded-[36px] blur-xl transition-all duration-300 ${
            isDark
              ? "bg-gradient-to-b from-indigo-500/30 via-violet-500/15 to-transparent opacity-75"
              : "bg-gradient-to-b from-indigo-300/40 via-purple-300/20 to-transparent opacity-60"
          }`}
        />

        <div
          className={`relative rounded-[32px] p-7 sm:p-9 backdrop-blur-2xl transition-all duration-300 ${
            isDark
              ? "border border-white/15 bg-slate-900/85 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_50px_rgba(99,102,241,0.15)]"
              : "border border-white/80 bg-white/90 shadow-[0_20px_50px_-12px_rgba(99,102,241,0.15),0_4px_25px_rgba(0,0,0,0.06)]"
          }`}
        >
          {/* Top edge highlight */}
          <div
            aria-hidden="true"
            className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/80 to-transparent"
          />

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Chuyển đổi giao diện sáng / tối"
            title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
            className={`absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-30 flex h-10 w-10 items-center justify-center rounded-2xl border transition-all duration-150 cursor-pointer select-none shadow-sm ${
              isDark
                ? "border-white/20 bg-slate-800/90 text-amber-400 hover:bg-slate-700 hover:border-white/40 hover:text-amber-300 hover:scale-105 active:scale-95"
                : "border-slate-300/80 bg-white/95 text-indigo-600 hover:bg-slate-50 hover:border-indigo-400 hover:text-indigo-700 hover:scale-105 active:scale-95"
            }`}
          >
            {isDark ? (
              <Sun size={18} className="pointer-events-none transition-transform" />
            ) : (
              <Moon size={18} className="pointer-events-none transition-transform" />
            )}
          </button>

          {/* Brand Header */}
          <div className="relative mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex items-center justify-center">
              <BrandLogo size="lg" variant="horizontal" theme={isDark ? "dark" : "light"} showTagline={true} />
            </div>

            <h1
              className={`mt-2 text-2xl font-black tracking-tight sm:text-[26px] ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Thiết lập mật khẩu mới
            </h1>
            <p
              className={`mt-1 text-xs sm:text-[13px] font-medium ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Đây là lần đăng nhập đầu tiên. Vui lòng thay đổi mật khẩu tạm trước khi tiếp tục.
            </p>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/15 p-3.5 text-xs font-semibold text-rose-600 dark:text-rose-200 backdrop-blur-md animate-in fade-in"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-500 dark:text-rose-400" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input: Old Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="change-old-pass"
                className={`block text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Mật khẩu tạm hiện tại
              </label>
              <div className="relative">
                <div
                  className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  <KeyRound size={16} />
                </div>
                <input
                  id="change-old-pass"
                  type={showOld ? "text" : "password"}
                  placeholder="Nhập mật khẩu tạm..."
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  autoComplete="current-password"
                  className={`h-12 w-full rounded-2xl pl-10 pr-11 font-mono text-sm font-semibold selection:bg-indigo-600 selection:text-white transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
                    isDark
                      ? "border border-white/10 bg-slate-950/70 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-slate-950/95 focus:ring-indigo-500/20"
                      : "border border-slate-200/90 bg-slate-50/90 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:ring-indigo-500/15 shadow-2xs"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showOld ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowOld(!showOld)}
                  className={`absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors ${
                    isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {showOld ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Input: New Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="change-new-pass"
                className={`block text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Mật khẩu mới (tối thiểu 12 ký tự)
              </label>
              <div className="relative">
                <div
                  className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  <Lock size={16} />
                </div>
                <input
                  id="change-new-pass"
                  type={showNew ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  className={`h-12 w-full rounded-2xl pl-10 pr-11 font-mono text-sm font-semibold selection:bg-indigo-600 selection:text-white transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
                    isDark
                      ? "border border-white/10 bg-slate-950/70 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-slate-950/95 focus:ring-indigo-500/20"
                      : "border border-slate-200/90 bg-slate-50/90 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:ring-indigo-500/15 shadow-2xs"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showNew ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShowNew(!showNew)}
                  className={`absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors ${
                    isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Input: Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="change-confirm-pass"
                className={`block text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <div
                  className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  <Lock size={16} />
                </div>
                <input
                  id="change-confirm-pass"
                  type={showNew ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={12}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  className={`h-12 w-full rounded-2xl pl-10 pr-4 font-mono text-sm font-semibold selection:bg-indigo-600 selection:text-white transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
                    isDark
                      ? "border border-white/10 bg-slate-950/70 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-slate-950/95 focus:ring-indigo-500/20"
                      : "border border-slate-200/90 bg-slate-50/90 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:ring-indigo-500/15 shadow-2xs"
                  }`}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-sm font-black tracking-wide text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-indigo-600/50 hover:shadow-xl active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Đang cập nhật mật khẩu...</span>
                  </>
                ) : (
                  <>
                    <span>Lưu mật khẩu mới & Đăng nhập</span>
                    <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security & Cloud Badge Footer */}
        <div className="mt-6 flex flex-col items-center justify-center gap-2 text-center">
          <div
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Bảo mật 256-bit SSL • Chuẩn vận hành đám mây</span>
          </div>
          <p
            className={`text-[11px] font-medium ${
              isDark ? "text-slate-600" : "text-slate-400"
            }`}
          >
            © 2026 HomeLand Smart Building Operations. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
