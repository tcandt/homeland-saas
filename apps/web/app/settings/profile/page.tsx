import React from "react";
import { Camera } from "lucide-react";

export default function ProfileSettingsPage() {
  return (
    <div className="flex flex-col gap-8 max-w-[600px]">
      <div>
        <h3 className="text-[18px] font-black text-text">Hồ sơ cá nhân</h3>
        <p className="text-[13px] font-medium text-muted mt-1">Cập nhật thông tin cá nhân và ảnh đại diện của bạn.</p>
      </div>

      <div className="flex items-center gap-6 pb-6 border-b border-border">
        <div className="relative">
          <div className="w-[80px] h-[80px] rounded-full bg-gradient-to-tr from-[#4f46e5] to-[#f97316] flex items-center justify-center text-white text-[24px] font-black shadow-md">
            VP
          </div>
          <button className="absolute bottom-0 right-0 w-[28px] h-[28px] bg-card border border-border rounded-full flex items-center justify-center shadow-sm text-text hover:bg-black/5 transition-colors">
            <Camera size={14} />
          </button>
        </div>
        <div>
          <button className="px-4 py-2 bg-card border border-border rounded-[10px] text-[13px] font-bold text-text shadow-sm hover:bg-black/5 transition-colors">
            Tải ảnh lên
          </button>
          <p className="text-[11px] font-medium text-muted mt-2">JPG, GIF hoặc PNG. Tối đa 1MB.</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold text-text uppercase tracking-wide">Họ và tên đệm</label>
            <input type="text" defaultValue="Văn Thể" className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-[12px] text-[13px] font-bold text-text outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold text-text uppercase tracking-wide">Tên</label>
            <input type="text" defaultValue="Phan" className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-[12px] text-[13px] font-bold text-text outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-bold text-text uppercase tracking-wide">Địa chỉ Email</label>
          <input type="email" defaultValue="vanthephan@homeland.vn" className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-[12px] text-[13px] font-medium text-muted outline-none disabled:opacity-70" disabled />
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-[12px] font-bold text-text uppercase tracking-wide">Số điện thoại</label>
          <input type="tel" defaultValue="0987654321" className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-[12px] text-[13px] font-bold text-text outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all" />
        </div>
      </div>

      <div className="pt-6 border-t border-border flex justify-end gap-3">
        <button className="px-6 py-2.5 bg-transparent text-text hover:bg-black/5 dark:hover:bg-white/5 rounded-[10px] text-[13px] font-bold transition-colors">
          Hủy bỏ
        </button>
        <button className="px-6 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-[10px] text-[13px] font-bold transition-colors shadow-sm">
          Lưu hồ sơ
        </button>
      </div>
    </div>
  );
}
