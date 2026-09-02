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
  ShieldCheck,
  Home,
  User,
  Building
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

const LANDLORDS: Record<string, any> = {
  TINH: {
    hoTenChuNha: "NGUYỄN ĐỨC TÍNH",
    chuTaiKhoan: "HKD NGUYEN DUC TINH",
    soTaiKhoan: "8818406081",
    nganHang: "BIDV",
    bankCode: "BIDV",
  },
  THE: {
    hoTenChuNha: "PHAN VĂN THẾ",
    chuTaiKhoan: "HKD PHAN VAN THE",
    soTaiKhoan: "8827905414",
    nganHang: "BIDV",
    bankCode: "BIDV",
  },
};

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

    // Determine landlord config based on room / building
    const bName = (deposit.buildingName || "").toUpperCase();
    const landlordKey = bName.includes("THE") ? "THE" : "TINH";
    const landlord = LANDLORDS[landlordKey] || LANDLORDS["TINH"];

    const cleanRoom = (deposit.roomCode || "PHONG").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const cleanCustomer = (deposit.customerName || "KHACH")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const memo = `COC ${cleanRoom} ${cleanCustomer}`.slice(0, 25);
    const amount = Number(deposit.amount || 0);

    const fallbackQrUrl = `https://img.vietqr.io/image/${landlord.bankCode}-${landlord.soTaiKhoan}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(landlord.chuTaiKhoan)}`;

    const fallbackRequest: PaymentRequestResponse = {
      id: deposit.id,
      sourceType: "DEPOSIT",
      sourceId: deposit.id,
      amount,
      paymentCode: memo,
      status: "PENDING",
      provider: "MANUAL",
      qrUrl: fallbackQrUrl,
      bankName: landlord.nganHang,
      bankAccountNumber: landlord.soTaiKhoan,
      bankAccountName: landlord.chuTaiKhoan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    paymentsApi
      .createDepositRequest(deposit.id)
      .then((res: any) => {
        if (!isMounted) return;
        const data = res?.data || res;
        if (data && data.qrUrl) {
          setPaymentRequest(data);
        } else {
          setPaymentRequest(fallbackRequest);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("[DepositQrModal] Falling back to default landlord VietQR:", err);
        // Seamless fallback to configured landlord VietQR so user is never blocked
        setPaymentRequest(fallbackRequest);
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
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <QrCode size={16} />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm sm:text-base font-black text-text whitespace-nowrap">Mã VietQR Đặt cọc</span>
            <span className="font-mono font-bold text-xs text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 shrink-0">
              {deposit.code}
            </span>
          </div>
        </div>
      }
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-3.5">
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {zaloSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Đã gửi thông báo kèm VietQR tới Zalo khách hàng thành công!</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-xs text-muted font-bold">Đang tải mã VietQR thanh toán cọc...</p>
          </div>
        ) : paymentRequest ? (
          <div className="flex flex-col items-center gap-3">
            {/* Header info badge */}
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-surface border border-border/60 text-xs">
              <span className="font-bold text-text flex items-center gap-1.5">
                <Home size={13} className="text-primary" />
                {deposit.roomCode || "Chưa xếp phòng"} · {deposit.buildingName || "Tòa nhà"}
              </span>
              <span className="font-bold text-muted truncate max-w-[150px]">
                {deposit.customerName}
              </span>
            </div>

            {/* QR Image */}
            <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col items-center">
              {paymentRequest.qrUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={paymentRequest.qrUrl}
                  alt={`VietQR ${paymentRequest.paymentCode}`}
                  className="w-[260px] h-[310px] object-contain rounded-lg"
                />
              ) : (
                <div className="w-[260px] h-[260px] flex items-center justify-center bg-slate-100 text-muted text-xs">
                  Không tải được ảnh QR
                </div>
              )}
            </div>

            {/* Bank Info Summary Card */}
            <div className="w-full bg-surface/60 border border-border/80 rounded-xl p-3 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted font-bold">Số tài khoản:</span>
                <div className="flex items-center gap-1.5 font-bold text-text">
                  <span className="font-mono">{paymentRequest.bankAccountNumber}</span>
                  <span className="text-muted font-normal text-[11px]">({paymentRequest.bankName})</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(paymentRequest.bankAccountNumber, "acc")}
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-muted hover:text-text cursor-pointer"
                    title="Sao chép STK"
                  >
                    {copiedField === "acc" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-bold">Chủ tài khoản:</span>
                <span className="font-bold text-text uppercase">{paymentRequest.bankAccountName || "HKD NGUYEN DUC TINH"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted font-bold">Số tiền cọc:</span>
                <span className="font-black text-primary text-sm font-mono">
                  {currencyFormatter.format(paymentRequest.amount || deposit.amount)} đ
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                <span className="text-muted font-bold">Nội dung CK:</span>
                <div className="flex items-center gap-1.5">
                  <code className="px-2 py-0.5 bg-primary/10 text-primary font-black rounded text-xs tracking-wide font-mono">
                    {paymentRequest.paymentCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(paymentRequest.paymentCode, "code")}
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-muted hover:text-text cursor-pointer"
                    title="Sao chép nội dung"
                  >
                    {copiedField === "code" ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Zalo Button */}
            <Button
              type="button"
              onClick={handleSendZalo}
              disabled={isSendingZalo}
              className="w-full h-10 bg-[#0068FF] hover:bg-[#0054cc] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm text-xs cursor-pointer"
            >
              {isSendingZalo ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Đang gửi thông báo Zalo...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Gửi mã VietQR tới Zalo khách hàng</span>
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
