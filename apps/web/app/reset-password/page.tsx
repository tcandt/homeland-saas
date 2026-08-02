"use client";
import React, { useState, Suspense } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import PasswordField from "@/components/auth/PasswordField";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { authApi } from "@/lib/api/auth.api";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Token không hợp lệ hoặc đã hết hạn.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await authApi.resetPassword({ token, newPassword: password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="flex flex-col items-center text-center gap-[16px] py-[32px]">
            <div className="w-[64px] h-[64px] rounded-full bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-[8px]">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-[24px] font-black tracking-tight text-text">Thành công!</h2>
            <p className="text-[14px] font-medium text-muted leading-relaxed">
              Mật khẩu của bạn đã được đặt lại thành công. Vui lòng đăng nhập lại với mật khẩu mới.
            </p>
            <Link
              href="/login"
              className="mt-[24px] h-[48px] md:h-[52px] w-full rounded-[14px] bg-[#6366f1] flex items-center justify-center text-[15px] font-bold text-white hover:bg-[#4f46e5] hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all"
            >
              Đăng nhập ngay
            </Link>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <div className="flex flex-col gap-[8px] mb-[32px]">
          <h1 className="text-[24px] font-black tracking-tight text-text">Đặt lại mật khẩu</h1>
          <p className="text-[14px] font-medium text-muted">Vui lòng nhập mật khẩu mới cho tài khoản của bạn.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[20px]">
          {error && (
            <div className="p-[16px] rounded-[12px] bg-rose-500/10 border border-rose-500/20 flex items-start gap-[12px]">
              <AlertCircle size={18} className="text-rose-500 mt-[2px] shrink-0" />
              <span className="text-[13px] font-medium text-rose-500">{error}</span>
            </div>
          )}
          <div className="flex flex-col gap-[4px]">
            <PasswordField
              label="Mật khẩu mới"
              placeholder="••••••••"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordStrength password={password} />
          </div>

          <PasswordField label="Xác nhận mật khẩu mới" placeholder="••••••••" required disabled={loading} />

          <button
            type="submit"
            disabled={loading}
            className="h-[48px] md:h-[52px] mt-[8px] w-full rounded-[14px] bg-[#6366f1] text-white font-bold text-[15px] hover:bg-[#4f46e5] hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-[8px]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Lưu mật khẩu mới"}
          </button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
