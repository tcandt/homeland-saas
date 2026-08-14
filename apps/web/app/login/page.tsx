"use client";
import React, { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import AuthInput from "@/components/auth/AuthInput";
import PasswordField from "@/components/auth/PasswordField";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api/auth.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import { ApiError } from "@/lib/api/client";
import { getLoginErrorMessage } from "@/lib/auth/login-errors";
import { clearPasswordChangePromptDeferral } from "@/lib/auth/password-change-prompt";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const setSession = useAuthStore((state) => state.setSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await authApi.login({ emailOrPhone, password });
      setSession({
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      clearPasswordChangePromptDeferral(response.user.id);
      window.location.href = "/";
    } catch (err: any) {
      setLoading(false);
      if (err instanceof ApiError) {
        setError(getLoginErrorMessage(err));
      } else {
        setError("Có lỗi kết nối máy chủ. Vui lòng thử lại sau.");
      }
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <div className="flex flex-col gap-[8px] mb-[32px]">
          <h1 className="text-[24px] font-black tracking-tight text-text">Đăng nhập</h1>
          <p className="text-[14px] font-medium text-muted">Đăng nhập để quản lý vận hành tòa nhà của bạn</p>
        </div>

        {error && (
          <div className="mb-[24px] p-[16px] rounded-[12px] bg-rose-500/10 border border-rose-500/20 flex items-start gap-[12px]">
            <AlertCircle size={18} className="text-rose-500 mt-[2px] shrink-0" />
            <span className="text-[13px] font-medium text-rose-500">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-[24px]">
          <AuthInput
            label="Email / Số điện thoại"
            type="text"
            placeholder="Nhập email hoặc SĐT..."
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            required
            disabled={loading}
            data-testid="login-email"
          />
          <PasswordField
            label="Mật khẩu"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            data-testid="login-password"
          />

          <div className="flex items-center justify-end mt-[-8px]">
            <Link href="/forgot-password" className="text-[13px] font-bold text-[#6366f1] hover:underline">
              Quên mật khẩu?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit"
            className="h-[48px] md:h-[52px] w-full rounded-[14px] bg-[#6366f1] text-white font-bold text-[15px] hover:bg-[#4f46e5] hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-[8px]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Đăng nhập"}
          </button>
        </form>

      </AuthCard>
    </AuthLayout>
  );
}
