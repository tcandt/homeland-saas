"use client";

import React, { useEffect } from "react";
import { X, FileText, Send, Wallet, CheckCircle2, History, MessageCircle, Phone, Smartphone, AlertTriangle, Bell } from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export default function OperationsBillingDrawer({ invoice, onClose }: { invoice: any | null, onClose: () => void }) {
  if (!invoice) return null;

  return (
    <Drawer 
      testId="invoice-detail-drawer"
      closeTestId="invoice-detail-close"
      isOpen={!!invoice} 
      onClose={onClose} 
      title={
        <div className="flex items-center gap-[12px]">
          <h2 className="font-black text-[20px] text-text">Chi tiết Hóa đơn</h2>
          <span className="bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 font-black text-[14px] px-[10px] py-[4px] rounded-[6px]">{invoice.code || invoice.id.slice(0,8)}</span>
        </div>
      }
      size="xl"
    >
      <div className="flex flex-col gap-[24px]">
        {/* Top Info Banner */}
        <Card className="p-[20px] flex flex-col gap-[16px]">
          <div className="flex items-start justify-between gap-[16px]">
            <div className="flex flex-col gap-[8px]">
              <h3 className="font-black text-[22px] text-text leading-tight">{invoice.customer?.name || 'Chưa rõ khách thuê'}</h3>
              <div className="flex items-center gap-[8px]">
                <span className="text-[12px] font-bold bg-black/5 dark:bg-white/5 px-[8px] py-[4px] rounded-[6px]">{invoice.contract?.room?.number || 'Chưa phòng'} · {invoice.contract?.room?.building?.name || 'Chưa tòa nhà'}</span>
                <span data-testid="invoice-status-badge" className={`text-[11px] font-black uppercase px-[8px] py-[4px] rounded-[6px] border ${
                  invoice.status === 'Overdue' ? 'text-rose-500 bg-rose-500/10 border-rose-500/20' :
                  invoice.status === 'Paid' ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' :
                  invoice.status === 'Partially Paid' ? 'text-[#f97316] bg-[#f97316]/10 border-[#f97316]/20' :
                  'text-[#6366f1] bg-[#6366f1]/10 border-[#6366f1]/20'
                }`}>
                  {invoice.status || 'Created'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Progress */}
          <div className="flex flex-col gap-[8px] mt-[8px]">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-bold text-muted uppercase tracking-wider">Tiến độ thu</span>
              <span className={`font-black ${invoice.paidPercent === 100 ? 'text-[#10b981]' : invoice.status === 'Overdue' ? 'text-rose-500' : 'text-[#6366f1]'}`}>{invoice.paidPercent || 0}%</span>
            </div>
            <div className="w-full h-[8px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex relative">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${invoice.paidPercent === 100 ? 'bg-[#10b981]' : invoice.status === 'Overdue' ? 'bg-rose-500' : 'bg-[#6366f1]'}`} 
                style={{ width: `${invoice.paidPercent || 0}%` }} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] pt-[16px] border-t border-border/50">
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Kỳ cước</span>
              <span className="text-[14px] font-bold text-text flex items-center gap-1">{invoice.period || '---'}</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Ngày lập</span>
              <span className="text-[14px] font-bold text-text flex items-center gap-1">{new Date(invoice.createdAt || invoice.dueDate).toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Hạn thanh toán</span>
              <span className={`text-[14px] font-black flex items-center gap-1 ${invoice.status === 'Overdue' ? 'text-rose-500' : 'text-text'}`}>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('vi-VN') : '---'}</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Còn nợ</span>
              <span className={`text-[16px] font-black ${invoice.status === 'Overdue' ? 'text-rose-500' : 'text-text'}`}>{invoice.debtAmount || 0}đ</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[24px]">
          {/* Breakdown */}
          <Card className="p-[20px] flex flex-col gap-[16px]">
              <h4 className="font-black text-[15px] text-text border-b border-border/50 pb-3">Chi tiết phí (Breakdown)</h4>
              
              <div className="flex flex-col gap-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[13px] text-text">Tiền phòng</span>
                  <span className="font-black text-[13px] text-text">5.000.000đ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[13px] text-text">Điện (200 kWh)</span>
                  <span className="font-black text-[13px] text-text">700.000đ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[13px] text-text">Nước (10 m3)</span>
                  <span className="font-black text-[13px] text-text">300.000đ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[13px] text-text">Phí dịch vụ</span>
                  <span className="font-black text-[13px] text-text">500.000đ</span>
                </div>
                {invoice.status === 'Overdue' && (
                <div className="flex items-center justify-between pt-[12px] border-t border-border/50">
                  <span className="font-bold text-[13px] text-rose-500">Phạt trễ hạn</span>
                  <span className="font-black text-[13px] text-rose-500">200.000đ</span>
                </div>
                )}
                <div className="flex items-center justify-between pt-[12px] border-t border-border/50 mt-[4px]">
                  <span className="font-black text-[15px] text-text uppercase">Tổng cộng</span>
                  <span className="font-black text-[18px] text-[#6366f1]">{(invoice.totalAmount || 0).toLocaleString()}đ</span>
                </div>
              </div>
          </Card>

          {/* Reminder & Communication */}
          <Card className="p-[20px] flex flex-col gap-[16px]">
              <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><Bell size={16} className="text-[#f97316]" /> Nhắc nợ & Liên hệ</h4>
              
              <div className="grid grid-cols-3 gap-[8px]">
                <button className="h-[40px] bg-[#0ea5e9]/10 hover:bg-[#0ea5e9]/20 text-[#0ea5e9] rounded-[10px] font-bold text-[13px] flex items-center justify-center gap-[6px] transition-colors">
                  <MessageCircle size={16} /> Zalo
                </button>
                <button className="h-[40px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-[10px] font-bold text-[13px] flex items-center justify-center gap-[6px] transition-colors">
                  <Smartphone size={16} /> SMS
                </button>
                <button className="h-[40px] bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] rounded-[10px] font-bold text-[13px] flex items-center justify-center gap-[6px] transition-colors">
                  <Phone size={16} /> Gọi
                </button>
              </div>

              <div className="flex flex-col gap-[12px] mt-[8px]">
                <span className="font-bold text-[12px] text-muted uppercase tracking-wider">Lịch sử nhắc nợ</span>
                <div className="flex items-start gap-[12px]">
                  <div className="w-[8px] h-[8px] rounded-full bg-[#0ea5e9] mt-[6px]" />
                  <div className="flex flex-col gap-[2px]">
                    <span className="font-bold text-[13px] text-text">Đã gửi nhắc nợ qua Zalo</span>
                    <span className="font-bold text-[11px] text-muted">Bởi Admin lúc 09:30 sáng nay</span>
                  </div>
                </div>
              </div>
          </Card>
        </div>
        
        {/* History / Activity */}
        <Card className="p-[20px] flex flex-col gap-[16px]">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><History size={16} className="text-muted" /> Lịch sử thanh toán & Hoạt động</h4>
            
            <div className="flex flex-col gap-[0px] relative mt-[8px]">
              <div className="absolute left-[15px] top-[10px] bottom-[20px] w-[2px] bg-border" />
              
              <div className="flex gap-[16px] relative z-10 pb-[24px]">
                <div className="w-[32px] h-[32px] rounded-full bg-[#6366f1] flex items-center justify-center shrink-0 border-[4px] border-card"><FileText size={14} className="text-white" /></div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className="text-[13px] font-bold text-text leading-none">Tạo hóa đơn</span>
                  <span className="text-[11px] text-muted">Bởi Hệ thống tự động · {new Date(invoice.createdAt || invoice.dueDate).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>

              <div className="flex gap-[16px] relative z-10 pb-[24px]">
                <div className="w-[32px] h-[32px] rounded-full bg-[#0ea5e9] flex items-center justify-center shrink-0 border-[4px] border-card"><Send size={14} className="text-white" /></div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className="text-[13px] font-bold text-text leading-none">Gửi thông báo</span>
                  <span className="text-[11px] text-muted">Gửi hóa đơn qua App Cư dân & Zalo · {new Date(invoice.createdAt || invoice.dueDate).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
              
              {invoice.paidPercent > 0 && (
                <div className="flex gap-[16px] relative z-10 pb-[24px]">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#10b981] flex items-center justify-center shrink-0 border-[4px] border-card"><Wallet size={14} className="text-white" /></div>
                  <div className="flex flex-col gap-[4px] pt-[6px]">
                    <span className="text-[13px] font-bold text-text leading-none">Thanh toán một phần</span>
                    <span className="text-[11px] text-muted">Khách thanh toán {(invoice.paidAmount || 0).toLocaleString()}đ qua Momo · Hôm qua</span>
                  </div>
                </div>
              )}

              {invoice.status === 'Overdue' && (
                <div className="flex gap-[16px] relative z-10 pb-[24px]">
                  <div className="w-[32px] h-[32px] rounded-full bg-rose-500 flex items-center justify-center shrink-0 border-[4px] border-card"><AlertTriangle size={14} className="text-white" /></div>
                  <div className="flex flex-col gap-[4px] pt-[6px]">
                    <span className="text-[13px] font-bold text-rose-500 leading-none">Quá hạn thanh toán</span>
                    <span className="text-[11px] text-muted">Hóa đơn quá hạn {new Date(invoice.dueDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              )}
            </div>
        </Card>
        
      </div>

      <div className="sticky bottom-0 z-20 bg-background/80 backdrop-blur-md border-t border-border/50 p-[16px] px-[0px] flex items-center justify-between mt-auto mx-[-24px] px-[24px]">
        <div className="flex items-center gap-[12px]">
          <Button variant="outline" className="h-[40px] font-bold">
            <FileText size={16} className="text-muted mr-2" /> Xuất PDF
          </Button>
          <Button variant="outline" className="h-[40px] font-bold">
            <X size={16} className="text-rose-500 mr-2" /> Hủy hóa đơn
          </Button>
        </div>
        <div className="flex items-center gap-[12px]">
          {(invoice.status !== 'Paid') && (
            <button className="h-[40px] px-[16px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-[12px] font-bold text-[13px] transition-colors flex items-center gap-[8px]">
              <Send size={16} /> Gửi nhắc nợ
            </button>
          )}
          {(invoice.status !== 'Paid') && (
            <button className="h-[40px] px-[20px] bg-[#10b981] hover:bg-[#059669] text-white rounded-[12px] font-bold text-[14px] shadow-sm transition-all shadow-[#10b981]/20 flex items-center gap-[8px]">
              <Wallet size={16} /> Nhập thanh toán
            </button>
          )}
          {invoice.status === 'Paid' && (
            <Button variant="outline" disabled className="h-[40px] font-bold opacity-50 cursor-not-allowed">
              <CheckCircle2 size={16} className="mr-2" /> Đã thu đủ
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
