"use client";

import React, { useEffect } from "react";
import { X, CheckCircle2, MessageSquare, FileText, PenTool, CalendarClock, Download, Trash2, Link as LinkIcon, History, AlertTriangle, ShieldCheck, User } from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export default function OperationsContractDrawer({ contract, onClose }: { contract: any | null, onClose: () => void }) {
  const getBadgeVariant = (status: string) => {
    switch (status) {
      case "Đang hiệu lực": return "success";
      case "Sắp hết hạn": return "warning";
      case "Chờ ký": return "primary";
      case "Có công nợ": return "error";
      case "Chờ gia hạn": return "primary";
      case "Đã chấm dứt": return "neutral";
      default: return "neutral";
    }
  };

  if (!contract) return null;

  return (
    <Drawer 
      testId="contract-detail-drawer"
      closeTestId="contract-detail-close"
      isOpen={!!contract} 
      onClose={onClose} 
      size="xl"
      title={
        <div className="flex items-center gap-3">
          <span className="font-black text-[20px] text-text">Chi tiết hợp đồng</span>
          <Badge variant="primary">{contract.code || contract.id.slice(0,8)}</Badge>
        </div>
      }
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-rose-500 hover:bg-rose-500/10">
              <Trash2 size={16} className="mr-2" /> Chấm dứt
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary">
              <Download size={16} className="mr-2" /> Xuất PDF
            </Button>
            <Button variant="outline">
              <CalendarClock size={16} className="mr-2" /> Gia hạn
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-[24px]">
        {/* Top Info Banner */}
        <Card className="p-[20px] flex flex-col gap-[16px]">
          <div className="flex items-start justify-between gap-[16px]">
            <div className="flex flex-col gap-[8px]">
              <h3 className="font-black text-[22px] text-text leading-tight">{contract.customer?.name || 'Chưa rõ khách thuê'}</h3>
              <div className="flex items-center gap-[8px]">
                <Badge variant="neutral">{contract.room?.number || 'Chưa phòng'} · {contract.room?.building?.name || 'Chưa toà'}</Badge>
                <Badge data-testid="contract-status-badge" variant={getBadgeVariant(contract.status)}>{contract.status || 'Đang hiệu lực'}</Badge>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-[4px]">
              <span className="text-[12px] font-bold text-muted uppercase tracking-wider">Trạng thái ký</span>
              <div className={`flex items-center gap-[6px] text-[14px] font-black text-[#10b981]`}>
                <CheckCircle2 size={16} /> Đã ký
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] pt-[16px] border-t border-border/50">
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Ngày bắt đầu</span>
              <span className="text-[14px] font-bold text-text flex items-center gap-1">{new Date(contract.startDate).toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Ngày kết thúc</span>
              <span className="text-[14px] font-bold text-text flex items-center gap-1">{new Date(contract.endDate).toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Thời gian còn lại</span>
              <span className={`text-[14px] font-black flex items-center gap-1 text-[#f97316]`}>{Math.max(0, Math.ceil((new Date(contract.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} ngày</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Khách ở ghép</span>
              <span className="text-[14px] font-bold text-text flex items-center gap-1"><User size={14} className="text-muted"/> 2 người</span>
            </div>
          </div>
        </Card>

        <div className="flex flex-col lg:flex-row gap-[24px]">
          {/* Left Column */}
          <div className="flex-1 flex flex-col gap-[24px]">
            {/* Financial Info */}
            <Card className="p-[20px] flex flex-col gap-[16px]">
              <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><FileText size={16} className="text-[#6366f1]" /> Thông tin Tài chính</h4>
              <div className="flex flex-col gap-[12px]">
                <div className="flex items-center justify-between p-[12px] bg-black/5 dark:bg-white/5 rounded-[10px]">
                  <span className="text-[13px] font-bold text-muted">Giá thuê / tháng</span>
                  <span className="text-[15px] font-black text-text">{(contract.monthlyRent || 0).toLocaleString()}đ</span>
                </div>
                <div className="flex items-center justify-between p-[12px] bg-black/5 dark:bg-white/5 rounded-[10px]">
                  <span className="text-[13px] font-bold text-muted">Tiền cọc (Giữ hộ)</span>
                  <span className="text-[15px] font-black text-text">{(contract.depositMoney || 0).toLocaleString()}đ</span>
                </div>
                <div className="flex items-center justify-between p-[12px] bg-rose-500/10 border border-rose-500/20 rounded-[10px]">
                  <span className="text-[13px] font-bold text-rose-500">Công nợ hiện tại</span>
                  <span className="text-[15px] font-black text-rose-500">0đ</span>
                </div>
              </div>
            </Card>

            {/* Files & Signatures */}
            <Card className="p-[20px] flex flex-col gap-[16px]">
              <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><ShieldCheck size={16} className="text-[#10b981]" /> Hồ sơ & Chữ ký</h4>
              <div className="flex flex-col gap-[12px]">
                <div className="flex items-center justify-between p-[12px] border border-border rounded-[10px] hover:border-[#6366f1]/50 cursor-pointer transition-colors group">
                  <div className="flex items-center gap-[12px]">
                    <div className="w-[36px] h-[36px] rounded-[8px] bg-blue-500/10 text-blue-500 flex items-center justify-center"><FileText size={16}/></div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-text group-hover:text-[#6366f1] transition-colors">Hợp đồng thuê nhà bản chính.pdf</span>
                      <span className="text-[11px] font-medium text-muted">2.4 MB · Cập nhật 2 tháng trước</span>
                    </div>
                  </div>
                  {contract.signStatus === 'Đã ký' ? <CheckCircle2 size={18} className="text-[#10b981]" /> : <Badge variant="error">Thiếu chữ ký</Badge>}
                </div>
                <div className="flex items-center justify-between p-[12px] border border-border rounded-[10px] hover:border-[#6366f1]/50 cursor-pointer transition-colors group">
                  <div className="flex items-center gap-[12px]">
                    <div className="w-[36px] h-[36px] rounded-[8px] bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><LinkIcon size={16}/></div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-text group-hover:text-[#6366f1] transition-colors">CCCD_NguyenVanA.jpg</span>
                      <span className="text-[11px] font-medium text-muted">Đã xác thực</span>
                    </div>
                  </div>
                  <CheckCircle2 size={18} className="text-[#10b981]" />
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Timeline */}
          <div className="w-full lg:w-[320px] flex flex-col gap-[16px]">
            <Card className="p-[20px] flex flex-col gap-[16px] flex-1">
              <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><History size={16} className="text-[#f97316]" /> Lifecycle Timeline</h4>
              <div className="flex flex-col gap-[0px] relative mt-[8px]">
                {/* Timeline Line */}
                <div className="absolute left-[15px] top-[10px] bottom-[20px] w-[2px] bg-border" />
                
                <div className="flex gap-[16px] relative z-10 pb-[24px]">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#10b981] flex items-center justify-center shrink-0 border-[4px] border-card"><CheckCircle2 size={14} className="text-white" /></div>
                  <div className="flex flex-col gap-[4px] pt-[6px]">
                    <span className="text-[13px] font-bold text-text leading-none">Tạo hợp đồng</span>
                    <span className="text-[11px] text-muted">01/01/2026, 09:00</span>
                  </div>
                </div>
                <div className="flex gap-[16px] relative z-10 pb-[24px]">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#10b981] flex items-center justify-center shrink-0 border-[4px] border-card"><CheckCircle2 size={14} className="text-white" /></div>
                  <div className="flex flex-col gap-[4px] pt-[6px]">
                    <span className="text-[13px] font-bold text-text leading-none">Khách đã ký điện tử</span>
                    <span className="text-[11px] text-muted">02/01/2026, 14:30</span>
                  </div>
                </div>
                <div className="flex gap-[16px] relative z-10 pb-[24px]">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#3b82f6] flex items-center justify-center shrink-0 border-[4px] border-card"><div className="w-[8px] h-[8px] bg-white rounded-full" /></div>
                  <div className="flex flex-col gap-[4px] pt-[6px]">
                    <span className="text-[13px] font-bold text-[#3b82f6] leading-none">Đang thuê</span>
                    <span className="text-[11px] text-muted">Hiệu lực đến 31/12/2026</span>
                  </div>
                </div>
                <div className="flex gap-[16px] relative z-10">
                  <div className="w-[32px] h-[32px] rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0 border-[4px] border-card"><div className="w-[8px] h-[8px] bg-muted rounded-full" /></div>
                  <div className="flex flex-col gap-[4px] pt-[6px]">
                    <span className="text-[13px] font-bold text-muted leading-none">Chấm dứt / Gia hạn</span>
                    <span className="text-[11px] text-muted">Dự kiến 31/12/2026</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
