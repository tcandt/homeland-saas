"use client";
import React, { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import PasswordField from "@/components/auth/PasswordField";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Dummy API call
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1500);
  };

  if (success) {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="flex flex-col items-center text-center gap-[16px] py-[32px]">
            <div className="w-[64px] h-[64px] rounded-full bg-[#10b981]/10 flex items-center justify-center text-[#10b981] mb-[8px]">
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
          
          <PasswordField 
            label="Xác nhận mật khẩu mới" 
            placeholder="••••••••" 
            required 
            disabled={loading} 
          />

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
