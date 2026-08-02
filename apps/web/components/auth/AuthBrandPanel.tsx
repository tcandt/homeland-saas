import React from "react";
import { Building2, LineChart, FileSignature, CheckCircle2, AlertCircle } from "lucide-react";

export default function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-card border-r border-border p-[40px] xl:p-[64px] relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-[#6366f1]/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      
      {/* Header */}
      <div className="relative z-10 flex flex-col gap-[24px]">
        <div className="flex items-center gap-[12px]">
          <div className="w-[40px] h-[40px] bg-[#6366f1] rounded-[12px] flex items-center justify-center text-white shadow-sm">
            <Building2 size={24} />
          </div>
          <span className="text-[22px] font-black tracking-tight text-text">HomeLand<span className="text-[#6366f1]">.</span></span>
        </div>
        <div className="flex flex-col gap-[12px]">
          <h1 className="text-[32px] xl:text-[40px] font-black text-text leading-[1.1] tracking-tight">
            Nền tảng quản lý<br/>
            vận hành tòa nhà<br/>
            <span className="text-[#6366f1]">toàn diện.</span>
          </h1>
          <p className="text-[15px] text-muted font-medium max-w-[360px] leading-relaxed">
            Tối ưu hóa quy trình, tự động hóa tài chính và nâng cao trải nghiệm khách thuê.
          </p>
        </div>
      </div>

      {/* Dashboard Preview Mockup */}
      <div className="relative z-10 my-[40px] flex-1 flex flex-col justify-center">
        <div className="w-full bg-white rounded-[20px] border border-border shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex flex-col">
          {/* Mini Top Bar */}
          <div className="h-[48px] border-b border-border flex items-center px-[16px] justify-between bg-black/5 dark:bg-white/5">
            <div className="w-[120px] h-[12px] rounded-full bg-border"></div>
            <div className="flex gap-[8px]">
              <div className="w-[24px] h-[24px] rounded-full bg-border"></div>
              <div className="w-[24px] h-[24px] rounded-full bg-[#6366f1]/20"></div>
            </div>
          </div>
          
          <div className="p-[20px] flex flex-col gap-[20px] bg-background">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-[12px]">
              <div className="bg-card rounded-[12px] border border-border p-[12px] flex flex-col gap-[8px]">
                <div className="w-[20px] h-[20px] rounded-[6px] bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1]">
                  <LineChart size={12} />
                </div>
                <div className="w-[60px] h-[8px] rounded-full bg-border"></div>
                <div className="w-[80px] h-[12px] rounded-full bg-text mt-[4px]"></div>
              </div>
              <div className="bg-card rounded-[12px] border border-border p-[12px] flex flex-col gap-[8px]">
                <div className="w-[20px] h-[20px] rounded-[6px] bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6]">
                  <CheckCircle2 size={12} />
                </div>
                <div className="w-[60px] h-[8px] rounded-full bg-border"></div>
                <div className="w-[70px] h-[12px] rounded-full bg-text mt-[4px]"></div>
              </div>
              <div className="bg-card rounded-[12px] border border-border p-[12px] flex flex-col gap-[8px]">
                <div className="w-[20px] h-[20px] rounded-[6px] bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b]">
                  <AlertCircle size={12} />
                </div>
                <div className="w-[60px] h-[8px] rounded-full bg-border"></div>
                <div className="w-[60px] h-[12px] rounded-full bg-text mt-[4px]"></div>
              </div>
            </div>

            {/* Mini Chart & List */}
            <div className="flex gap-[16px]">
              <div className="flex-1 bg-card rounded-[12px] border border-border p-[16px] flex flex-col gap-[16px] h-[100px]">
                <div className="w-[100px] h-[8px] rounded-full bg-border"></div>
                <div className="flex items-end gap-[8px] h-full pt-[8px]">
                  <div className="w-full h-[40%] bg-[#6366f1]/20 rounded-t-[4px]"></div>
                  <div className="w-full h-[70%] bg-[#6366f1]/40 rounded-t-[4px]"></div>
                  <div className="w-full h-[50%] bg-[#6366f1]/30 rounded-t-[4px]"></div>
                  <div className="w-full h-[90%] bg-[#6366f1] rounded-t-[4px]"></div>
                </div>
              </div>
              <div className="flex-1 bg-card rounded-[12px] border border-border p-[16px] flex flex-col gap-[12px]">
                <div className="w-[80px] h-[8px] rounded-full bg-border mb-[4px]"></div>
                <div className="flex items-center justify-between">
                  <div className="w-[60px] h-[8px] rounded-full bg-border"></div>
                  <div className="w-[40px] h-[12px] rounded-full bg-[#8b5cf6]/20"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="w-[70px] h-[8px] rounded-full bg-border"></div>
                  <div className="w-[40px] h-[12px] rounded-full bg-[#6366f1]/20"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="w-[50px] h-[8px] rounded-full bg-border"></div>
                  <div className="w-[40px] h-[12px] rounded-full bg-[#f59e0b]/20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Points */}
      <div className="relative z-10 flex flex-col gap-[20px] mt-auto">
        <div className="flex items-center gap-[12px]">
          <div className="w-[36px] h-[36px] rounded-[10px] bg-background border border-border flex items-center justify-center text-[#6366f1] shadow-sm">
            <Building2 size={16} />
          </div>
          <span className="text-[14px] font-bold text-text">Quản lý tòa nhà</span>
        </div>

        <div className="flex items-center gap-[12px]">
          <div className="w-[36px] h-[36px] rounded-[10px] bg-background border border-border flex items-center justify-center text-[#8b5cf6] shadow-sm">
            <LineChart size={16} />
          </div>
          <span className="text-[14px] font-bold text-text">Tài chính & công nợ</span>
        </div>

        <div className="flex items-center gap-[12px]">
          <div className="w-[36px] h-[36px] rounded-[10px] bg-background border border-border flex items-center justify-center text-[#f59e0b] shadow-sm">
            <FileSignature size={16} />
          </div>
          <span className="text-[14px] font-bold text-text">Hợp đồng & Khách thuê</span>
        </div>
      </div>
    </div>
  );
}
