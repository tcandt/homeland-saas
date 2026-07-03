"use client";
import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Shield, Smartphone, Key, LogOut, Clock, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";

function Section({ title, children }: any) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
      <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">{title}</h3>
      {children}
    </div>
  );
}

export default function SettingsSecurity() {
  const devices = [
    { name: "MacBook Pro 14\"", location: "TP.HCM, VN", browser: "Chrome 120", time: "Đang hoạt động", current: true },
    { name: "iPhone 15 Pro", location: "TP.HCM, VN", browser: "Safari iOS", time: "2 giờ trước", current: false },
    { name: "Windows PC", location: "Hà Nội, VN", browser: "Edge 120", time: "2 ngày trước", current: false },
  ];

  const loginHistory = [
    { time: "25/06/2026 08:15", ip: "123.20.112.45", device: "MacBook Pro", status: "Thành công", location: "TP.HCM" },
    { time: "24/06/2026 14:32", ip: "123.20.112.45", device: "iPhone 15", status: "Thành công", location: "TP.HCM" },
    { time: "23/06/2026 09:00", ip: "14.161.22.189", device: "Chrome", status: "Thất bại", location: "Hà Nội" },
    { time: "22/06/2026 16:45", ip: "123.20.112.45", device: "MacBook Pro", status: "Thành công", location: "TP.HCM" },
  ];

  const apiKeys = [
    { name: "Production API Key", key: "sk_live_**********************abc1", created: "01/06/2026", last: "Hôm nay", scope: "Full Access" },
    { name: "Webhook Secret", key: "whsec_*******************def2", created: "01/06/2026", last: "3 ngày trước", scope: "Events" },
    { name: "Mobile App Key", key: "pk_mobile_***************ghi3", created: "15/05/2026", last: "Tuần trước", scope: "Read Only" },
  ];

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Security Score */}
      <div className="bg-gradient-to-br from-primary/10 to-success/10 border border-primary/20 rounded-[16px] p-[20px] flex items-center gap-[20px]">
        <div className="relative w-[80px] h-[80px] shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#6366f1" strokeWidth="8" strokeDasharray="213.6" strokeDashoffset="38.4" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[18px] font-black text-primary">82</span>
          </div>
        </div>
        <div>
          <div className="text-[18px] font-black text-text">Security Score: 82/100</div>
          <div className="text-[13px] font-medium text-muted mt-[4px]">Tốt — Bật thêm 2FA SMS để đạt 95+</div>
          <div className="flex items-center gap-[6px] mt-[8px]">
            <span className="text-[11px] font-bold text-success bg-success/10 px-[8px] py-[2px] rounded-full">2FA: Đã bật</span>
            <span className="text-[11px] font-bold text-warning bg-warning/10 px-[8px] py-[2px] rounded-full">SMS OTP: Chưa bật</span>
          </div>
        </div>
      </div>

      {/* 3-Column Grid for Pass, 2FA, Devices */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
        {/* Change Password */}
        <Section title="Đổi mật khẩu">
          <div className="flex flex-col gap-[14px]">
            {["Mật khẩu hiện tại", "Mật khẩu mới", "Xác nhận mật khẩu mới"].map((label) => (
              <div key={label} className="flex flex-col gap-[6px]">
                <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
                <Input type="password" className="h-[42px] px-[14px] bg-background border border-border rounded-[10px] text-[13px] font-medium focus:outline-none focus:border-primary transition-all" />
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-auto pt-[14px]">
            <Button className="h-[40px] px-[20px] rounded-[10px] bg-primary text-white font-bold text-[13px] hover:bg-primary/90 transition-colors w-full">Đổi mật khẩu</Button>
          </div>
        </Section>

        {/* 2FA */}
        <Section title="Xác thực 2 bước (2FA)">
          <div className="flex flex-col gap-[12px]">
            {[
              { label: "Email OTP", desc: "Nhận mã qua email", enabled: true },
              { label: "SMS OTP", desc: "Nhận mã qua điện thoại", enabled: false },
              { label: "Authenticator", desc: "Dùng app xác thực", enabled: false },
            ].map((item) => (
              <div key={item.label} className={`flex items-center justify-between p-[14px] rounded-[10px] border ${item.enabled ? "border-success/20 bg-success/5" : "border-border bg-background"}`}>
                <div>
                  <div className="font-bold text-[13px] text-text flex items-center gap-[8px]">
                    {item.label}
                    {item.enabled && <span className="text-[10px] font-bold text-success bg-success/10 px-[6px] py-[2px] rounded-full">Đang bật</span>}
                  </div>
                  <div className="text-[11px] font-medium text-muted mt-[2px]">{item.desc}</div>
                </div>
                <div className={`w-[44px] h-[24px] rounded-full p-[3px] flex items-center cursor-pointer transition-colors shrink-0 ${item.enabled ? "bg-success" : "bg-border"}`}>
                  <div className={`w-[18px] h-[18px] bg-card rounded-full shadow transition-transform ${item.enabled ? "translate-x-[20px]" : "translate-x-0"}`} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Active Devices */}
        <Section title="Thiết bị đang đăng nhập">
          <div className="flex flex-col gap-[10px]">
            {devices.map((d, i) => (
              <div key={i} className={`flex items-center gap-[14px] p-[14px] rounded-[10px] border ${d.current ? "border-primary/20 bg-primary/5" : "border-border bg-background"}`}>
                <Smartphone size={18} className={`shrink-0 ${d.current ? "text-primary" : "text-muted"}`} />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-[8px]">
                    <span className="font-bold text-[13px] text-text truncate">{d.name}</span>
                    {d.current && <span className="text-[9px] font-bold text-primary bg-primary/10 px-[6px] py-[1px] rounded-full whitespace-nowrap">Hiện tại</span>}
                  </div>
                  <div className="flex items-center gap-[8px] mt-[2px] text-[11px] text-muted font-medium truncate">
                    <Clock size={10} className="shrink-0" /> {d.time}
                  </div>
                </div>
                {!d.current && (
                  <Button className="text-[12px] font-bold text-danger hover:underline whitespace-nowrap shrink-0">Đăng xuất</Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-auto pt-[10px]">
            <Button className="flex items-center justify-center w-full gap-[8px] h-[40px] px-[16px] rounded-[10px] bg-danger/10 text-danger font-bold text-[13px] hover:bg-danger/20 transition-colors">
              <LogOut size={14} /> Đăng xuất khỏi tất cả
            </Button>
          </div>
        </Section>
      </div>

      {/* API Keys */}
      <Section title="API Keys & Webhooks">
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-muted">Quản lý các API Keys được dùng để tích hợp vào hệ thống khác.</span>
            <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 transition-colors whitespace-nowrap">+ Tạo API Key</Button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-[14px]">
            {apiKeys.map((k, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-[14px] p-[14px] rounded-[10px] bg-background border border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[13px] text-text">{k.name}</span>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-[8px] py-[2px] rounded-full">{k.scope}</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted mt-[4px] truncate">{k.key}</div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-[14px] shrink-0">
                  <span className="text-[11px] text-muted">Sử dụng: {k.last}</span>
                  <Button className="h-[30px] px-[10px] rounded-[8px] bg-danger/10 text-danger font-bold text-[11px] hover:bg-danger/20 transition-colors">Thu hồi</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Login History */}
      <Section title="Lịch sử đăng nhập">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border">
                {["Thời gian", "IP", "Thiết bị", "Địa điểm", "Trạng thái"].map((h) => (
                  <th key={h} className="text-left py-[8px] px-[10px] font-bold text-muted uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loginHistory.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-black/5 dark:hover:bg-card/5 transition-colors">
                  <td className="py-[10px] px-[10px] font-medium text-text">{row.time}</td>
                  <td className="py-[10px] px-[10px] font-mono text-muted">{row.ip}</td>
                  <td className="py-[10px] px-[10px] font-medium text-text">{row.device}</td>
                  <td className="py-[10px] px-[10px] font-medium text-muted">{row.location}</td>
                  <td className="py-[10px] px-[10px]">
                    <span className={`text-[11px] font-bold px-[8px] py-[3px] rounded-full ${row.status === "Thành công" ? "text-success bg-success/10" : "text-danger bg-danger/10"}`}>
                      {row.status === "Thành công" ? <CheckCircle2 size={10} className="inline mr-1" /> : <AlertTriangle size={10} className="inline mr-1" />}
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
