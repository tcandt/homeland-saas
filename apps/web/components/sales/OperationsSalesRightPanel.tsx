"use client";

import React from "react";
import { Calendar, Facebook, Target, Trophy, TrendingUp, Phone, Eye, Video, Globe } from "lucide-react";

export default function OperationsSalesRightPanel() {
  return (
    <div className="flex flex-col gap-[20px] pb-[100px]">
      
      {/* Today's Schedule */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <Calendar size={18} className="text-[#6366f1]" />
            <h3 className="font-black text-[15px] text-text">Lịch Hôm Nay</h3>
          </div>
          <span className="bg-[#6366f1]/10 text-[#6366f1] text-[11px] font-bold px-[8px] py-[2px] rounded-[6px]">12 việc</span>
        </div>
        
        <div className="flex flex-col gap-[12px]">
          <ScheduleItem icon={<Eye size={14} />} title="Dẫn khách Nguyễn Văn A xem phòng" time="09:30" type="viewing" />
          <ScheduleItem icon={<Phone size={14} />} title="Gọi follow-up Trần Thị B" time="10:00" type="call" />
          <ScheduleItem icon={<Eye size={14} />} title="Khách Phạm Thị D xem Duplex" time="14:00" type="viewing" />
          <ScheduleItem icon={<Target size={14} />} title="Hẹn ký HĐ với KH Lê Văn C" time="16:00" type="meeting" />
        </div>
      </div>

      {/* Marketing Sources */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <Target size={18} className="text-rose-500" />
            <h3 className="font-black text-[15px] text-text">Hiệu suất Nguồn (T6/2026)</h3>
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <SourceItem icon={<Facebook size={14} />} name="Facebook Ads" leads={120} conv="15%" rev="850M" color="text-blue-500 bg-blue-500/10" />
          <SourceItem icon={<Video size={14} />} name="TikTok" leads={85} conv="12%" rev="420M" color="text-black dark:text-white bg-black/10 dark:bg-white/10" />
          <SourceItem icon={<Globe size={14} />} name="Website SEO" leads={45} conv="22%" rev="560M" color="text-emerald-500 bg-emerald-500/10" />
          <SourceItem icon={<UsersIcon size={14} />} name="Referral" leads={15} conv="45%" rev="380M" color="text-purple-500 bg-purple-500/10" />
        </div>
      </div>

      {/* Top Sales */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <Trophy size={18} className="text-yellow-500" />
            <h3 className="font-black text-[15px] text-text">Top Sales</h3>
          </div>
        </div>

        <div className="flex flex-col gap-[16px]">
          <SalesItem rank={1} name="Tuấn Đạt" leads={45} won={12} rev="1.2B" conv="26%" />
          <SalesItem rank={2} name="Minh Trang" leads={38} won={8} rev="850M" conv="21%" />
          <SalesItem rank={3} name="Hoàng Long" leads={42} won={7} rev="720M" conv="16%" />
        </div>
      </div>

      {/* Forecast */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <TrendingUp size={18} className="text-[#10b981]" />
            <h3 className="font-black text-[15px] text-text">Dự báo Doanh Thu</h3>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-[8px]">
          <div className="bg-background border border-border rounded-[10px] p-[12px] flex flex-col items-center justify-center gap-[4px]">
            <span className="text-[11px] font-bold text-muted">7 Ngày</span>
            <span className="text-[14px] font-black text-[#10b981]">120M</span>
          </div>
          <div className="bg-background border border-border rounded-[10px] p-[12px] flex flex-col items-center justify-center gap-[4px]">
            <span className="text-[11px] font-bold text-muted">30 Ngày</span>
            <span className="text-[14px] font-black text-[#10b981]">850M</span>
          </div>
          <div className="bg-background border border-border rounded-[10px] p-[12px] flex flex-col items-center justify-center gap-[4px]">
            <span className="text-[11px] font-bold text-muted">90 Ngày</span>
            <span className="text-[14px] font-black text-[#10b981]">2.4B</span>
          </div>
        </div>
      </div>

    </div>
  );
}

function ScheduleItem({ icon, title, time, type }: any) {
  const getStyle = () => {
    switch (type) {
      case "viewing": return "border-purple-500/30 bg-purple-500/5 text-purple-600 dark:text-purple-400";
      case "call": return "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400";
      case "meeting": return "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400";
      default: return "border-border bg-background text-muted";
    }
  };

  return (
    <div className={`flex items-start gap-[12px] p-[12px] rounded-[10px] border ${getStyle()}`}>
      <div className="mt-1">{icon}</div>
      <div className="flex flex-col flex-1">
        <span className="text-[13px] font-bold text-text">{title}</span>
        <span className="text-[12px] font-medium opacity-80">{time}</span>
      </div>
    </div>
  );
}

function SourceItem({ icon, name, leads, conv, rev, color }: any) {
  return (
    <div className="flex items-center justify-between group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded-md transition-colors">
      <div className="flex items-center gap-[12px]">
        <div className={`w-[28px] h-[28px] rounded-[8px] flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-text">{name}</span>
          <span className="text-[11px] font-medium text-muted">{leads} leads • {conv} chốt</span>
        </div>
      </div>
      <span className="text-[13px] font-black text-[#10b981]">{rev}</span>
    </div>
  );
}

function SalesItem({ rank, name, leads, won, rev, conv }: any) {
  return (
    <div className="flex items-center gap-[12px]">
      <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center text-[12px] font-bold
        ${rank === 1 ? 'bg-yellow-500/20 text-yellow-600' : rank === 2 ? 'bg-slate-300/30 text-slate-500' : 'bg-orange-500/20 text-orange-600'}
      `}>
        {rank}
      </div>
      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-text">{name}</span>
          <span className="text-[13px] font-black text-[#10b981]">{rev}</span>
        </div>
        <div className="flex items-center justify-between mt-[2px]">
          <span className="text-[11px] font-medium text-muted">{won}/{leads} chốt</span>
          <span className="text-[11px] font-bold text-[#6366f1]">{conv}</span>
        </div>
      </div>
    </div>
  );
}

function UsersIcon({ size, className }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );
}
