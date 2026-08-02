import React from "react";
import AuthBrandPanel from "./AuthBrandPanel";

import { Building2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:grid lg:grid-cols-[40%_60%] xl:grid-cols-[42%_58%]">
      {/* Brand Panel (Desktop) */}
      <AuthBrandPanel />

      {/* Auth Form Area */}
      <div className="flex-1 flex flex-col lg:justify-center items-center px-[20px] py-[32px] md:p-[40px] pb-[max(20px,env(safe-area-inset-bottom))] lg:pb-[40px] overflow-x-hidden">
        
        {/* Mobile/Tablet Portrait Header */}
        <div className="lg:hidden w-full max-w-[520px] flex flex-col items-center text-center mb-[32px] pt-[20px]">
          <div className="w-[48px] h-[48px] bg-[#6366f1] rounded-[14px] flex items-center justify-center text-white shadow-sm mb-[16px]">
            <Building2 size={28} />
          </div>
          <h2 className="text-[24px] font-black text-text tracking-tight">HomeLand<span className="text-[#6366f1]">.</span></h2>
          <p className="text-[14px] font-medium text-muted mt-[8px]">Nền tảng quản lý vận hành tòa nhà toàn diện</p>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-[520px] xl:max-w-[420px] w-full shrink-0">
          {children}
        </div>

        {/* Mobile/Tablet Portrait Footer */}
        <div className="lg:hidden w-full max-w-[520px] mt-[48px] pt-[32px] border-t border-border flex flex-col gap-[16px]">
          <div className="flex items-center gap-[12px]">
            <div className="w-[32px] h-[32px] rounded-[10px] bg-card border border-border flex items-center justify-center text-[#6366f1]">
              <Building2 size={16} />
            </div>
            <span className="text-[13px] font-bold text-text">Quản lý tòa nhà thông minh</span>
          </div>
          <div className="flex items-center gap-[12px]">
            <div className="w-[32px] h-[32px] rounded-[10px] bg-card border border-border flex items-center justify-center text-[#8b5cf6]">
              <Building2 size={16} />
            </div>
            <span className="text-[13px] font-bold text-text">Tự động hóa tài chính & công nợ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
