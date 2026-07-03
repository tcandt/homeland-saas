import React from "react";
import { PhoneCall, MessageCircle, MoreHorizontal, User, Clock } from "lucide-react";

const pipeline = [
  {
    id: "new",
    title: "Khách mới",
    color: "bg-muted",
    leads: [
      { id: "L-01", name: "Nguyễn Tuấn", phone: "0901234567", source: "Facebook", time: "2 giờ trước", budget: "5-7M" },
      { id: "L-02", name: "Trần Minh", phone: "0987654321", source: "Tiktok", time: "5 giờ trước", budget: "4-5M" },
    ]
  },
  {
    id: "contacted",
    title: "Đang tư vấn",
    color: "bg-[#3b82f6]",
    leads: [
      { id: "L-03", name: "Lê Hoàng", phone: "0912345678", source: "Zalo", time: "Hôm qua", budget: "6M" },
    ]
  },
  {
    id: "viewing",
    title: "Hẹn xem phòng",
    color: "bg-[#f97316]",
    leads: [
      { id: "L-04", name: "Phạm Thảo", phone: "0934567890", source: "Website", time: "14:00 Hôm nay", budget: "7M" },
    ]
  },
  {
    id: "deposit",
    title: "Chờ cọc",
    color: "bg-[#8b5cf6]",
    leads: [
      { id: "L-05", name: "Hoàng Oanh", phone: "0945678901", source: "Zalo", time: "Hứa cọc T6", budget: "8M" },
    ]
  },
  {
    id: "won",
    title: "Thành công",
    color: "bg-[#22c55e]",
    leads: [
      { id: "L-06", name: "Vũ Hải", phone: "0956789012", source: "Facebook", time: "Đã ký HĐ", budget: "5.5M" },
    ]
  }
];

export default function SalesPipeline() {
  return (
    <div className="flex-1 w-full flex flex-col md:overflow-hidden h-full min-h-[500px]">
      
      {/* Desktop Pipeline Board */}
      <div className="hidden md:flex flex-1 gap-6 overflow-x-auto pb-4 pt-2 hide-scrollbar">
        {pipeline.map((col) => (
          <div key={col.id} className="flex-shrink-0 w-[280px] flex flex-col h-full bg-muted/20 dark:bg-muted/10 rounded-2xl p-4 border border-border/50 shadow-inner">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`}></div>
                <h3 className="text-[13px] font-black text-text uppercase tracking-wide">{col.title}</h3>
              </div>
              <span className="text-[12px] font-bold text-muted bg-card px-2.5 py-0.5 rounded-full border border-border shadow-sm">{col.leads.length}</span>
            </div>
            
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto hide-scrollbar">
              {col.leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Lead List */}
      <div className="flex md:hidden flex-col gap-4">
        {/* Khách mới / Cần tư vấn ngay */}
        <div>
          <h3 className="text-[12px] font-black text-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5"><Clock size={14} /> Khách mới cần tư vấn</h3>
          <div className="flex flex-col gap-3">
            <LeadCard lead={pipeline[0].leads[0]} mobile />
            <LeadCard lead={pipeline[0].leads[1]} mobile />
          </div>
        </div>

        {/* Khách hẹn xem phòng */}
        <div className="mt-2">
          <h3 className="text-[12px] font-black text-[#f97316] uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">Lịch xem phòng</h3>
          <div className="flex flex-col gap-3">
            <LeadCard lead={pipeline[2].leads[0]} mobile />
          </div>
        </div>
      </div>

    </div>
  );
}

function LeadCard({ lead, mobile = false }: { lead: any, mobile?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[#4f46e5]/50 hover:ring-1 hover:ring-[#4f46e5]/20 transition-all cursor-pointer flex flex-col gap-3 group relative">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4f46e5]/20 to-[#8b5cf6]/20 flex items-center justify-center shrink-0 border border-[#4f46e5]/10">
            <User size={14} className="text-[#4f46e5]" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-text group-hover:text-[#4f46e5] transition-colors">{lead.name}</h4>
            <p className="text-[11px] font-medium text-muted">{lead.phone}</p>
          </div>
        </div>
        <button className="text-muted hover:text-text md:opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-black/5 dark:bg-white/5 rounded-[6px] text-[10px] font-bold text-muted">{lead.source}</span>
        <span className="px-2 py-1 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 rounded-[6px] text-[10px] font-bold">{lead.budget}</span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="text-[11px] font-bold text-muted flex items-center gap-1.5">
          <Clock size={12} /> {lead.time}
        </div>

        {/* Quick Actions (Luôn hiện trên Mobile, Hiện khi hover trên Desktop) */}
        <div className={`flex items-center gap-2 ${!mobile ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
          <button className="w-[28px] h-[28px] rounded-[8px] bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center hover:bg-[#3b82f6]/20 transition-colors" title="Gọi điện">
            <PhoneCall size={14} />
          </button>
          <button className="w-[28px] h-[28px] rounded-[8px] bg-[#22c55e]/10 text-[#22c55e] flex items-center justify-center hover:bg-[#22c55e]/20 transition-colors" title="Zalo">
            <MessageCircle size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
