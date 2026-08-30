"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  Banknote,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  DoorClosed,
  Droplets,
  FileText,
  Loader2,
  Plus,
  QrCode,
  Receipt,
  Send,
  ShieldCheck,
  Smartphone,
  User,
  Users,
  Wallet,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useCreateInvoiceMutation } from "@/lib/mutations/invoices.mutations";
import { useIssueInvoiceMutation, usePayInvoiceMutation } from "@/lib/queries/invoices.queries";
import toast from "react-hot-toast";

export type InvoiceCategory = "MONTHLY_RENT" | "DEPOSIT_RESERVATION" | "DEPOSIT_CONTRACT";

interface InvoiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRoomId?: string;
}

export default function InvoiceCreateModal({
  isOpen,
  onClose,
  defaultRoomId,
}: InvoiceCreateModalProps) {
  const { data: rooms = [] } = useRoomsQuery({ limit: 100 });
  const { data: contractsData } = useContractsQuery({ limit: 100 });
  const contracts = contractsData?.data || [];

  const createMutation = useCreateInvoiceMutation();
  const issueMutation = useIssueInvoiceMutation();
  const payMutation = usePayInvoiceMutation();

  // Category
  const [category, setCategory] = useState<InvoiceCategory>("MONTHLY_RENT");

  // Room & Tenant selection
  const [selectedRoomId, setSelectedRoomId] = useState<string>(defaultRoomId || "");
  const [tenantType, setTenantType] = useState<"REPRESENTATIVE" | "ROOMMATE">("REPRESENTATIVE");
  const [customTenantName, setCustomTenantName] = useState<string>("");
  const [customTenantPhone, setCustomTenantPhone] = useState<string>("");

  // Amounts
  const [roomRent, setRoomRent] = useState<number>(4500000);
  const [reservationDeposit, setReservationDeposit] = useState<number>(0);
  const [contractDeposit, setContractDeposit] = useState<number>(0);
  const [electricityAmount, setElectricityAmount] = useState<number>(0);
  const [waterPerPerson, setWaterPerPerson] = useState<number>(100000);
  const [peopleCount, setPeopleCount] = useState<number>(1);
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Period & Due Date
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [period, setPeriod] = useState<string>(`Tháng ${String(currentMonth).padStart(2, "0")}/${currentYear}`);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  );

  // Payment Method & Bot
  const [payMethod, setPayMethod] = useState<"QR_TRANSFER" | "CASH">("QR_TRANSFER");
  const [isCashCollected, setIsCashCollected] = useState<boolean>(false);
  const [sendZaloBot, setSendZaloBot] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-fill when Room is selected
  const selectedRoom = useMemo(() => {
    return rooms.find((r: any) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  const activeContract = useMemo(() => {
    if (!selectedRoomId) return null;
    return contracts.find(
      (c: any) =>
        (c.roomId === selectedRoomId || c.room?.id === selectedRoomId) &&
        ["ACTIVE", "APPROVED", "DRAFT"].includes(c.status)
    );
  }, [contracts, selectedRoomId]);

  // Update defaults when room changes
  useEffect(() => {
    if (selectedRoom) {
      const defaultRent = selectedRoom.price || activeContract?.monthlyRent || 4500000;
      if (category === "MONTHLY_RENT") {
        setRoomRent(defaultRent);
      } else if (category === "DEPOSIT_RESERVATION") {
        setReservationDeposit(1000000);
        setRoomRent(0);
      } else if (category === "DEPOSIT_CONTRACT") {
        setContractDeposit(defaultRent);
        setRoomRent(0);
      }

      if (activeContract?.customer) {
        setCustomTenantName(activeContract.customer.fullName || activeContract.customer.name || "");
        setCustomTenantPhone(activeContract.customer.phone || "");
      }
    }
  }, [selectedRoom, activeContract, category]);

  // Calculated Water Total
  const waterTotal = waterPerPerson * peopleCount;

  // Calculated Grand Total
  const grandTotal = useMemo(() => {
    let sub = 0;
    if (category === "MONTHLY_RENT") {
      sub = roomRent + electricityAmount + waterTotal + serviceFee;
    } else if (category === "DEPOSIT_RESERVATION") {
      sub = reservationDeposit;
    } else if (category === "DEPOSIT_CONTRACT") {
      sub = contractDeposit;
    }
    return Math.max(0, sub - discountAmount);
  }, [
    category,
    roomRent,
    electricityAmount,
    waterTotal,
    serviceFee,
    reservationDeposit,
    contractDeposit,
    discountAmount,
  ]);

  const handleCreate = async (autoIssue = true) => {
    if (!selectedRoomId) {
      toast.error("Vui lòng chọn Phòng tạo hóa đơn");
      return;
    }

    const customerId = activeContract?.customerId || activeContract?.customer?.id;
    if (!customerId) {
      toast.error("Phòng chưa có hợp đồng/khách thuê hợp lệ");
      return;
    }

    setIsSubmitting(true);
    try {
      // Build items array
      const items: any[] = [];
      if (category === "MONTHLY_RENT") {
        if (roomRent > 0) items.push({ name: "Tiền thuê phòng", type: "RENT", amount: roomRent, quantity: 1 });
        if (electricityAmount > 0) items.push({ name: "Tiền điện (Theo chỉ số EVN)", type: "UTILITY_ELECTRICITY", amount: electricityAmount, quantity: 1 });
        if (waterTotal > 0) items.push({ name: `Tiền nước sinh hoạt (${peopleCount} người)`, type: "UTILITY_WATER", amount: waterTotal, quantity: peopleCount });
        if (serviceFee > 0) items.push({ name: "Wifi & Dịch vụ tiện ích", type: "SERVICE", amount: serviceFee, quantity: 1 });
      } else if (category === "DEPOSIT_RESERVATION") {
        items.push({ name: "Tiền cọc giữ phòng (Khóa phòng)", type: "RENT", amount: reservationDeposit, quantity: 1 });
      } else if (category === "DEPOSIT_CONTRACT") {
        items.push({ name: "Tiền đặt cọc hợp đồng thuê", type: "RENT", amount: contractDeposit, quantity: 1 });
      }

      const payload = {
        roomId: selectedRoomId,
        contractId: activeContract?.id || "",
        customerId: customerId,
        period: period,
        dueDate: dueDate,
        totalAmount: grandTotal,
        paidAmount: isCashCollected ? grandTotal : 0,
        status: isCashCollected ? "PAID" : "UNPAID",
        notes: `Hóa đơn ${category === "MONTHLY_RENT" ? "tiền phòng định kỳ" : category === "DEPOSIT_RESERVATION" ? "cọc giữ phòng" : "cọc hợp đồng"} - Khách: ${customTenantName}`,
        items: items,
      };

      const result: any = await createMutation.mutateAsync(payload);
      const invoiceId = result?.id || result?.data?.id;

      if (autoIssue && invoiceId) {
        try {
          await issueMutation.mutateAsync(invoiceId);
        } catch (e) {
          // ignore if already issued
        }
      }

      if (isCashCollected && invoiceId) {
        try {
          await payMutation.mutateAsync({ id: invoiceId, amount: grandTotal });
        } catch (e) {
          // ignore
        }
      }

      if (sendZaloBot) {
        toast.success(
          `🤖 Bot Zalo đã tự động gửi hóa đơn & mã VietQR tới khách thuê ${customTenantName} (${customTenantPhone})!`,
          { duration: 5000 }
        );
      } else {
        toast.success("Tạo hóa đơn thành công!");
      }

      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Có lỗi xảy ra khi tạo hóa đơn");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatVnd = (val: number) => `${Number(val || 0).toLocaleString("vi-VN")} đ`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-[620px]"
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt size={17} />
          </div>
          <div>
            <h2 className="text-base font-black text-text leading-tight">Tạo hóa đơn mới</h2>
            <span className="text-xs font-bold text-muted">Lập hóa đơn thủ công & phát hành qua Bot</span>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="rounded-xl font-bold" onClick={onClose}>
            Hủy
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-bold"
              onClick={() => handleCreate(false)}
              disabled={isSubmitting}
            >
              Lưu bản nháp
            </Button>

            <Button
              variant="primary"
              size="sm"
              className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white shadow-xs px-4"
              onClick={() => handleCreate(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" /> Đang tạo...
                </>
              ) : sendZaloBot ? (
                <>
                  <Bot size={14} className="mr-1.5" /> Tạo & Gửi Zalo Bot
                </>
              ) : (
                <>
                  <Send size={14} className="mr-1.5" /> Tạo & Phát hành ngay
                </>
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5 max-h-[75vh] overflow-y-auto pr-1">
        {/* 1. CHỌN LOẠI HÓA ĐƠN (3 LOẠI TIỀN CỐT LÕI) */}
        <div>
          <label className="text-xs font-bold text-muted uppercase tracking-wider block mb-1.5">
            Loại hóa đơn thanh toán
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCategory("MONTHLY_RENT")}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                category === "MONTHLY_RENT"
                  ? "border-primary bg-primary/10 text-primary shadow-xs"
                  : "border-border bg-card text-muted hover:text-text hover:border-border/80"
              }`}
            >
              <Building2 size={16} className="mb-1" />
              <span className="text-xs font-black">Tiền phòng & Dịch vụ</span>
              <span className="text-[10px] text-muted font-medium">Định kỳ hàng tháng</span>
            </button>

            <button
              type="button"
              onClick={() => setCategory("DEPOSIT_RESERVATION")}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                category === "DEPOSIT_RESERVATION"
                  ? "border-amber-500 bg-amber-500/10 text-amber-600 shadow-xs"
                  : "border-border bg-card text-muted hover:text-text hover:border-border/80"
              }`}
            >
              <Wallet size={16} className="mb-1" />
              <span className="text-xs font-black">Cọc giữ phòng</span>
              <span className="text-[10px] text-muted font-medium">Trước khi vào ở</span>
            </button>

            <button
              type="button"
              onClick={() => setCategory("DEPOSIT_CONTRACT")}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                category === "DEPOSIT_CONTRACT"
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 shadow-xs"
                  : "border-border bg-card text-muted hover:text-text hover:border-border/80"
              }`}
            >
              <ShieldCheck size={16} className="mb-1" />
              <span className="text-xs font-black">Cọc hợp đồng</span>
              <span className="text-[10px] text-muted font-medium">Bảo chứng tài sản</span>
            </button>
          </div>
        </div>

        {/* 2. CHỌN PHÒNG & KHÁCH THUÊ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl border border-border/70 bg-surface/30 p-3">
          {/* Room Selector */}
          <div>
            <label className="text-xs font-bold text-muted block mb-1">
              Phòng / Căn hộ <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl border border-border bg-card text-xs font-bold text-text outline-none focus:border-primary"
            >
              <option value="">-- Chọn phòng --</option>
              {rooms.map((room: any) => (
                <option key={room.id} value={room.id}>
                  {room.building?.name || room.building?.code || "Tòa LK01.31"} • Phòng {room.code || room.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tenant Target (Đại diện HĐ vs Khách ghép) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-muted">Khách nhận hóa đơn</label>
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setTenantType("REPRESENTATIVE")}
                  className={`px-1.5 py-0.5 rounded-md ${
                    tenantType === "REPRESENTATIVE" ? "bg-primary text-white" : "text-muted hover:text-text"
                  }`}
                >
                  Đại diện HĐ
                </button>
                <button
                  type="button"
                  onClick={() => setTenantType("ROOMMATE")}
                  className={`px-1.5 py-0.5 rounded-md ${
                    tenantType === "ROOMMATE" ? "bg-primary text-white" : "text-muted hover:text-text"
                  }`}
                >
                  Khách thuê ghép
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customTenantName}
                onChange={(e) => setCustomTenantName(e.target.value)}
                placeholder="Tên khách nhận HĐ..."
                className="w-full h-9 px-2.5 rounded-xl border border-border bg-card text-xs font-bold text-text outline-none focus:border-primary"
              />
              <input
                type="text"
                value={customTenantPhone}
                onChange={(e) => setCustomTenantPhone(e.target.value)}
                placeholder="SĐT Zalo..."
                className="w-28 h-9 px-2 rounded-xl border border-border bg-card font-mono text-xs font-bold text-text outline-none focus:border-primary shrink-0"
              />
            </div>
          </div>
        </div>

        {/* 3. NHẬP CÁC KHOẢN TIỀN (THEO LOẠI HÓA ĐƠN) */}
        <div className="rounded-xl border border-border/70 bg-card p-3.5 flex flex-col gap-2.5">
          <span className="text-xs font-black uppercase tracking-wider text-muted flex items-center gap-1.5 border-b border-border/60 pb-2">
            <Receipt size={14} className="text-primary" /> Chi tiết các khoản phí thanh toán
          </span>

          {/* If Monthly Rent */}
          {category === "MONTHLY_RENT" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Tiền phòng */}
              <div>
                <label className="font-bold text-text block mb-1 flex items-center gap-1.5">
                  <Building2 size={13} className="text-indigo-500" /> Tiền thuê phòng (VNĐ)
                </label>
                <input
                  type="number"
                  value={roomRent}
                  onChange={(e) => setRoomRent(Number(e.target.value) || 0)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-surface font-mono font-bold text-text outline-none focus:border-primary"
                />
              </div>

              {/* Tiền điện */}
              <div>
                <label className="font-bold text-text block mb-1 flex items-center gap-1.5">
                  <Zap size={13} className="text-amber-500" /> Tiền điện EVN (VNĐ)
                </label>
                <input
                  type="number"
                  value={electricityAmount}
                  onChange={(e) => setElectricityAmount(Number(e.target.value) || 0)}
                  placeholder="Tính theo giá nhà nước..."
                  className="w-full h-9 px-3 rounded-xl border border-border bg-surface font-mono font-bold text-text outline-none focus:border-primary"
                />
              </div>

              {/* Tiền nước (100k / người) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-text flex items-center gap-1.5">
                    <Droplets size={13} className="text-sky-500" /> Tiền nước ({formatVnd(waterTotal)})
                  </label>
                  <span className="text-[10px] text-muted">100.000 đ / người</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-surface border border-border rounded-xl px-2 h-9">
                    <Users size={13} className="text-muted" />
                    <span className="text-[11px] font-bold text-muted">Số người:</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={peopleCount}
                      onChange={(e) => setPeopleCount(Math.max(1, Number(e.target.value) || 1))}
                      className="w-10 bg-transparent font-mono font-black text-xs text-text outline-none text-center"
                    />
                  </div>
                  <input
                    type="number"
                    value={waterTotal}
                    onChange={(e) => setWaterPerPerson(Math.round((Number(e.target.value) || 0) / peopleCount))}
                    className="flex-1 h-9 px-3 rounded-xl border border-border bg-surface font-mono font-bold text-text outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Wifi & Tiện ích */}
              <div>
                <label className="font-bold text-text block mb-1 flex items-center gap-1.5">
                  <Wifi size={13} className="text-emerald-500" /> Wifi & Dịch vụ (VNĐ)
                </label>
                <input
                  type="number"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(Number(e.target.value) || 0)}
                  placeholder="0 đ (Miễn phí)"
                  className="w-full h-9 px-3 rounded-xl border border-border bg-surface font-mono font-bold text-text outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* If Holding Deposit */}
          {category === "DEPOSIT_RESERVATION" && (
            <div>
              <label className="font-bold text-text block mb-1 flex items-center gap-1.5 text-xs">
                <Wallet size={13} className="text-amber-500" /> Số tiền cọc giữ chỗ phòng (VNĐ)
              </label>
              <input
                type="number"
                value={reservationDeposit}
                onChange={(e) => setReservationDeposit(Number(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-xl border border-border bg-surface font-mono font-bold text-text outline-none focus:border-primary"
              />
              <span className="text-[11px] text-muted mt-1 block">
                Khoản cọc tạm thời giữ chỗ trước khi ký hợp đồng. Có thể khấu trừ vào cọc hợp đồng khi vào ở.
              </span>
            </div>
          )}

          {/* If Contract Deposit */}
          {category === "DEPOSIT_CONTRACT" && (
            <div>
              <label className="font-bold text-text block mb-1 flex items-center gap-1.5 text-xs">
                <ShieldCheck size={13} className="text-indigo-500" /> Số tiền đặt cọc hợp đồng (VNĐ)
              </label>
              <input
                type="number"
                value={contractDeposit}
                onChange={(e) => setContractDeposit(Number(e.target.value) || 0)}
                className="w-full h-9 px-3 rounded-xl border border-border bg-surface font-mono font-bold text-text outline-none focus:border-primary"
              />
              <span className="text-[11px] text-muted mt-1 block">
                Tiền cọc bảo chứng trách nhiệm tài sản, tự động chuyển vào biên bản quyết toán hoàn cọc khi trả phòng.
              </span>
            </div>
          )}
        </div>

        {/* 4. TOTAL HERO BLOCK */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
              Tổng tiền hóa đơn
            </span>
            <span className="font-mono text-2xl font-black text-primary leading-tight">
              {formatVnd(grandTotal)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div>
              <span className="text-[10px] font-bold text-muted block">Kỳ cước</span>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-8 px-2 w-28 rounded-lg border border-border bg-card font-mono text-xs font-bold text-text"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted block">Hạn đóng</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border bg-card font-mono text-xs font-bold text-text"
              />
            </div>
          </div>
        </div>

        {/* 5. PHƯƠNG THỨC THANH TOÁN & BOT ZALO */}
        <div className="rounded-xl border border-border/70 bg-surface/30 p-3 flex flex-col gap-2.5 text-xs">
          <label className="font-bold text-muted block">Phương thức thanh toán & Thông báo</label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPayMethod("QR_TRANSFER")}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold transition-all ${
                payMethod === "QR_TRANSFER"
                  ? "border-primary bg-primary/10 text-primary shadow-2xs"
                  : "border-border bg-card text-muted hover:text-text"
              }`}
            >
              <QrCode size={14} /> Chuyển khoản VietQR (Bot gửi)
            </button>

            <button
              type="button"
              onClick={() => setPayMethod("CASH")}
              className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold transition-all ${
                payMethod === "CASH"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-2xs"
                  : "border-border bg-card text-muted hover:text-text"
              }`}
            >
              <Banknote size={14} /> Thu tiền mặt trực tiếp
            </button>
          </div>

          {/* Sub options for QR vs Cash */}
          {payMethod === "QR_TRANSFER" && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-primary" />
                <span className="font-bold text-text">Tự động gửi QR & Hóa đơn qua Bot Zalo</span>
              </div>
              <input
                type="checkbox"
                checked={sendZaloBot}
                onChange={(e) => setSendZaloBot(e.target.checked)}
                className="h-4 w-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </div>
          )}

          {payMethod === "CASH" && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span className="font-bold text-text">Khách đã nộp đủ tiền mặt ngay lúc này (Gạch nợ)</span>
              </div>
              <input
                type="checkbox"
                checked={isCashCollected}
                onChange={(e) => setIsCashCollected(e.target.checked)}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
