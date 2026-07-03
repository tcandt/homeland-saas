"use client";
import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Camera, Globe2 } from "lucide-react";

function Field({ label, value, type = "text" }: any) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
      <Input type={type} defaultValue={value} className="h-[42px] px-[14px] bg-background border border-border rounded-[10px] text-[13px] font-medium text-text focus:outline-none focus:border-primary transition-all" />
    </div>
  );
}

export default function SettingsProfile() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[20px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">Hồ sơ cá nhân</h3>
        <div className="flex items-start gap-[24px]">
          <div className="flex flex-col items-center gap-[8px] shrink-0">
            <div className="relative w-[80px] h-[80px]">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-primary to-warning flex items-center justify-center text-white text-[28px] font-black">VP</div>
              <Button className="absolute bottom-0 right-0 w-[26px] h-[26px] bg-card border border-border rounded-full flex items-center justify-center shadow hover:bg-black/5 transition-colors">
                <Camera size={12} className="text-muted" />
              </Button>
            </div>
            <span className="text-[11px] font-medium text-muted">Đổi ảnh</span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-[14px]">
            <Field label="Họ và tên" value="Văn Thể Phan" />
            <Field label="Tên hiển thị" value="Admin VP" />
            <Field label="Số điện thoại" value="0987 654 321" />
            <Field label="Email đăng nhập" value="vanthephan@homeland.vn" type="email" />
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Vai trò</label>
              <div className="h-[42px] px-[14px] bg-primary/10 border border-primary/20 rounded-[10px] flex items-center">
                <span className="text-[13px] font-bold text-primary">Administrator</span>
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Trạng thái</label>
              <div className="h-[42px] px-[14px] bg-success/10 border border-success/20 rounded-[10px] flex items-center">
                <span className="text-[13px] font-bold text-success">● Hoạt động</span>
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Ngôn ngữ</label>
              <div className="relative">
                <Globe2 size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
                <Select 
                  defaultValue="Tiếng Việt (VN)" 
                  options={[
                    { label: "Tiếng Việt (VN)", value: "Tiếng Việt (VN)" },
                    { label: "English (US)", value: "English (US)" }
                  ]}
                  className="pl-[36px]"
                />
              </div>
            </div>
            <Field label="Múi giờ (Timezone)" value="Asia/Ho_Chi_Minh (GMT+7)" />
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-[16px]">
          <Button className="h-[44px] px-[24px] rounded-[12px] bg-primary text-white font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-sm">
            Cập nhật hồ sơ
          </Button>
        </div>
      </div>
    </div>
  );
}
