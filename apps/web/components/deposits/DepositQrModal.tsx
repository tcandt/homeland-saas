"use client";

import React, { useState, useEffect } from "react";
import { 
  QrCode, 
  Send, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { paymentsApi, PaymentRequestResponse } from "../../lib/api/payments.api";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";

interface DepositQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  deposit: UI_Deposit | null;
}

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export default function DepositQrModal({
  isOpen,
  onClose,
  deposit,
}: DepositQrModalProps) {
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingZalo, setIsSendingZalo] = useState(false);
  const [zaloSuccess, setZaloSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !deposit) {
      setPaymentRequest(null);
      setZaloSuccess(false);
      setErrorMessage(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    paymentsApi
      .createDepositRequest(deposit.id)
      .then((res: any) => {
        if (!isMounted) return;
        const data = res?.data || res;
        setPaymentRequest(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err?.response?.data?.message || err?.message || "Không thể tạo mã VietQR cho phiếu cọc này.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, deposit]);

  const handleSendZalo = async () => {
    if (!deposit) return;
    setIsSendingZalo(true);
    setErrorMessage(null);
    try {
      await paymentsApi.sendDepositToZalo(deposit.id);
      setZaloSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || "Lỗi khi gửi thông báo Zalo.");
    } finally {
      setIsSendingZalo(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!deposit) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0ea5e9]/10 text-[#0ea5e9] flex items-center justify-center font-bold">
            <QrCode size={18} />
          </div>
          <span>Mã VietQR Đặt cọc • {deposit.code}</span>
        </div>
      }
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[13px] rounded-xl flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {zaloSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[13px] rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            <span>Đã gửi thông báo kèm VietQR tới Zalo khách hàng thành công!</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-[13px] text-muted font-medium">Đang tạo mã VietQR...</p>
          </div>
        ) : paymentRequest ? (
          <div className="flex flex-col items-center gap-4">
            {/* QR Image */}
            <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col items-center">
              {paymentRequest.qrUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={paymentRequest.qrUrl}
                  alt={`VietQR ${paymentRequest.paymentCode}`}
                  className="w-[280px] h-[340px] object-contain rounded-lg"
                />
              ) : (
                <div className="w-[280px] h-[280px] flex items-center justify-center bg-slate-100 text-muted text-[13px]">
                  Không tải được ảnh QR
                </div>
              )}
            </div>

            {/* Bank Info Summary Card */}
            <div className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-border rounded-xl p-3.5 flex flex-col gap-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Số tài khoản:</span>
                <div className="flex items-center gap-1.5 font-bold text-text">
                  <span>{paymentRequest.bankAccountNumber}</span>
                  <span className="text-muted font-normal">({paymentRequest.bankName})</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(paymentRequest.bankAccountNumber, "acc")}
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-muted hover:text-text"
                  >
                    {copiedField === "acc" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Chủ tài khoản:</span>
                <span className="font-bold text-text">{paymentRequest.bankAccountName || "HKD NGUYEN DUC TINH"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Số tiền cọc:</span>
                <span className="font-black text-primary text-[15px]">
                  {currencyFormatter.format(paymentRequest.amount || deposit.amount)} đ
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/60">
                <span className="text-muted font-medium">Nội dung CK:</span>
                <div className="flex items-center gap-1.5">
                  <code className="px-2 py-0.5 bg-primary/10 text-primary font-black rounded text-[13px] tracking-wide">
                    {paymentRequest.paymentCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(paymentRequest.paymentCode, "code")}
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-muted hover:text-text"
                  >
                    {copiedField === "code" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Zalo Button */}
            <Button
              type="button"
              onClick={handleSendZalo}
              disabled={isSendingZalo}
              className="w-full h-11 bg-[#0068FF] hover:bg-[#0054cc] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-[#0068FF]/20"
            >
              {isSendingZalo ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Đang gửi Zalo...
                </>
              ) : (
                <>
                  <Send size={16} /> Gửi hóa đơn & QR tới Zalo khách hàng
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
