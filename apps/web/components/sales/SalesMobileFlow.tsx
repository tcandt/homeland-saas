"use client";

import React, { useMemo, useState } from "react";
import {
  Users,
  PhoneCall,
  CheckCircle2,
  TrendingUp,
  Clock,
  User,
  MessageCircle,
  Filter,
  CalendarPlus,
  FileEdit,
  ThermometerSun,
  Flame,
  Snowflake,
  ArrowRight,
} from "lucide-react";
import { useSalesLeadsQuery } from "@/lib/queries/sales.queries";
import { getSalesStageLabel, normalizeSalesStage, type SalesLeadRecord } from "./sales.types";

type LeadTemperature = "hot" | "warm" | "cold";

type MobileLead = SalesLeadRecord & {
  source: string;
  time: string;
  budget: string;
  statusLabel: string;
  statusColor: string;
  temperature: LeadTemperature;
  notes: string;
  expectedDate: string;
};

function formatStatusLabel(status?: string | null) {
  const normalized = normalizeSalesStage(status);
  return normalized ? getSalesStageLabel(normalized) : "Chưa xác định";
}

function getTemperature(status?: string | null): LeadTemperature {
  const normalized = normalizeSalesStage(status);
  if (normalized === "WON" || normalized === "PROPOSAL") return "hot";
  if (normalized === "QUALIFIED" || normalized === "CONTACTED") return "warm";
  return "cold";
}

function getStatusColor(status?: string | null) {
  const normalized = normalizeSalesStage(status);
  if (normalized === "WON") return "bg-[#22c55e]";
  if (normalized === "PROPOSAL") return "bg-[#8b5cf6]";
  if (normalized === "CONTACTED") return "bg-[#3b82f6]";
  if (normalized === "QUALIFIED") return "bg-[#f97316]";
  if (normalized === "LOST") return "bg-[#ef4444]";
  return "bg-muted";
}

export default function SalesMobileFlow() {
  const [selectedLead, setSelectedLead] = useState<MobileLead | null>(null);
  const { data, isLoading, isError } = useSalesLeadsQuery({ limit: 100 });

  const leads = useMemo<MobileLead[]>(() => {
    const payload = (data as any)?.data?.data ?? (data as any)?.data?.items ?? (data as any)?.data ?? [];
    const items = Array.isArray(payload) ? payload : [];

    return items.map((lead: any) => {
      const status = lead.status || "NEW";
      return {
        ...lead,
        id: String(lead.id),
        name: lead.name || lead.fullName || lead.customerName || "Khách hàng",
        phone: lead.phone || "N/A",
        source: lead.source || lead.channel || "CRM",
        time: lead.updatedAt ? new Date(lead.updatedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "Chưa cập nhật",
        budget: lead.budget || lead.expectedBudget || "Đang cập nhật",
        status,
        statusLabel: formatStatusLabel(status),
        statusColor: getStatusColor(status),
        temperature: getTemperature(status),
        notes: lead.notes || "Chưa có ghi chú",
        expectedDate: lead.expectedDate || "Chưa rõ",
      };
    });
  }, [data]);

  const stats = useMemo(() => {
    const total = leads.length;
    const active = leads.filter((lead) => normalizeSalesStage(lead.status) === "CONTACTED" || normalizeSalesStage(lead.status) === "QUALIFIED").length;
    const won = leads.filter((lead) => normalizeSalesStage(lead.status) === "WON").length;
    const conversion = total > 0 ? Math.round((won / total) * 100) : 0;

    const stageBreakdown = {
      newCount: leads.filter((lead) => normalizeSalesStage(lead.status) === "NEW").length,
      contactedCount: leads.filter((lead) => normalizeSalesStage(lead.status) === "CONTACTED").length,
      proposalCount: leads.filter((lead) => normalizeSalesStage(lead.status) === "PROPOSAL").length,
      wonCount: won,
    };

    return { total, active, won, conversion, ...stageBreakdown };
  }, [leads]);

  return (
    <>
      <div className="flex flex-col gap-6 w-full min-w-0 box-border pb-[100px]">
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-[#3b82f6]/10 to-transparent border border-[#3b82f6]/20 shadow-sm rounded-[20px] p-4 flex flex-col gap-1.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#3b82f6]/5 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
                <Users size={14} className="text-[#3b82f6]" />
              </div>
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Leads mới</div>
            </div>
            <div className="text-[24px] font-black text-text mt-1 tracking-tight">
              {stats.total} <span className="text-[12px] font-bold text-[#22c55e] ml-1 tracking-normal">+{stats.newCount}</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#f97316]/10 to-transparent border border-[#f97316]/20 shadow-sm rounded-[20px] p-4 flex flex-col gap-1.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#f97316]/5 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#f97316]/10 flex items-center justify-center shrink-0">
                <PhoneCall size={14} className="text-[#f97316]" />
              </div>
              <div className="text-[11px] font-bold text-[#f97316] uppercase tracking-wider">Đang chăm sóc</div>
            </div>
            <div className="text-[24px] font-black text-text mt-1 tracking-tight">
              {stats.active} <span className="text-[12px] font-bold text-[#f97316] ml-1 tracking-normal">{stats.won} chốt</span>
            </div>
          </div>

          <div className="bg-card border border-border shadow-sm rounded-[20px] p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#22c55e]/10 flex items-center justify-center shrink-0">
                <CheckCircle2 size={14} className="text-[#22c55e]" />
              </div>
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Chốt HĐ</div>
            </div>
            <div className="text-[24px] font-black text-text mt-1 tracking-tight">{stats.won}</div>
          </div>

          <div className="bg-card border border-border shadow-sm rounded-[20px] p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center shrink-0">
                <TrendingUp size={14} className="text-[#8b5cf6]" />
              </div>
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Chuyển đổi</div>
            </div>
            <div className="text-[24px] font-black text-text mt-1 tracking-tight">{stats.conversion}%</div>
          </div>
        </section>

        <section className="bg-card border border-border shadow-sm rounded-[20px] p-4 flex flex-col gap-3 relative overflow-hidden">
          <h3 className="text-[13px] font-black text-text uppercase tracking-wider">Tiến độ Phễu (Phân bổ)</h3>
          <div className="w-full h-[8px] rounded-full flex overflow-hidden bg-black/5 dark:bg-white/5">
            <div className="h-full bg-muted" style={{ width: `${Math.max(5, Math.round((stats.newCount / Math.max(1, stats.total)) * 100))}%` }} />
            <div className="h-full bg-[#3b82f6]" style={{ width: `${Math.max(5, Math.round((stats.contactedCount / Math.max(1, stats.total)) * 100))}%` }} />
            <div className="h-full bg-[#f97316]" style={{ width: `${Math.max(5, Math.round((stats.proposalCount / Math.max(1, stats.total)) * 100))}%` }} />
            <div className="h-full bg-[#22c55e]" style={{ width: `${Math.max(5, Math.round((stats.wonCount / Math.max(1, stats.total)) * 100))}%` }} />
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold text-muted uppercase tracking-wider mt-1">
            <span>Mới ({stats.newCount})</span>
            <span className="text-[#22c55e]">Chốt ({stats.wonCount})</span>
          </div>
        </section>

        <section className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          <button className="px-4 py-2 bg-text text-background text-[12px] font-bold rounded-full whitespace-nowrap shrink-0 shadow-sm">
            Tất cả ({stats.total})
          </button>
          <button className="px-4 py-2 bg-card text-muted text-[12px] font-bold rounded-full whitespace-nowrap border border-border shrink-0 hover:bg-black/5 transition-colors shadow-sm">
            <span className="w-2 h-2 rounded-full bg-muted inline-block mr-1.5" /> Khách mới
          </button>
          <button className="px-4 py-2 bg-card text-[#3b82f6] text-[12px] font-bold rounded-full whitespace-nowrap border border-border shrink-0 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#3b82f6] inline-block mr-1.5" /> Đang tư vấn ({stats.contactedCount})
          </button>
          <button className="px-4 py-2 bg-card text-muted text-[12px] font-bold rounded-full whitespace-nowrap border border-border shrink-0 hover:bg-black/5 transition-colors shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#f97316] inline-block mr-1.5" /> Đề xuất ({stats.proposalCount})
          </button>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-[16px] font-black text-text tracking-tight">Danh sách Khách hàng</h3>
            <button className="text-[12px] font-bold text-[#4f46e5] bg-[#4f46e5]/10 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Filter size={12} /> Bộ lọc
            </button>
          </div>

          {isLoading ? (
            <div className="p-4 text-center text-muted text-[13px]">Đang tải...</div>
          ) : isError ? (
            <div className="p-4 text-center text-rose-500 text-[13px] font-bold">Không thể tải dữ liệu Sales.</div>
          ) : leads.length === 0 ? (
            <div className="p-4 text-center text-muted text-[13px]">Không có lead nào phù hợp.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {leads.map((item, i) => (
                <div
                  key={item.id || i}
                  onClick={() => setSelectedLead(item)}
                  className="bg-card border border-border rounded-[20px] p-4 shadow-sm flex flex-col relative overflow-hidden active:scale-[0.98] transition-transform w-full box-border cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3 w-full">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-[44px] h-[44px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0 border border-border">
                        <User size={18} className="text-muted" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-black text-text truncate group-hover:text-[#4f46e5] transition-colors">{item.name}</span>
                          {item.temperature === "hot" && <Flame size={14} className="text-[#ef4444] shrink-0" />}
                          {item.temperature === "warm" && <ThermometerSun size={14} className="text-[#f97316] shrink-0" />}
                          {item.temperature === "cold" && <Snowflake size={14} className="text-[#3b82f6] shrink-0" />}
                        </div>
                        <span className="text-[12px] font-medium text-muted mt-0.5">{item.phone}</span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full flex-shrink-0 ${item.statusColor} text-white shadow-sm tracking-wide`}>
                      {item.statusLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pl-[56px] flex-wrap">
                    <span className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-[11px] font-bold text-muted border border-border/50">{item.source}</span>
                    <span className="px-3 py-1 bg-[#22c55e]/10 text-[#22c55e] rounded-full text-[11px] font-bold border border-[#22c55e]/20">Vốn: {item.budget}</span>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                    <div className="text-[12px] font-bold text-muted flex items-center gap-1.5">
                      <Clock size={14} className={item.statusLabel === "Hẹn xem phòng" ? "text-[#f97316]" : "text-muted"} /> {item.time}
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
          )}
        </section>
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedLead(null)} />
          <div className="w-full md:w-[480px] bg-card h-full shadow-2xl relative z-10 animate-in slide-in-from-bottom md:slide-in-from-right duration-300 flex flex-col mt-12 md:mt-0 rounded-t-[24px] md:rounded-none">
            <div className="p-4 md:p-6 border-b border-border flex items-center justify-between sticky top-0 bg-card z-20">
              <div className="flex items-center gap-3">
                <h2 className="font-black text-[18px] md:text-[20px] text-text">Chi tiết Cơ hội</h2>
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${selectedLead.statusColor} text-white uppercase tracking-wider`}>
                  {selectedLead.statusLabel}
                </span>
              </div>
              <button onClick={() => setSelectedLead(null)} className="w-[32px] h-[32px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 transition-colors">
                <span className="text-[14px] font-black text-muted">✕</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
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
                      {selectedLead.temperature === "hot" && (
                        <>
                          <Flame size={16} className="text-[#ef4444]" /> Nóng
                        </>
                      )}
                      {selectedLead.temperature === "warm" && (
                        <>
                          <ThermometerSun size={16} className="text-[#f97316]" /> Ấm
                        </>
                      )}
                      {selectedLead.temperature === "cold" && (
                        <>
                          <Snowflake size={16} className="text-[#3b82f6]" /> Lạnh
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[13px] font-black text-text uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Ghi chú của Sales</span>
                  <button className="text-[#4f46e5] flex items-center gap-1 text-[11px] hover:underline">
                    <FileEdit size={12} /> Sửa
                  </button>
                </h4>
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-[16px] border border-border text-[13px] font-medium text-text leading-relaxed">
                  {selectedLead.notes}
                </div>
              </div>

              <div>
                <h4 className="text-[13px] font-black text-text uppercase tracking-wider mb-3">Lịch sử Chăm sóc</h4>
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-[16px] border border-border text-[13px] font-medium text-text leading-relaxed">
                  {selectedLead.notes?.trim()
                    ? selectedLead.notes
                    : "Chưa có lịch sử hoạt động chi tiết từ DB cho lead này."}
                </div>
                <div className="mt-3 text-[11px] font-medium text-muted">
                  Cập nhật gần nhất: {selectedLead.time}
                </div>
              </div>
            </div>

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
