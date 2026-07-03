"use client";

import React, { useState } from "react";
import { Users, PhoneCall, CheckCircle2, TrendingUp, Clock, User, MessageCircle, MoreHorizontal, ChevronDown, Filter, CalendarPlus, FileEdit, ThermometerSun, Flame, Snowflake, ArrowRight } from "lucide-react";

type LeadTemperature = "hot" | "warm" | "cold";

interface LeadData {
  id: string;
  name: string;
  phone: string;
  source: string;
  time: string;
  budget: string;
  status: string;
  statusColor: string;
  temperature: LeadTemperature;
  notes: string;
  expectedDate: string;
}

const pipeline: LeadData[] = [
  { id: "L-01", name: "Nguyễn Tuấn", phone: "0901234567", source: "Facebook", time: "2 giờ trước", budget: "5-7 Triệu", status: "Khách mới", statusColor: "bg-muted", temperature: "warm", notes: "Đang tìm phòng ban công, có nuôi mèo.", expectedDate: "Tháng sau" },
  { id: "L-02", name: "Trần Minh", phone: "0987654321", source: "Tiktok", time: "5 giờ trước", budget: "4-5 Triệu", status: "Khách mới", statusColor: "bg-muted", temperature: "cold", notes: "Chỉ hỏi giá, chưa rõ ngày chuyển.", expectedDate: "Chưa rõ" },
  { id: "L-03", name: "Lê Hoàng", phone: "0912345678", source: "Zalo", time: "Hôm qua", budget: "6 Triệu", status: "Đang tư vấn", statusColor: "bg-[#3b82f6]", temperature: "hot", notes: "Rất ưng phòng số 3, mai dẫn vợ qua xem.", expectedDate: "Tuần tới" },
  { id: "L-04", name: "Phạm Thảo", phone: "0934567890", source: "Website", time: "14:00 Hôm nay", budget: "7 Triệu", status: "Hẹn xem phòng", statusColor: "bg-[#f97316]", temperature: "hot", notes: "Lịch hẹn 2h chiều nay tại cơ sở LK02.", expectedDate: "Gấp" },
  { id: "L-05", name: "Hoàng Oanh", phone: "0945678901", source: "Zalo", time: "Hứa cọc T6", budget: "8 Triệu", status: "Chờ cọc", statusColor: "bg-[#8b5cf6]", temperature: "hot", notes: "Đã chốt giá, thứ 6 nhận lương sẽ CK cọc.", expectedDate: "Cuối tháng" },
  { id: "L-06", name: "Vũ Hải", phone: "0956789012", source: "Facebook", time: "Đã ký HĐ", budget: "5.5 Triệu", status: "Thành công", statusColor: "bg-[#22c55e]", temperature: "hot", notes: "Đã ký HĐ 12 tháng.", expectedDate: "Đã chuyển vào" }
];

export default function SalesMobileFlow() {
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);

  return (
    <>
    <div className="flex flex-col gap-6 w-full min-w-0 box-border pb-[100px]">
      
      {/* KPI Section (Premium 2x2 Grid) */}
      <section className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-[#3b82f6]/10 to-transparent border border-[#3b82f6]/20 shadow-sm rounded-[20px] p-4 flex flex-col gap-1.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#3b82f6]/5 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none"></div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
              <Users size={14} className="text-[#3b82f6]" />
            </div>
            <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Leads Mới</div>
          </div>
          <div className="text-[24px] font-black text-text mt-1 tracking-tight">45 <span className="text-[12px] font-bold text-[#22c55e] ml-1 tracking-normal">↑12</span></div>
        </div>

        <div className="bg-gradient-to-br from-[#f97316]/10 to-transparent border border-[#f97316]/20 shadow-sm rounded-[20px] p-4 flex flex-col gap-1.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#f97316]/5 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none"></div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#f97316]/10 flex items-center justify-center shrink-0">
              <PhoneCall size={14} className="text-[#f97316]" />
            </div>
            <div className="text-[11px] font-bold text-[#f97316] uppercase tracking-wider">Đang chăm sóc</div>
          </div>
          <div className="text-[24px] font-black text-text mt-1 tracking-tight">18 <span className="text-[12px] font-bold text-[#f97316] ml-1 tracking-normal">! 5 Hẹn</span></div>
        </div>

        <div className="bg-card border border-border shadow-sm rounded-[20px] p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#22c55e]/10 flex items-center justify-center shrink-0">
              <CheckCircle2 size={14} className="text-[#22c55e]" />
            </div>
            <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Chốt HĐ</div>
          </div>
          <div className="text-[24px] font-black text-text mt-1 tracking-tight">12</div>
        </div>

        <div className="bg-card border border-border shadow-sm rounded-[20px] p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center shrink-0">
              <TrendingUp size={14} className="text-[#8b5cf6]" />
            </div>
            <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Chuyển đổi</div>
          </div>
          <div className="text-[24px] font-black text-text mt-1 tracking-tight">26%</div>
        </div>
      </section>

      {/* Sales Pipeline Track (Visualizer) */}
      <section className="bg-card border border-border shadow-sm rounded-[20px] p-4 flex flex-col gap-3 relative overflow-hidden">
        <h3 className="text-[13px] font-black text-text uppercase tracking-wider">Tiến độ Phễu (Phân bổ)</h3>
        <div className="w-full h-[8px] rounded-full flex overflow-hidden">
          <div className="h-full bg-muted" style={{ width: '35%' }}></div>
          <div className="h-full bg-[#3b82f6]" style={{ width: '30%' }}></div>
          <div className="h-full bg-[#f97316]" style={{ width: '15%' }}></div>
          <div className="h-full bg-[#8b5cf6]" style={{ width: '5%' }}></div>
          <div className="h-full bg-[#22c55e]" style={{ width: '15%' }}></div>
        </div>
        <div className="flex justify-between items-center text-[10px] font-bold text-muted uppercase tracking-wider mt-1">
          <span>Mới (35%)</span>
          <span className="text-[#22c55e]">Chốt (15%)</span>
        </div>
      </section>

      {/* Quick Filters Pipeline (Scrollable) */}
      <section className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
        <button className="px-4 py-2 bg-text text-background text-[12px] font-bold rounded-full whitespace-nowrap shrink-0 shadow-sm">
          Tất cả (45)
        </button>
        <button className="px-4 py-2 bg-card text-muted text-[12px] font-bold rounded-full whitespace-nowrap border border-border shrink-0 hover:bg-black/5 transition-colors shadow-sm">
          <span className="w-2 h-2 rounded-full bg-muted inline-block mr-1.5"></span> Khách mới
        </button>
        <button className="px-4 py-2 bg-card text-[#3b82f6] text-[12px] font-bold rounded-full whitespace-nowrap border border-border shrink-0 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#3b82f6] inline-block mr-1.5"></span> Đang tư vấn
        </button>
        <button className="px-4 py-2 bg-card text-muted text-[12px] font-bold rounded-full whitespace-nowrap border border-border shrink-0 hover:bg-black/5 transition-colors shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#f97316] inline-block mr-1.5"></span> Hẹn xem phòng
        </button>
      </section>

      {/* List Section */}
      <section className="flex flex-col gap-3">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[16px] font-black text-text tracking-tight">Danh sách Khách hàng</h3>
          <button className="text-[12px] font-bold text-[#4f46e5] bg-[#4f46e5]/10 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Filter size={12} /> Bộ lọc
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {pipeline.map((item, i) => (
            <div key={i} onClick={() => setSelectedLead(item)} className="bg-card border border-border rounded-[20px] p-4 shadow-sm flex flex-col relative overflow-hidden active:scale-[0.98] transition-transform w-full box-border cursor-pointer group">
              
              {/* Premium Header: Avatar + Info */}
              <div className="flex items-start justify-between gap-3 w-full">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-[44px] h-[44px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0 border border-border">
                    <User size={18} className="text-muted" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-black text-text truncate group-hover:text-[#4f46e5] transition-colors">{item.name}</span>
                      {item.temperature === 'hot' && <Flame size={14} className="text-[#ef4444] shrink-0" />}
                      {item.temperature === 'warm' && <ThermometerSun size={14} className="text-[#f97316] shrink-0" />}
                      {item.temperature === 'cold' && <Snowflake size={14} className="text-[#3b82f6] shrink-0" />}
                    </div>
                    <span className="text-[12px] font-medium text-muted mt-0.5">{item.phone}</span>
                  </div>
                </div>
                
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full flex-shrink-0 ${item.statusColor} text-white shadow-sm tracking-wide`}>
                  {item.status}
                </span>
              </div>

              {/* Requirements & Budget */}
              <div className="flex items-center gap-2 mt-4 pl-[56px]">
                <span className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[11px] font-bold text-muted border border-border/50">{item.source}</span>
                <span className="px-3 py-1 bg-[#22c55e]/10 text-[#22c55e] rounded-full text-[11px] font-bold border border-[#22c55e]/20">Vốn: {item.budget}</span>
              </div>

              {/* Bottom Row */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                <div className="text-[12px] font-bold text-muted flex items-center gap-1.5">
                  <Clock size={14} className={item.status === 'Hẹn xem phòng' ? 'text-[#f97316]' : 'text-muted'} /> {item.time}
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={(e) => e.stopPropagation()} className="w-[32px] h-[32px] rounded-full bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center hover:bg-[#3b82f6]/20 transition-colors" title="Gọi điện">
                    <PhoneCall size={14} />
                  </button>
                  <button onClick={(e) => e.stopPropagation()} className="w-[32px] h-[32px] rounded-full bg-[#22c55e]/10 text-[#22c55e] flex items-center justify-center hover:bg-[#22c55e]/20 transition-colors" title="Zalo">
                    <MessageCircle size={14} />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      </section>

    </div>

      {/* Lead Profile Popup (Mini CRM Desktop-class Flow) */}
      {selectedLead && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedLead(null)}></div>
          <div className="w-full md:w-[480px] bg-card h-full shadow-2xl relative z-10 animate-in slide-in-from-bottom md:slide-in-from-right duration-300 flex flex-col mt-12 md:mt-0 rounded-t-[24px] md:rounded-none">
            
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-20">
              <div className="flex items-center gap-3">
                <h2 className="font-black text-[18px] md:text-[20px] text-text">Chi tiết Cơ hội</h2>
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${selectedLead.statusColor} text-white uppercase tracking-wider`}>
                  {selectedLead.status}
                </span>
              </div>
              <button onClick={() => setSelectedLead(null)} className="w-[32px] h-[32px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 transition-colors">
                <span className="text-[14px] font-black text-muted">✕</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
              {/* Profile Card */}
              <div className="bg-gradient-to-br from-black/5 to-transparent dark:from-white/5 p-4 rounded-[20px] border border-border flex flex-col gap-4 relative overflow-hidden">
                <div className="flex items-center gap-4">
                  <div className="w-[64px] h-[64px] rounded-full bg-card border-2 border-border flex items-center justify-center shadow-sm">
                    <User size={28} className="text-muted" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <h3 className="font-black text-[22px] leading-tight text-text mb-1">{selectedLead.name}</h3>
                    <span className="text-[14px] font-bold text-muted">{selectedLead.phone}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  <button className="flex-1 py-2.5 bg-[#4f46e5] text-white font-bold text-[13px] rounded-xl flex items-center justify-center gap-2 shadow-sm">
                    <PhoneCall size={14} /> Gọi ngay
                  </button>
                  <button className="flex-1 py-2.5 bg-[#0068ff]/10 text-[#0068ff] font-bold text-[13px] rounded-xl flex items-center justify-center gap-2 border border-[#0068ff]/20">
                    <MessageCircle size={14} /> Chat Zalo
                  </button>
                </div>
              </div>

              {/* Requirement Details */}
              <div>
                <h4 className="text-[13px] font-black text-text uppercase tracking-wider mb-3">Nhu cầu & Tiềm năng</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card border border-border p-3.5 rounded-[16px] flex flex-col gap-1 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Ngân sách</span>
                    <span className="text-[16px] font-black text-[#22c55e]">{selectedLead.budget}</span>
                  </div>
                  <div className="bg-card border border-border p-3.5 rounded-[16px] flex flex-col gap-1 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Ngày dọn vào</span>
                    <span className="text-[16px] font-black text-text">{selectedLead.expectedDate}</span>
                  </div>
                  <div className="bg-card border border-border p-3.5 rounded-[16px] flex flex-col gap-1 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Nguồn</span>
                    <span className="text-[15px] font-black text-text">{selectedLead.source}</span>
                  </div>
                  <div className="bg-card border border-border p-3.5 rounded-[16px] flex flex-col gap-1 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Độ nóng</span>
                    <span className="text-[15px] font-black text-text flex items-center gap-1.5">
                      {selectedLead.temperature === 'hot' && <><Flame size={16} className="text-[#ef4444]" /> Nóng</>}
                      {selectedLead.temperature === 'warm' && <><ThermometerSun size={16} className="text-[#f97316]" /> Ấm</>}
                      {selectedLead.temperature === 'cold' && <><Snowflake size={16} className="text-[#3b82f6]" /> Lạnh</>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-[13px] font-black text-text uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Ghi chú của Sales</span>
                  <button className="text-[#4f46e5] flex items-center gap-1 text-[11px] hover:underline"><FileEdit size={12} /> Sửa</button>
                </h4>
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-[16px] border border-border text-[13px] font-medium text-text leading-relaxed">
                  {selectedLead.notes}
                </div>
              </div>

              {/* Timeline / Activities */}
              <div>
                <h4 className="text-[13px] font-black text-text uppercase tracking-wider mb-3">Lịch sử Chăm sóc</h4>
                <div className="flex flex-col gap-0 relative pl-4">
                  <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-border rounded-full"></div>
                  
                  <div className="relative pl-6 pb-5">
                    <div className="absolute left-[-5px] top-1 w-[26px] h-[26px] rounded-full bg-card border-2 border-[#4f46e5] flex items-center justify-center z-10">
                      <div className="w-2 h-2 rounded-full bg-[#4f46e5]"></div>
                    </div>
                    <div className="text-[12px] font-bold text-muted mb-0.5">Hôm nay, 14:00</div>
                    <div className="text-[14px] font-black text-text">Hẹn xem phòng LK02</div>
                    <div className="mt-2 text-[12px] font-medium text-muted bg-card border border-border p-2.5 rounded-lg">Khách bảo sẽ đi cùng bạn. Chú ý mang theo chìa khóa P301.</div>
                  </div>

                  <div className="relative pl-6 pb-2">
                    <div className="absolute left-[-5px] top-1 w-[26px] h-[26px] rounded-full bg-card border-2 border-border flex items-center justify-center z-10">
                      <div className="w-2 h-2 rounded-full bg-muted"></div>
                    </div>
                    <div className="text-[12px] font-bold text-muted mb-0.5">2 ngày trước</div>
                    <div className="text-[14px] font-bold text-text">Nhận khách mới từ hệ thống</div>
                    <div className="mt-1 text-[12px] font-medium text-muted">Nguồn: Facebook Ads (Chiến dịch mùa tựu trường)</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Sticky Action */}
            <div className="p-4 border-t border-border bg-card sticky bottom-0 z-20 flex gap-2">
              <button className="flex-1 py-3.5 bg-card border border-border text-text font-bold text-[14px] rounded-[14px] flex items-center justify-center gap-2 hover:bg-black/5 transition-colors">
                <CalendarPlus size={16} /> Lên lịch hẹn
              </button>
              <button className="flex-1 py-3.5 bg-[#4f46e5] text-white font-bold text-[14px] rounded-[14px] flex items-center justify-center gap-2 hover:bg-[#4338ca] transition-colors shadow-sm">
                <ArrowRight size={16} /> Đổi trạng thái
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
