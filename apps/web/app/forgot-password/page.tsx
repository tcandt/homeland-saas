"use client";
import React, { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import AuthInput from "@/components/auth/AuthInput";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
              <MailCheck size={32} />
            </div>
            <h2 className="text-[24px] font-black tracking-tight text-text">Đã gửi hướng dẫn</h2>
            <p className="text-[14px] font-medium text-muted leading-relaxed">
              Nếu tài khoản tồn tại, hệ thống đã gửi một liên kết đặt lại mật khẩu đến email/số điện thoại của bạn. Vui lòng kiểm tra hộp thư.
            </p>
            <Link 
              href="/login"
              className="mt-[24px] h-[48px] px-[24px] rounded-[14px] bg-background border border-border flex items-center justify-center text-[14px] font-bold text-text hover:bg-black/5 transition-colors"
            >
              Quay lại đăng nhập
            </Link>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard>
        <Link href="/login" className="inline-flex items-center gap-[6px] text-[13px] font-bold text-muted hover:text-text transition-colors mb-[32px]">
          <ArrowLeft size={14} /> Quay lại
        </Link>
        
        <div className="flex flex-col gap-[8px] mb-[32px]">
          <h1 className="text-[24px] font-black tracking-tight text-text">Quên mật khẩu?</h1>
          <p className="text-[14px] font-medium text-muted">Nhập email hoặc số điện thoại của bạn, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[24px]">
          <AuthInput 
            label="Email / Số điện thoại" 
            type="text" 
            placeholder="Nhập email hoặc SĐT..." 
            required 
            disabled={loading}
          />
          
          <button 
            type="submit" 
            disabled={loading}
            className="h-[48px] md:h-[52px] w-full rounded-[14px] bg-[#6366f1] text-white font-bold text-[15px] hover:bg-[#4f46e5] hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-[8px]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Gửi hướng dẫn"}
          </button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
