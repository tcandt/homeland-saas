"use client";
import React, { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import AuthInput from "@/components/auth/AuthInput";
import PasswordField from "@/components/auth/PasswordField";
import PasswordStrength from "@/components/auth/PasswordStrength";
import AuthFooter from "@/components/auth/AuthFooter";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api/auth.api";

export default function RegisterPage() {
  if (process.env.NEXT_PUBLIC_ALLOW_REGISTRATION !== "true") {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="py-[20px] text-center">
            <h1 className="text-[22px] font-black text-text">Đăng ký đang đóng</h1>
            <p className="mt-[8px] text-[13px] font-medium leading-[20px] text-muted">
              Tài khoản được cấp bởi quản trị viên hệ thống.
            </p>
            <a href="/login" className="mt-[20px] inline-flex h-[44px] items-center justify-center rounded-[8px] bg-primary px-[18px] text-[13px] font-bold text-white">
              Về trang đăng nhập
            </a>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

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

  if (success) {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="flex flex-col items-center text-center gap-[16px] py-[32px]">
            <div className="w-[64px] h-[64px] rounded-full bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-[8px]">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-[24px] font-black tracking-tight text-text">Tạo tài khoản thành công!</h2>
            <p className="text-[14px] font-medium text-muted max-w-[300px]">
              Tài khoản của bạn đã được thiết lập. Đang chuyển hướng vào hệ thống...
            </p>
            <Loader2 size={24} className="animate-spin text-muted mt-[16px]" />
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <div className="flex flex-col gap-[8px] mb-[32px]">
          <h1 className="text-[24px] font-black tracking-tight text-text">Tạo tài khoản mới</h1>
          <p className="text-[14px] font-medium text-muted">Bắt đầu quản lý tòa nhà chuyên nghiệp với HomeLand.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[20px]">
          {error && (
            <div className="p-[16px] rounded-[12px] bg-rose-500/10 border border-rose-500/20 flex items-start gap-[12px]">
              <AlertCircle size={18} className="text-rose-500 mt-[2px] shrink-0" />
              <span className="text-[13px] font-medium text-rose-500">{error}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
            <AuthInput label="Họ và tên" placeholder="Nguyễn Văn A" required disabled={loading} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <AuthInput label="Số điện thoại" placeholder="0901234567" required disabled={loading} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <AuthInput label="Email" type="email" placeholder="name@company.com" required disabled={loading} value={email} onChange={(e) => setEmail(e.target.value)} />

          <div className="flex flex-col gap-[4px]">
            <PasswordField
              label="Mật khẩu"
              placeholder="••••••••"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordStrength password={password} />
          </div>

          <PasswordField label="Xác nhận mật khẩu" placeholder="••••••••" required disabled={loading} />

          <label className="flex items-start gap-[12px] cursor-pointer group mt-[4px]">
            <input type="checkbox" required className="w-[16px] h-[16px] mt-[2px] rounded-[4px] border-border text-[#6366f1] focus:ring-[#6366f1] transition-all" />
            <span className="text-[13px] font-medium text-muted group-hover:text-text transition-colors leading-relaxed">
              Tôi đồng ý với <a href="#" className="text-[#6366f1] hover:underline">Điều khoản dịch vụ</a> và <a href="#" className="text-[#6366f1] hover:underline">Chính sách bảo mật</a> của HomeLand.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="h-[48px] md:h-[52px] mt-[8px] w-full rounded-[14px] bg-[#6366f1] text-white font-bold text-[15px] hover:bg-[#4f46e5] hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-[8px]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Tạo tài khoản"}
          </button>
        </form>

        <AuthFooter text="Đã có tài khoản?" linkText="Đăng nhập" href="/login" />
      </AuthCard>
    </AuthLayout>
  );
}
