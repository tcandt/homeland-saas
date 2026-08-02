"use client";

import React from 'react';
import { CheckCircle2, Copy, ExternalLink, QrCode, RefreshCcw, Wallet } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import toast from 'react-hot-toast';
import { PaymentRequestResponse } from '@/lib/api/payments.api';

function copyText(value: string, label: string) {
  navigator.clipboard.writeText(value).then(() => {
    toast.success(`Đã copy ${label}`);
  }).catch(() => {
    toast.error(`Không thể copy ${label}`);
  });
}

export function SePayRequestCard({
  request,
  onRefresh,
}: {
  request: PaymentRequestResponse;
  onRefresh?: () => void;
}) {
  const isConfirmed = request.status === 'CONFIRMED';
  const amountLabel = new Intl.NumberFormat('vi-VN').format(Number(request.amount));

  return (
    <Card className="p-0 overflow-hidden border-[#6366f1]/20 bg-gradient-to-br from-[#6366f1]/5 via-background to-[#0ea5e9]/5">
      <div className="p-4 border-b border-border/60 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#6366f1]">
            <QrCode size={14} /> SePay QR
          </div>
          <h4 className="mt-2 text-lg font-black text-text">Thanh toán qua SePay</h4>
          <p className="mt-1 text-sm text-muted">Khách hàng quét QR, chuyển khoản đúng nội dung để hệ thống tự xác nhận. Nên tạo QR sau khi đã gửi hóa đơn qua Zalo.</p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${isConfirmed ? 'border-[#8b5cf6]/20 bg-[#8b5cf6]/10 text-[#8b5cf6]' : 'border-[#f97316]/20 bg-[#f97316]/10 text-[#f97316]'}`}>
          {isConfirmed ? <CheckCircle2 size={14} /> : <RefreshCcw size={14} className="animate-spin-slow" />}
          {request.status}
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
          <img
            src={request.qrUrl}
            alt="QR thanh toán SePay"
            className="h-auto w-full rounded-xl bg-white"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Số tiền</div>
              <div className="mt-1 text-lg font-black text-text">{amountLabel}đ</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Mã thanh toán</div>
              <div className="mt-1 text-sm font-black text-text break-all">{request.paymentCode}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Ngân hàng</div>
              <div className="mt-1 text-sm font-black text-text">{request.bankName}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Tài khoản</div>
              <div className="mt-1 text-sm font-black text-text">{request.bankAccountNumber}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Nội dung chuyển khoản</div>
            <div className="mt-2 rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2 text-sm font-black text-text break-all">
              {request.paymentCode}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(request.paymentCode, 'mã thanh toán')}>
                <Copy size={14} className="mr-2" /> Copy mã
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyText(request.bankAccountNumber, 'số tài khoản')}>
                <Wallet size={14} className="mr-2" /> Copy STK
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyText(String(request.amount), 'số tiền')}>
                <ExternalLink size={14} className="mr-2" /> Copy số tiền
              </Button>
              {onRefresh && (
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                  <RefreshCcw size={14} className="mr-2" /> Làm mới
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
