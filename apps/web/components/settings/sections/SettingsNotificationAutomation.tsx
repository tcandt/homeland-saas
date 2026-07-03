"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Check, X, Plus, Trash2, Bell, ChevronRight } from "lucide-react";

const channels = ["App", "Email", "SMS", "Zalo", "Telegram"];

interface Reminder { days: number; channels: string[]; }
interface AutoRule { event: string; desc: string; reminders: Reminder[]; }

const defaultRules: AutoRule[] = [
  {
    event: "Hóa đơn quá hạn (Invoice Overdue)",
    desc: "Nhắc nhở khách hàng khi hóa đơn sắp đến hạn hoặc đã quá hạn",
    reminders: [
      { days: 7, channels: ["App", "Email"] },
      { days: 3, channels: ["App", "Email", "Zalo"] },
      { days: 0, channels: ["App", "Email", "SMS", "Zalo"] },
      { days: -1, channels: ["App", "Email", "SMS", "Zalo"] },
      { days: -7, channels: ["App", "Email", "SMS", "Zalo", "Telegram"] },
    ]
  },
  {
    event: "Hợp đồng sắp hết hạn (Contract Expiring)",
    desc: "Thông báo cho sales và khách thuê khi hợp đồng sắp hết hạn",
    reminders: [
      { days: 30, channels: ["App", "Email"] },
      { days: 15, channels: ["App", "Email", "Zalo"] },
      { days: 7, channels: ["App", "Email", "SMS", "Zalo"] },
      { days: 0, channels: ["App", "Email", "SMS", "Zalo", "Telegram"] },
    ]
  },
];

function ReminderDayLabel({ days }: { days: number }) {
  if (days > 0) return <span className="text-primary">Trước {days} ngày</span>;
  if (days === 0) return <span className="text-warning font-bold">Đến hạn hôm nay</span>;
  return <span className="text-danger">Quá hạn {Math.abs(days)} ngày</span>;
}

export default function SettingsNotificationAutomation() {
  const [rules] = useState(defaultRules);

  // Also quick toggle matrix for general notifications
  const notifications = [
    { event: "Hóa đơn quá hạn", app: true, email: true, sms: false, zalo: true, telegram: false },
    { event: "Hợp đồng sắp hết hạn", app: true, email: true, sms: false, zalo: true, telegram: true },
    { event: "Khách thuê mới", app: true, email: false, sms: false, zalo: false, telegram: false },
    { event: "Thanh toán thành công", app: true, email: true, sms: true, zalo: false, telegram: false },
    { event: "Sự cố bảo trì", app: true, email: false, sms: false, zalo: true, telegram: false },
    { event: "Công nợ vượt hạn mức", app: true, email: true, sms: true, zalo: true, telegram: false },
    { event: "Báo cáo tháng", app: false, email: true, sms: false, zalo: false, telegram: false },
  ];

  return (
    <div className="flex flex-col gap-[24px]">

      {/* General Notification Matrix */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Ma trận thông báo</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Sự kiện</th>
                {channels.map(ch => (
                  <th key={ch} className="text-center py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">{ch}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notifications.map((n, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-black/[0.02] dark:hover:bg-card/[0.02] transition-colors">
                  <td className="py-[12px] px-[12px] font-bold text-[13px] text-text">{n.event}</td>
                  {(["app", "email", "sms", "zalo", "telegram"] as const).map(ch => {
                    const enabled = n[ch];
                    return (
                      <td key={ch} className="py-[12px] px-[12px] text-center">
                        <div className={`inline-flex w-[36px] h-[20px] rounded-full p-[2px] items-center cursor-pointer transition-colors ${enabled ? "bg-success" : "bg-border"}`}>
                          <div className={`w-[16px] h-[16px] bg-card rounded-full shadow transition-transform ${enabled ? "translate-x-[16px]" : "translate-x-0"}`} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automation Rules */}
      {rules.map((rule, ri) => (
        <div key={ri} className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-[8px]">
                <Bell size={16} className="text-primary" />
                <h3 className="font-black text-[15px] text-text">{rule.event}</h3>
              </div>
              <p className="text-[12px] font-medium text-muted mt-[4px]">{rule.desc}</p>
            </div>
            <div className="flex items-center gap-[8px]">
              <Button className="h-[32px] px-[12px] rounded-[8px] bg-background border border-border text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors flex items-center gap-[4px]">
                <Plus size={12} /> Thêm nhắc
              </Button>
              <div className="w-[40px] h-[22px] rounded-full bg-success p-[2px] flex items-center cursor-pointer">
                <div className="w-[18px] h-[18px] bg-card rounded-full shadow translate-x-[18px]" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[8px]">
            {rule.reminders.map((rem, remi) => (
              <div key={remi} className="flex items-center gap-[12px] p-[12px] rounded-[10px] bg-background border border-border">
                <div className="w-[4px] h-[36px] rounded-full bg-primary shrink-0" />
                <div className="w-[150px] shrink-0">
                  <div className="text-[12px] font-bold text-text"><ReminderDayLabel days={rem.days} /></div>
                  <div className="text-[10px] font-medium text-muted">Gửi thông báo</div>
                </div>
                <div className="flex items-center gap-[6px] flex-wrap">
                  {channels.map(ch => {
                    const active = rem.channels.includes(ch);
                    return (
                      <span key={ch} className={`text-[11px] font-bold px-[8px] py-[3px] rounded-full border transition-all cursor-pointer
                        ${active ? "bg-primary/10 text-primary border-primary/30" : "bg-background text-muted border-border"}`}>
                        {active ? <Check size={10} className="inline mr-1" /> : <X size={10} className="inline mr-1" />}
                        {ch}
                      </span>
                    );
                  })}
                </div>
                <Button className="ml-auto text-muted hover:text-danger transition-colors shrink-0">
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button className="h-[44px] px-[24px] rounded-[12px] bg-primary text-white font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-sm">
          Lưu cấu hình thông báo
        </Button>
      </div>
    </div>
  );
}
