"use client";

import React from "react";
import { X, ShieldCheck, FileText, CheckCircle2, Bookmark, RefreshCcw, Banknote, PenTool, Printer, Loader2 } from "lucide-react";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";
import { useCollectDepositMutation, useRefundDepositMutation, useConvertContractMutation, useCancelDepositMutation } from "../../lib/mutations/deposits.mutations";
import { Drawer } from "../ui/Drawer";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export default function OperationsDepositDrawer({ deposit, onClose }: { deposit: UI_Deposit | null, onClose: () => void }) {
  const collectMutation = useCollectDepositMutation();
  const refundMutation = useRefundDepositMutation();
  const convertMutation = useConvertContractMutation();
  const cancelMutation = useCancelDepositMutation();
  
  if (!deposit) return null;

  const handleCollect = () => {
    collectMutation.mutate({ id: deposit.id });
  };

  const handleRefund = () => {
    const reason = window.prompt("Lý do hoàn tiền?");
    if (reason) refundMutation.mutate({ id: deposit.id, reason });
  };

  const handleCancel = () => {
    const reason = window.prompt("Lý do hủy phiếu cọc?");
    if (reason) cancelMutation.mutate({ id: deposit.id, reason });
  };

  const handleConvert = () => {
    if (window.confirm("Bạn có chắc muốn chuyển cọc này thành hợp đồng?")) {
      convertMutation.mutate(deposit.id, {
        onSuccess: () => {
          window.alert("Đã chuyển thành hợp đồng thành công!");
          onClose();
        }
      });
    }
  };

  const amountStr = new Intl.NumberFormat('vi-VN').format(deposit.amount);
  const typeName = deposit.type === 'BOOKING' ? 'Giữ phòng' : deposit.type === 'SECURITY' ? 'Bảo đảm' : 'Giữ chỗ';
  const isPaid = deposit.status === 'PAID';
  const isConverted = deposit.status === 'CONVERTED_TO_CONTRACT';
  const isRefunded = deposit.status === 'REFUNDED';
  const isCancelled = deposit.status === 'CANCELLED';

  return (
    <Drawer
      testId="deposit-detail-drawer"
      closeTestId="deposit-detail-close"
      isOpen={!!deposit}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-[12px]">
          <h2 className="font-black text-[20px] text-text">Chi tiết Đặt cọc</h2>
          <span className="bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 font-black text-[14px] px-[10px] py-[4px] rounded-[6px]">{deposit.id}</span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-[12px]">
            <Button variant="ghost">
              <Printer size={16} className="mr-2 text-muted" /> In phiếu
            </Button>
          </div>
          <div className="flex items-center gap-[12px]">
            {(deposit.status === 'DRAFT' || deposit.status === 'PENDING') && (
              <Button onClick={handleCancel} disabled={cancelMutation.isPending} variant="ghost" className="text-muted hover:text-rose-500 hover:bg-rose-500/10">
                {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <X size={16} className="mr-2" />} Hủy phiếu
              </Button>
            )}
            {(isConverted || isPaid) && (
              <Button onClick={handleRefund} disabled={refundMutation.isPending} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500">
                {refundMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCcw size={16} className="mr-2" />} Hoàn tiền
              </Button>
            )}
            {(deposit.status === 'PENDING' || deposit.status === 'DRAFT') && (
              <Button onClick={handleCollect} disabled={collectMutation.isPending} className="bg-[#10b981] hover:bg-[#059669] text-white">
                {collectMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Banknote size={16} className="mr-2" />} Thu tiền cọc
              </Button>
            )}
            {isPaid && (
              <Button onClick={handleConvert} disabled={convertMutation.isPending} variant="primary">
                {convertMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <PenTool size={16} className="mr-2" />} Lên hợp đồng
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-[24px]">
        {/* Top Info Banner */}
        <Card className="p-[20px] flex flex-col gap-[16px]">
          <div className="flex items-start justify-between gap-[16px]">
            <div className="flex flex-col gap-[8px]">
              <h3 className="font-black text-[22px] text-text leading-tight">{deposit.customerName}</h3>
              <div className="flex items-center gap-[8px]">
                <span className="text-[12px] font-bold bg-black/5 dark:bg-white/5 px-[8px] py-[4px] rounded-[6px]">{deposit.roomCode} · {deposit.buildingName}</span>
                <span className={`text-[11px] font-black uppercase px-[8px] py-[4px] rounded-[6px] border ${deposit.type === 'SECURITY' ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' : 'text-[#0ea5e9] bg-[#0ea5e9]/10 border-[#0ea5e9]/20'}`}>
                  Cọc {typeName}
                </span>
                <span data-testid="deposit-status-badge" className="text-[11px] font-black uppercase px-[8px] py-[4px] rounded-[6px] border text-muted bg-black/5 dark:bg-white/5 border-border">
                  {deposit.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] pt-[16px] border-t border-border/50">
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Số tiền cọc</span>
              <span className="text-[15px] font-black text-text">{amountStr}đ</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Đã thu</span>
              <span className="text-[15px] font-black text-[#10b981]">{isPaid || isConverted ? amountStr : '0'}đ</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Ngày tạo</span>
              <span className="text-[14px] font-bold text-text">{new Date(deposit.createdAt).toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Khách hàng</span>
              <span className="text-[14px] font-bold text-text">{deposit.customerName}</span>
            </div>
          </div>
        </Card>

        {/* Activity / Timeline */}
        <Card className="p-[20px] flex flex-col gap-[16px]">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><RefreshCcw size={16} className="text-[#f97316]" /> Deposit Workflow</h4>
            
            <div className="flex flex-col gap-[0px] relative mt-[8px]">
              <div className="absolute left-[15px] top-[10px] bottom-[20px] w-[2px] bg-border" />
              
              <div className="flex gap-[16px] relative z-10 pb-[24px]">
                <div className="w-[32px] h-[32px] rounded-full bg-[#10b981] flex items-center justify-center shrink-0 border-[4px] border-card"><CheckCircle2 size={14} className="text-white" /></div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className="text-[13px] font-bold text-text leading-none">Draft / Pending (Tạo phiếu)</span>
                  <span className="text-[11px] text-muted">{new Date(deposit.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
              
              <div className="flex gap-[16px] relative z-10 pb-[24px]">
                <div className={`w-[32px] h-[32px] rounded-full ${(isPaid || isConverted || isRefunded) ? 'bg-[#10b981]' : 'bg-black/10 dark:bg-white/10'} flex items-center justify-center shrink-0 border-[4px] border-card`}>
                  {(isPaid || isConverted || isRefunded) ? <CheckCircle2 size={14} className="text-white" /> : <div className="w-[8px] h-[8px] bg-muted rounded-full" />}
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className={`text-[13px] font-bold ${(isPaid || isConverted || isRefunded) ? 'text-text' : 'text-muted'} leading-none`}>Deposit Collected (Thu tiền cọc)</span>
                  {(isPaid || isConverted || isRefunded) && <span className="text-[11px] text-muted">Đã thu đủ {amountStr}đ</span>}
                </div>
              </div>

              <div className="flex gap-[16px] relative z-10 pb-[24px]">
                <div className={`w-[32px] h-[32px] rounded-full ${(isConverted) ? 'bg-[#10b981]' : 'bg-black/10 dark:bg-white/10'} flex items-center justify-center shrink-0 border-[4px] border-card`}>
                  {(isConverted) ? <CheckCircle2 size={14} className="text-white" /> : <div className="w-[8px] h-[8px] bg-muted rounded-full" />}
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className={`text-[13px] font-bold ${(isConverted) ? 'text-text' : 'text-muted'} leading-none`}>Contract Created (Lên hợp đồng)</span>
                  {(isConverted) && <span className="text-[11px] text-muted">Đã chuyển thành hợp đồng</span>}
                </div>
              </div>
              
              <div className="flex gap-[16px] relative z-10">
                <div className={`w-[32px] h-[32px] rounded-full ${(deposit.status === 'REFUNDED') ? 'bg-rose-500' : 'bg-black/10 dark:bg-white/10'} flex items-center justify-center shrink-0 border-[4px] border-card`}>
                  {(deposit.status === 'REFUNDED') ? <RefreshCcw size={14} className="text-white" /> : <div className="w-[8px] h-[8px] bg-muted rounded-full" />}
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className={`text-[13px] font-bold ${(deposit.status === 'REFUNDED') ? 'text-rose-500' : 'text-muted'} leading-none`}>Refund / Cancelled (Hoàn tiền / Hủy)</span>
                  {deposit.status === 'REFUNDED' && <span className="text-[11px] text-rose-500 font-bold mt-[4px]">Đã hoàn tiền cọc</span>}
                </div>
              </div>
            </div>
        </Card>
      </div>
    </Drawer>
  );
}
