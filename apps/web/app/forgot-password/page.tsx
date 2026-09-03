"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Loader2,
  AlertCircle,
  MailCheck,
  ShieldCheck,
  Sun,
  Moon,
} from "lucide-react";
import { authApi } from "@/lib/api/auth.api";
import BrandLogo from "@/components/ui/BrandLogo";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("homeland_login_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("homeland_login_theme", nextTheme);
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await authApi.forgotPassword({ email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
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

      {/* Subtle Studio Grid Pattern Overlay */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_75%_75%_at_50%_50%,#000_65%,transparent_100%)] opacity-80 ${
          isDark
            ? "bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"
            : "bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)]"
        }`}
      />

      {/* 2. CENTERED POPUP CARD */}
      <div className="relative z-10 w-full max-w-[430px]">
        {/* Glow Halo behind card */}
        <div
          aria-hidden="true"
          className={`absolute -inset-1 rounded-[36px] blur-xl transition-all duration-300 ${
            isDark
              ? "bg-gradient-to-b from-indigo-500/30 via-violet-500/15 to-transparent opacity-75"
              : "bg-gradient-to-b from-indigo-300/40 via-purple-300/20 to-transparent opacity-60"
          }`}
        />

        {/* The Card Body */}
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
              Quên mật khẩu?
            </h1>
            <p
              className={`mt-1 text-xs sm:text-[13px] font-medium ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Nhập email hoặc số điện thoại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn.
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

          {success ? (
            <div className="flex flex-col items-center text-center gap-4 py-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/10">
                <MailCheck size={32} />
              </div>
              <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Đã gửi hướng dẫn!
              </h2>
              <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Nếu tài khoản tồn tại, hệ thống đã gửi liên kết đặt lại mật khẩu đến thông tin bạn cung cấp. Vui lòng kiểm tra hộp thư.
              </p>
              <Link
                href="/login"
                className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-sm font-black text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="forgot-email-input"
                  className={`block text-[11px] font-bold uppercase tracking-wider ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Email / Số điện thoại
                </label>
                <div className="relative">
                  <div
                    className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <Mail size={16} />
                  </div>
                  <input
                    id="forgot-email-input"
                    type="text"
                    placeholder="Nhập email hoặc số điện thoại..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className={`h-12 w-full rounded-2xl pl-10 pr-4 text-sm font-semibold selection:bg-indigo-600 selection:text-white transition-all focus:outline-none focus:ring-4 disabled:opacity-60 ${
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
                  disabled={loading}
                  className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-sm font-black tracking-wide text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-indigo-600/50 hover:shadow-xl active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-white" />
                      <span>Đang gửi yêu cầu...</span>
                    </>
                  ) : (
                    <span>Gửi hướng dẫn đặt lại</span>
                  )}
                </button>
              </div>

              {/* Back to Login Link */}
              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-indigo-600"
                  }`}
                >
                  <ArrowLeft size={14} />
                  <span>Quay lại trang Đăng nhập</span>
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
