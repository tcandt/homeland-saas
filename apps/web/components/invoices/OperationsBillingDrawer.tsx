"use client";

import React, { useEffect } from "react";
import { X, FileText, Send, Wallet, CheckCircle2, History, MessageCircle, Phone, Smartphone, AlertTriangle, Bell, Trash2 } from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useIssueInvoiceMutation, usePayInvoiceMutation, useCancelInvoiceMutation, useWriteoffInvoiceMutation } from "@/lib/queries/invoices.queries";
import { useDeleteInvoiceMutation } from "@/lib/mutations/invoices.mutations";
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import toast from "react-hot-toast";

export default function OperationsBillingDrawer({ invoice, onClose }: { invoice: any | null, onClose: () => void }) {
  const issueMutation = useIssueInvoiceMutation();
  const payMutation = usePayInvoiceMutation();
  const cancelMutation = useCancelInvoiceMutation();
  const writeoffMutation = useWriteoffInvoiceMutation();
  const deleteMutation = useDeleteInvoiceMutation();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  if (!invoice) return null;
  const financials = getInvoiceFinancials(invoice);

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
                  invoice.status === 'Paid' ? 'text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/20' :
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
              <span className={`font-black ${invoice.paidPercent === 100 ? 'text-[#8b5cf6]' : invoice.status === 'Overdue' ? 'text-rose-500' : 'text-[#6366f1]'}`}>{invoice.paidPercent || 0}%</span>
            </div>
            <div className="w-full h-[8px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex relative">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${invoice.paidPercent === 100 ? 'bg-[#8b5cf6]' : invoice.status === 'Overdue' ? 'bg-rose-500' : 'bg-[#6366f1]'}`} 
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
              <span className={`text-[16px] font-black ${invoice.status === 'Overdue' ? 'text-rose-500' : 'text-text'}`}>{financials.remaining.toLocaleString()}đ</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[24px]">
          {/* Breakdown */}
          <Card className="p-[20px] flex flex-col gap-[16px]">
              <h4 className="font-black text-[15px] text-text border-b border-border/50 pb-3">Chi tiết phí (Breakdown)</h4>
              
              <div className="flex flex-col gap-[12px]">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="font-bold text-[13px] text-text">{item.name || item.description} {item.quantity > 1 ? `(${item.quantity})` : ''}</span>
                      <span className="font-black text-[13px] text-text">{(Number(item.amount) || 0).toLocaleString()}đ</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center p-4 border-dashed border-border border rounded-lg">
                    <span className="text-[12px] text-muted font-medium">Chưa có chi tiết phí</span>
                  </div>
                )}

                {Number(invoice.discount || 0) > 0 && (
                  <div className="flex items-center justify-between pt-[12px] border-t border-border/50">
                    <span className="font-bold text-[13px] text-indigo-500">Giảm giá</span>
                    <span className="font-black text-[13px] text-indigo-500">-{(Number(invoice.discount) || 0).toLocaleString()}đ</span>
                  </div>
                )}

                {invoice.status === 'Overdue' && Number(invoice.penaltyAmount || 0) > 0 && (
                  <div className="flex items-center justify-between pt-[12px] border-t border-border/50">
                    <span className="font-bold text-[13px] text-rose-500">Phạt trễ hạn</span>
                    <span className="font-black text-[13px] text-rose-500">{(Number(invoice.penaltyAmount) || 0).toLocaleString()}đ</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-[12px] border-t border-border/50 mt-[4px]">
                  <span className="font-black text-[15px] text-text uppercase">Tổng cộng</span>
                  <span className="font-black text-[18px] text-[#6366f1]">{(Number(invoice.total) || Number(invoice.totalAmount) || 0).toLocaleString()}đ</span>
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
                <button className="h-[40px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 rounded-[10px] font-bold text-[13px] flex items-center justify-center gap-[6px] transition-colors">
                  <Smartphone size={16} /> SMS
                </button>
                <button className="h-[40px] bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 text-[#8b5cf6] rounded-[10px] font-bold text-[13px] flex items-center justify-center gap-[6px] transition-colors">
                  <Phone size={16} /> Gọi
                </button>
              </div>

              <div className="flex flex-col gap-[12px] mt-[8px]">
                <span className="font-bold text-[12px] text-muted uppercase tracking-wider">Lịch sử nhắc nợ</span>
                <div className="text-center text-[12px] text-muted italic">Chưa có lịch sử nhắc nợ</div>
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
                  <div className="w-[32px] h-[32px] rounded-full bg-[#8b5cf6] flex items-center justify-center shrink-0 border-[4px] border-card"><Wallet size={14} className="text-white" /></div>
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
          {(invoice.status === 'DRAFT' || invoice.status === 'ISSUED') && (
            <Button 
              data-testid="btn-cancel-invoice"
              variant="outline" 
              className="h-[40px] font-bold text-rose-500 border-rose-500/20 hover:bg-rose-500/10"
              onClick={() => {
                cancelMutation.mutate(invoice.id, {
                  onSuccess: () => toast.success('Hóa đơn đã bị hủy')
                });
              }}
              disabled={cancelMutation.isPending}
            >
              <X size={16} className="mr-2" /> Hủy hóa đơn
            </Button>
          )}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2 border-l border-border/50 pl-2 ml-2">
              <span className="text-sm text-rose-500 font-bold">Xóa hẳn hóa đơn?</span>
              <Button
                data-testid="btn-confirm-delete"
                variant="danger"
                className="h-[40px] font-bold"
                onClick={() =>
                  deleteMutation.mutate(invoice.id, {
                    onSuccess: () => {
                      setShowDeleteConfirm(false);
                      onClose();
                    }
                  })
                }
                isLoading={deleteMutation.isPending}
              >
                Xác nhận
              </Button>
              <Button variant="ghost" className="h-[40px]" onClick={() => setShowDeleteConfirm(false)}>Hủy</Button>
            </div>
          ) : (
            <Button
              data-testid="btn-delete-invoice"
              variant="ghost"
              className="h-[40px] font-bold text-rose-500 hover:bg-rose-500/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={16} className="mr-2" /> Xóa
            </Button>
          )}
          {(invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID' || invoice.status === 'OVERDUE') && (
            <Button 
              data-testid="btn-writeoff-invoice"
              variant="outline" 
              className="h-[40px] font-bold text-orange-500 border-orange-500/20 hover:bg-orange-500/10"
              onClick={() => {
                writeoffMutation.mutate(invoice.id, {
                  onSuccess: () => toast.success('Hóa đơn đã được xóa nợ')
                });
              }}
              disabled={writeoffMutation.isPending}
            >
              <AlertTriangle size={16} className="mr-2" /> Xóa nợ
            </Button>
          )}
        </div>
        <div className="flex items-center gap-[12px]">
          {invoice.status === 'DRAFT' && (
            <button 
              data-testid="btn-issue-invoice"
              className="h-[40px] px-[20px] bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-[12px] font-bold text-[14px] shadow-sm transition-all shadow-[#6366f1]/20 flex items-center gap-[8px]"
              onClick={() => {
                issueMutation.mutate(invoice.id, {
                  onSuccess: () => toast.success('Phát hành hóa đơn thành công')
                });
              }}
              disabled={issueMutation.isPending}
            >
              <Send size={16} /> Phát hành
            </button>
          )}
          {(invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID' || invoice.status === 'OVERDUE') && (
            <button 
              data-testid="btn-pay-invoice"
              className="h-[40px] px-[20px] bg-[#8b5cf6] hover:bg-[#6366f1] text-white rounded-[12px] font-bold text-[14px] shadow-sm transition-all shadow-[#8b5cf6]/20 flex items-center gap-[8px]"
              onClick={() => {
                const remaining = financials.remaining;
                const amount = prompt(`Nhập số tiền thanh toán (Tối đa: ${remaining}):`, remaining.toString());
                if (amount && !isNaN(Number(amount))) {
                  payMutation.mutate({ id: invoice.id, amount: Number(amount) }, {
                    onSuccess: () => toast.success('Ghi nhận thanh toán thành công')
                  });
                }
              }}
              disabled={payMutation.isPending}
            >
              <Wallet size={16} /> Nhập thanh toán
            </button>
          )}
          {invoice.status === 'PAID' && (
            <Button variant="outline" disabled className="h-[40px] font-bold opacity-50 cursor-not-allowed">
              <CheckCircle2 size={16} className="mr-2" /> Đã thu đủ
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
