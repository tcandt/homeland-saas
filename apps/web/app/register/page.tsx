"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Sun,
  Moon,
  ArrowRight,
} from "lucide-react";
import { authApi } from "@/lib/api/auth.api";
import { settingsApi } from "@/lib/api/settings.api";
import BrandLogo from "@/components/ui/BrandLogo";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
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

    settingsApi
      .getPublicAccessControl()
      .then((state) => setRegistrationEnabled(state.registrationEnabled))
      .catch(() => setRegistrationEnabled(process.env.NEXT_PUBLIC_ALLOW_REGISTRATION === "true"));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (!termsAccepted) {
      setError("Vui lòng đồng ý với Điều khoản và Chính sách của hệ thống.");
      return;
    }

    setLoading(true);

    try {
      await authApi.register({ fullName, phone, email, password });
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Có lỗi xảy ra khi tạo tài khoản. Vui lòng thử lại.");
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
      {/* Autofill & Selection High Contrast CSS */}
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

      {/* 1. ATMOSPHERIC BACKGROUND EFFECTS */}
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

      {/* Subtle Grid */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_75%_75%_at_50%_50%,#000_65%,transparent_100%)] opacity-80 ${
          isDark
            ? "bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
            : "bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)]"
        }`}
      />

      {/* 2. CENTERED POPUP CARD */}
      <div className="relative z-10 w-full max-w-[480px]">
        {/* Glow Halo */}
        <div
          aria-hidden="true"
          className={`absolute -inset-1 rounded-[36px] blur-xl transition-all duration-300 ${
            isDark
              ? "bg-gradient-to-b from-indigo-500/30 via-violet-500/15 to-transparent opacity-75"
              : "bg-gradient-to-b from-indigo-300/40 via-purple-300/20 to-transparent opacity-60"
          }`}
        />

        {/* Card Body */}
        <div
          className={`relative rounded-[32px] p-7 sm:p-9 backdrop-blur-2xl transition-all duration-300 ${
            isDark
              ? "border border-white/15 bg-slate-900/85 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_50px_rgba(99,102,241,0.15)]"
              : "border border-white/80 bg-white/90 shadow-[0_20px_50px_-12px_rgba(99,102,241,0.15),0_4px_25px_rgba(0,0,0,0.06)]"
          }`}
        >
          {/* Top Edge Specular */}
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
              Đăng ký tài khoản mới
            </h1>
            <p
              className={`mt-1 text-xs sm:text-[13px] font-medium ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Nền tảng quản lý vận hành tòa nhà & tài chính thông minh
            </p>
          </div>

          {/* Checking Status */}
          {registrationEnabled === null ? (
            <div className="flex items-center justify-center gap-2.5 py-12 text-sm font-bold text-muted">
              <Loader2 size={20} className="animate-spin text-indigo-500" />
              <span>Đang kiểm tra quyền đăng ký...</span>
            </div>
          ) : !registrationEnabled ? (
            <div className="py-6 text-center animate-in fade-in">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3">
                <ShieldCheck size={28} />
              </div>
              <h2 className={`text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Đăng ký hiện đang đóng
              </h2>
              <p className={`mt-1.5 text-xs sm:text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Tài khoản mới chỉ được cấp bởi Quản trị viên hệ thống.
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex h-11 items-center justify-center px-6 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-xs font-black text-white shadow-md shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                Về trang Đăng nhập
              </Link>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center text-center gap-4 py-6 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 size={32} />
              </div>
              <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Đăng ký thành công!
              </h2>
              <p className={`text-xs sm:text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Tài khoản của bạn đã được khởi tạo. Đang chuyển hướng về trang đăng nhập...
              </p>
              <Loader2 size={22} className="animate-spin text-indigo-500 mt-2" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Error Box */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/15 p-3 text-xs font-semibold text-rose-600 dark:text-rose-200 backdrop-blur-md animate-in fade-in"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-500 dark:text-rose-400" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </div>
              )}

              {/* Row: Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="reg-name"
                    className={`block text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Họ và tên
                  </label>
                  <div className="relative">
                    <div
                      className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      <User size={15} />
                    </div>
                    <input
                      id="reg-name"
                      type="text"
                      placeholder="Nguyễn Văn A"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={loading}
                      className={`h-11 w-full rounded-2xl pl-9 pr-3 text-xs font-semibold transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
                        isDark
                          ? "border border-white/10 bg-slate-950/70 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-slate-950/95 focus:ring-indigo-500/20"
                          : "border border-slate-200/90 bg-slate-50/90 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:ring-indigo-500/15 shadow-2xs"
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="reg-phone"
                    className={`block text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <div
                      className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      <Phone size={15} />
                    </div>
                    <input
                      id="reg-phone"
                      type="tel"
                      placeholder="0901234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      disabled={loading}
                      className={`h-11 w-full rounded-2xl pl-9 pr-3 text-xs font-semibold transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
                        isDark
                          ? "border border-white/10 bg-slate-950/70 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-slate-950/95 focus:ring-indigo-500/20"
                          : "border border-slate-200/90 bg-slate-50/90 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:ring-indigo-500/15 shadow-2xs"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-email"
                  className={`block text-[11px] font-bold uppercase tracking-wider ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Email
                </label>
                <div className="relative">
                  <div
                    className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <Mail size={15} />
                  </div>
                  <input
                    id="reg-email"
                    type="email"
                    placeholder="admin@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className={`h-11 w-full rounded-2xl pl-9 pr-3 text-xs font-semibold transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
                      isDark
                        ? "border border-white/10 bg-slate-950/70 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-slate-950/95 focus:ring-indigo-500/20"
                        : "border border-slate-200/90 bg-slate-50/90 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:ring-indigo-500/15 shadow-2xs"
                    }`}
                  />
                </div>
              </div>

              {/* Row: Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="reg-pass"
                    className={`block text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <div
                      className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      <Lock size={15} />
                    </div>
                    <input
                      id="reg-pass"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className={`h-11 w-full rounded-2xl pl-9 pr-8 font-mono text-xs font-semibold transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
                        isDark
                          ? "border border-white/10 bg-slate-950/70 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-slate-950/95 focus:ring-indigo-500/20"
                          : "border border-slate-200/90 bg-slate-50/90 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:ring-indigo-500/15 shadow-2xs"
                      }`}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="reg-confirm-pass"
                    className={`block text-[11px] font-bold uppercase tracking-wider ${
                      isDark ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative">
                    <div
                      className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      <Lock size={15} />
                    </div>
                    <input
                      id="reg-confirm-pass"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className={`h-11 w-full rounded-2xl pl-9 pr-3 font-mono text-xs font-semibold transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
                        isDark
                          ? "border border-white/10 bg-slate-950/70 text-white placeholder-slate-500 focus:border-indigo-500 focus:bg-slate-950/95 focus:ring-indigo-500/20"
                          : "border border-slate-200/90 bg-slate-50/90 text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:ring-indigo-500/15 shadow-2xs"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className={`h-4 w-4 mt-0.5 rounded-md text-indigo-600 accent-indigo-600 focus:ring-indigo-500/30 ${
                      isDark ? "border-white/20 bg-slate-950/60" : "border-slate-300 bg-white"
                    }`}
                  />
                  <span
                    className={`text-[11px] leading-relaxed transition-colors ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    Tôi đồng ý với{" "}
                    <span className="text-indigo-500 dark:text-indigo-400 font-bold hover:underline">
                      Điều khoản dịch vụ
                    </span>{" "}
                    và{" "}
                    <span className="text-indigo-500 dark:text-indigo-400 font-bold hover:underline">
                      Chính sách bảo mật
                    </span>{" "}
                    của HomeLand.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-sm font-black tracking-wide text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-indigo-600/50 hover:shadow-xl active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-white" />
                      <span>Đang tạo tài khoản...</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng ký tài khoản</span>
                      <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>

              {/* Already have an account */}
              <div className="pt-2 text-center">
                <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Đã có tài khoản?{" "}
                </span>
                <Link
                  href="/login"
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Đăng nhập ngay
                </Link>
              </div>
            </form>
          )}
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
