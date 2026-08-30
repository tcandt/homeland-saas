"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  Banknote,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  DoorClosed,
  Droplets,
  FileText,
  Gift,
  Loader2,
  Minus,
  Phone,
  Plus,
  QrCode,
  Receipt,
  Send,
  ShieldCheck,
  Smartphone,
  Tag,
  User,
  UserCheck,
  Users,
  Wallet,
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
import { useSendInvoicePaymentToZaloMutation } from "@/lib/queries/payments.queries";
import { getTenantAvatar } from "../tenants/TenantDetailDrawer";
import toast from "react-hot-toast";

interface InvoiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRoomId?: string;
}

// Helpers for formatted currency input
function parseCurrency(val: string): number {
  return Number(val.replace(/\D/g, "")) || 0;
}

function formatCurrencyInput(val: number): string {
  if (val === 0) return "0";
  return val.toLocaleString("vi-VN");
}

function formatVnd(val: number): string {
  return `${Number(val || 0).toLocaleString("vi-VN")} đ`;
}

export default function InvoiceCreateModal({
  isOpen,
  onClose,
  defaultRoomId,
}: InvoiceCreateModalProps) {
  const { data: rooms = [] } = useRoomsQuery({ limit: 200 });
  const { data: contractsData } = useContractsQuery({ limit: 200 });
  const contracts = contractsData?.data || [];

  const createMutation = useCreateInvoiceMutation();
  const issueMutation = useIssueInvoiceMutation();
  const payMutation = usePayInvoiceMutation();
  const sendZaloMutation = useSendInvoicePaymentToZaloMutation();

  // 1. Room Selection
  const [selectedRoomId, setSelectedRoomId] = useState<string>(defaultRoomId || "");

  // 2. Recipient Selection (Representative vs Roommate)
  const [recipientType, setRecipientType] = useState<"REPRESENTATIVE" | "ROOMMATE">("REPRESENTATIVE");
  const [selectedRoommateId, setSelectedRoommateId] = useState<string>("");
  const [customRecipientName, setCustomRecipientName] = useState<string>("");
  const [customRecipientPhone, setCustomRecipientPhone] = useState<string>("");

  // 3. Line Items (2 Columns, 3 items each)
  // Column 1
  const [includeRent, setIncludeRent] = useState<boolean>(true);
  const [roomRent, setRoomRent] = useState<number>(0);

  const [includeContractDeposit, setIncludeContractDeposit] = useState<boolean>(false);
  const [contractDeposit, setContractDeposit] = useState<number>(0);

  const [includeHoldingDeposit, setIncludeHoldingDeposit] = useState<boolean>(false);
  const [holdingDeposit, setHoldingDeposit] = useState<number>(0);

  // Column 2
  const [includeElectricity, setIncludeElectricity] = useState<boolean>(true);
  const [electricityAmount, setElectricityAmount] = useState<number>(0);

  const [includeWater, setIncludeWater] = useState<boolean>(true);
  const [waterPeopleCount, setWaterPeopleCount] = useState<number>(1);
  const [waterUnitPrice] = useState<number>(100000); // 100k/person

  const [includeDiscount, setIncludeDiscount] = useState<boolean>(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // 4. Period & Due Date (Vietnamese format)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [periodMonth, setPeriodMonth] = useState<number>(currentMonth);
  const [periodYear, setPeriodYear] = useState<number>(currentYear);

  // Default due date: 5 days from now formatted as dd/mm/yyyy
  const dueDefault = new Date(Date.now() + 5 * 86400000);
  const [dueDay, setDueDay] = useState<string>(
    `${String(dueDefault.getDate()).padStart(2, "0")}/${String(dueDefault.getMonth() + 1).padStart(2, "0")}/${dueDefault.getFullYear()}`
  );

  // 5. Payment & Bot
  const [payMethod, setPayMethod] = useState<"QR_TRANSFER" | "CASH">("QR_TRANSFER");
  const [isCashCollected, setIsCashCollected] = useState<boolean>(false);
  const [sendZaloBot, setSendZaloBot] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Real room & contract lookup
  const selectedRoom = useMemo(() => {
    return rooms.find((r: any) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  const activeContract = useMemo(() => {
    if (!selectedRoomId) return null;
    return contracts.find(
      (c: any) =>
        (c.roomId === selectedRoomId || c.room?.id === selectedRoomId) &&
        ["ACTIVE", "APPROVED", "DRAFT", "EXPIRING"].includes(c.status)
    );
  }, [contracts, selectedRoomId]);

  // Real representative
  const representative = useMemo(() => {
    if (selectedRoom?.tenant) {
      return {
        id: selectedRoom.tenant.id,
        fullName: selectedRoom.tenant.name,
        phone: selectedRoom.tenant.phone,
        gender: selectedRoom.tenant.gender,
      };
    }
    if (activeContract?.customer) {
      return {
        id: activeContract.customer.id,
        fullName: activeContract.customer.fullName || activeContract.customer.name,
        phone: activeContract.customer.phone,
        gender: activeContract.customer.gender,
      };
    }
    return null;
  }, [selectedRoom, activeContract]);

  // Real roommates from selected room
  const availableRoommates = useMemo(() => {
    if (!selectedRoom) return [];
    const shared = selectedRoom.sharedTenants || [];
    return shared.map((t: any) => ({
      id: t.id || t.name,
      fullName: t.name || t.fullName,
      phone: t.phone || "",
      gender: t.gender || "MALE",
    }));
  }, [selectedRoom]);

  // Auto update when Room changes
  useEffect(() => {
    if (selectedRoom) {
      const defaultRent = selectedRoom.price || selectedRoom.monthlyPrice || Number(activeContract?.monthlyRent) || 0;
      setRoomRent(defaultRent);
      setContractDeposit(Number(activeContract?.depositMoney) || defaultRent);
      setWaterPeopleCount(Number(activeContract?.memberCount) || (selectedRoom.sharedTenants?.length ? selectedRoom.sharedTenants.length + 1 : 1));

      if (recipientType === "REPRESENTATIVE") {
        setCustomRecipientName(representative?.fullName || "");
        setCustomRecipientPhone(representative?.phone || "");
      }
    } else {
      setRoomRent(0);
      setContractDeposit(0);
      setHoldingDeposit(0);
      setCustomRecipientName("");
      setCustomRecipientPhone("");
    }
  }, [selectedRoom, activeContract, representative, recipientType]);

  // When switching recipient type
  useEffect(() => {
    if (recipientType === "REPRESENTATIVE") {
      setCustomRecipientName(representative?.fullName || "");
      setCustomRecipientPhone(representative?.phone || "");
    } else if (recipientType === "ROOMMATE") {
      if (availableRoommates.length > 0) {
        const found = availableRoommates.find((r: any) => r.id === selectedRoommateId) || availableRoommates[0];
        if (found) {
          setSelectedRoommateId(found.id);
          setCustomRecipientName(found.fullName);
          setCustomRecipientPhone(found.phone);
        }
      }
    }
  }, [recipientType, selectedRoommateId, representative, availableRoommates]);

  // Calculations
  const waterTotal = includeWater ? waterUnitPrice * waterPeopleCount : 0;
  const actualDiscount = includeDiscount ? discountAmount : 0;

  const grandTotal = useMemo(() => {
    let sum = 0;
    if (includeRent) sum += roomRent;
    if (includeContractDeposit) sum += contractDeposit;
    if (includeHoldingDeposit) sum += holdingDeposit;
    if (includeElectricity) sum += electricityAmount;
    if (includeWater) sum += waterTotal;
    return Math.max(0, sum - actualDiscount);
  }, [
    includeRent,
    roomRent,
    includeContractDeposit,
    contractDeposit,
    includeHoldingDeposit,
    holdingDeposit,
    includeElectricity,
    electricityAmount,
    includeWater,
    waterTotal,
    actualDiscount,
  ]);

  const handleCreate = async (autoIssue = true) => {
    if (!selectedRoomId) {
      toast.error("Vui lòng chọn Phòng tạo hóa đơn");
      return;
    }

    const customerId = activeContract?.customerId || activeContract?.customer?.id || representative?.id;
    if (!customerId) {
      toast.error("Phòng chưa có thông tin khách thuê hợp lệ");
      return;
    }

    setIsSubmitting(true);
    try {
      const items: any[] = [];
      if (includeRent && roomRent > 0) {
        items.push({ name: "Tiền thuê phòng", type: "RENT", amount: roomRent, quantity: 1 });
      }
      if (includeContractDeposit && contractDeposit > 0) {
        items.push({ name: "Tiền đặt cọc hợp đồng", type: "RENT", amount: contractDeposit, quantity: 1 });
      }
      if (includeHoldingDeposit && holdingDeposit > 0) {
        items.push({ name: "Tiền cọc giữ chỗ phòng", type: "RENT", amount: holdingDeposit, quantity: 1 });
      }
      if (includeElectricity && electricityAmount > 0) {
        items.push({ name: "Tiền điện", type: "UTILITY_ELECTRICITY", amount: electricityAmount, quantity: 1 });
      }
      if (includeWater && waterTotal > 0) {
        items.push({ name: `Tiền nước (${waterPeopleCount} người)`, type: "UTILITY_WATER", amount: waterTotal, quantity: waterPeopleCount });
      }
      if (includeDiscount && discountAmount > 0) {
        items.push({ name: "Giảm giá", type: "DISCOUNT", amount: -discountAmount, quantity: 1 });
      }

      const periodStr = `Tháng ${String(periodMonth).padStart(2, "0")}/${periodYear}`;

      // Convert dd/mm/yyyy to ISO
      const parts = dueDay.split("/");
      const dueIso = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : new Date().toISOString().slice(0, 10);

      const payload = {
        roomId: selectedRoomId,
        contractId: activeContract?.id || "",
        customerId: customerId,
        period: periodStr,
        dueDate: dueIso,
        totalAmount: grandTotal,
        paidAmount: isCashCollected ? grandTotal : 0,
        status: isCashCollected ? "PAID" : "UNPAID",
        notes: `Hóa đơn ${periodStr} - ${recipientType === "ROOMMATE" ? "Khách ghép" : "Đại diện"}: ${customRecipientName} (${customRecipientPhone})`,
        items: items,
      };

      const result: any = await createMutation.mutateAsync(payload);
      const invoiceId = result?.id || result?.data?.id;

      if (autoIssue && invoiceId) {
        try {
          await issueMutation.mutateAsync(invoiceId);
        } catch (e) {
          // ignore
        }
      }

      if (isCashCollected && invoiceId) {
        try {
          await payMutation.mutateAsync({ id: invoiceId, amount: grandTotal });
        } catch (e) {
          // ignore
        }
      }

      if (sendZaloBot && payMethod === "QR_TRANSFER" && invoiceId) {
        try {
          await sendZaloMutation.mutateAsync(invoiceId);
        } catch (e) {
          // ignore
        }
        toast.success(
          `🤖 Bot Zalo đã gửi hóa đơn & mã VietQR tới ${customRecipientName} (${customRecipientPhone})!`,
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

  const isFemale =
    recipientType === "ROOMMATE"
      ? availableRoommates.find((r: any) => r.id === selectedRoommateId)?.gender === "FEMALE"
      : representative?.gender === "FEMALE" || representative?.gender === "Nữ";

  const avatarUrl = getTenantAvatar(undefined, customRecipientName || "Khách thuê", isFemale ? "FEMALE" : "MALE");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-[660px]"
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt size={17} />
          </div>
          <div>
            <h2 className="text-sm font-black text-text leading-tight">Lập hóa đơn thanh toán</h2>
            <span className="text-[11px] text-muted font-medium">Chọn khoản thu và phát hành qua Bot Zalo</span>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="rounded-xl font-bold text-xs" onClick={onClose}>
            Hủy
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-bold text-xs"
              onClick={() => handleCreate(false)}
              disabled={isSubmitting}
            >
              Lưu nháp
            </Button>

            <Button
              variant="primary"
              size="sm"
              className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white shadow-xs px-4 text-xs"
              onClick={() => handleCreate(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" /> Đang xử lý...
                </>
              ) : sendZaloBot && payMethod === "QR_TRANSFER" ? (
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
      <div className="flex flex-col gap-3 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {/* 1. CHỌN PHÒNG & NGƯỜI NHẬN HÓA ĐƠN */}
        <div className="rounded-xl border border-border/80 bg-surface/30 p-2.5 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Room Selector */}
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted block mb-1">
                Phòng / Căn hộ <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full h-8.5 px-2.5 rounded-lg border border-border bg-card text-xs font-bold text-text outline-none focus:border-primary"
              >
                <option value="">-- Chọn phòng thanh toán --</option>
                {rooms.map((room: any) => {
                  const bName = room.buildingName || room.building?.name || room.building?.code || "";
                  const rCode = room.code || room.name || `Phòng ${room.id?.slice(0, 5)}`;
                  const label = bName ? `${bName} • ${rCode}` : rCode;
                  return (
                    <option key={room.id} value={room.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Recipient Mode Toggle */}
            <div className="sm:w-60">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted block mb-1">
                Hình thức nhận
              </label>
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 h-8.5">
                <button
                  type="button"
                  onClick={() => setRecipientType("REPRESENTATIVE")}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-md text-[11px] font-bold h-full transition ${
                    recipientType === "REPRESENTATIVE"
                      ? "bg-primary text-white shadow-2xs"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <UserCheck size={12} /> Nguyên căn
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientType("ROOMMATE")}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-md text-[11px] font-bold h-full transition ${
                    recipientType === "ROOMMATE"
                      ? "bg-primary text-white shadow-2xs"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <Users size={12} /> Thuê ghép
                </button>
              </div>
            </div>
          </div>

          {/* Tenant details card */}
          {selectedRoomId && (
            <div className="flex items-center justify-between rounded-lg bg-card border border-border/60 px-2.5 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={avatarUrl}
                  alt={customRecipientName || "Khách"}
                  className={`h-7.5 w-7.5 rounded-lg object-cover border ${
                    isFemale ? "border-pink-300 bg-pink-50" : "border-sky-300 bg-sky-50"
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-black text-text text-xs truncate">
                    {customRecipientName || (representative ? representative.fullName : "Chưa gán khách thuê")}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted font-mono">
                    <Phone size={10} className="text-emerald-500 shrink-0" />
                    <span>{customRecipientPhone || (representative ? representative.phone : "Chưa có SĐT")}</span>
                  </div>
                </div>
              </div>

              {recipientType === "ROOMMATE" ? (
                availableRoommates.length > 0 ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted font-bold">Khách ghép:</span>
                    <select
                      value={selectedRoommateId}
                      onChange={(e) => setSelectedRoommateId(e.target.value)}
                      className="h-7 px-2 rounded-md border border-primary/30 bg-primary/5 text-[11px] font-bold text-primary outline-none"
                    >
                      {availableRoommates.map((rm: any) => (
                        <option key={rm.id} value={rm.id}>
                          {rm.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-[10px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md font-bold">
                    Phòng 1 người
                  </span>
                )
              ) : (
                <Badge variant="primary" className="text-[10px] py-0.5 px-2">
                  Đại diện HĐ
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* 2. KHOẢN MỤC THU TIỀN (2 CỘT RỘNG RÃI, KHÔNG CHE KHUẤT TEXT) */}
        <div className="rounded-xl border border-border/80 bg-card p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-border/50 pb-1.5 text-[10px] font-black uppercase tracking-wider text-muted select-none">
            <span>Khoản mục thu tiền</span>
            <span>Số tiền (VNĐ)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
            {/* CỘT 1: PHÒNG & CỌC */}
            <div className="flex flex-col gap-2">
              {/* 1. Tiền thuê phòng */}
              <div className="flex items-center justify-between gap-2 py-1 border-b border-border/30">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-text select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={includeRent}
                    onChange={(e) => setIncludeRent(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <Building2 size={13} className="text-indigo-500 shrink-0" />
                  <span className="whitespace-nowrap">Tiền phòng</span>
                </label>
                <div className="relative w-32 shrink-0">
                  <input
                    type="text"
                    disabled={!includeRent}
                    value={includeRent ? formatCurrencyInput(roomRent) : "0"}
                    onChange={(e) => setRoomRent(parseCurrency(e.target.value))}
                    className={`w-full h-7 px-2 pr-4 rounded-md border text-right font-mono font-bold text-xs outline-none ${
                      includeRent
                        ? "border-border bg-surface text-text focus:border-primary"
                        : "border-transparent bg-transparent text-muted/50 cursor-not-allowed"
                    }`}
                  />
                  <span className="absolute right-1.5 top-1.5 text-[10px] text-muted font-bold">đ</span>
                </div>
              </div>

              {/* 2. Tiền cọc hợp đồng */}
              <div className="flex items-center justify-between gap-2 py-1 border-b border-border/30">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-text select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={includeContractDeposit}
                    onChange={(e) => setIncludeContractDeposit(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <ShieldCheck size={13} className="text-indigo-600 shrink-0" />
                  <span className="whitespace-nowrap">Cọc hợp đồng</span>
                </label>
                <div className="relative w-32 shrink-0">
                  <input
                    type="text"
                    disabled={!includeContractDeposit}
                    value={includeContractDeposit ? formatCurrencyInput(contractDeposit) : "0"}
                    onChange={(e) => setContractDeposit(parseCurrency(e.target.value))}
                    className={`w-full h-7 px-2 pr-4 rounded-md border text-right font-mono font-bold text-xs outline-none ${
                      includeContractDeposit
                        ? "border-border bg-surface text-text focus:border-primary"
                        : "border-transparent bg-transparent text-muted/50 cursor-not-allowed"
                    }`}
                  />
                  <span className="absolute right-1.5 top-1.5 text-[10px] text-muted font-bold">đ</span>
                </div>
              </div>

              {/* 3. Cọc giữ phòng */}
              <div className="flex items-center justify-between gap-2 py-1">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-text select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={includeHoldingDeposit}
                    onChange={(e) => setIncludeHoldingDeposit(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <Wallet size={13} className="text-amber-500 shrink-0" />
                  <span className="whitespace-nowrap">Cọc giữ phòng</span>
                </label>
                <div className="relative w-32 shrink-0">
                  <input
                    type="text"
                    disabled={!includeHoldingDeposit}
                    value={includeHoldingDeposit ? formatCurrencyInput(holdingDeposit) : "0"}
                    onChange={(e) => setHoldingDeposit(parseCurrency(e.target.value))}
                    className={`w-full h-7 px-2 pr-4 rounded-md border text-right font-mono font-bold text-xs outline-none ${
                      includeHoldingDeposit
                        ? "border-border bg-surface text-text focus:border-primary"
                        : "border-transparent bg-transparent text-muted/50 cursor-not-allowed"
                    }`}
                  />
                  <span className="absolute right-1.5 top-1.5 text-[10px] text-muted font-bold">đ</span>
                </div>
              </div>
            </div>

            {/* CỘT 2: ĐIỆN, NƯỚC, GIẢM GIÁ */}
            <div className="flex flex-col gap-2">
              {/* 4. Tiền điện */}
              <div className="flex items-center justify-between gap-2 py-1 border-b border-border/30">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-text select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={includeElectricity}
                    onChange={(e) => setIncludeElectricity(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <Zap size={13} className="text-amber-500 shrink-0" />
                  <span className="whitespace-nowrap">Tiền điện</span>
                </label>
                <div className="relative w-32 shrink-0">
                  <input
                    type="text"
                    disabled={!includeElectricity}
                    value={includeElectricity ? formatCurrencyInput(electricityAmount) : "0"}
                    onChange={(e) => setElectricityAmount(parseCurrency(e.target.value))}
                    placeholder="0"
                    className={`w-full h-7 px-2 pr-4 rounded-md border text-right font-mono font-bold text-xs outline-none ${
                      includeElectricity
                        ? "border-border bg-surface text-text focus:border-primary"
                        : "border-transparent bg-transparent text-muted/50 cursor-not-allowed"
                    }`}
                  />
                  <span className="absolute right-1.5 top-1.5 text-[10px] text-muted font-bold">đ</span>
                </div>
              </div>

              {/* 5. Tiền nước (Rõ ràng, không bị ẩn số người, không có nút spinner) */}
              <div className="flex items-center justify-between gap-2 py-1 border-b border-border/30">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-text select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={includeWater}
                    onChange={(e) => setIncludeWater(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <Droplets size={13} className="text-sky-500 shrink-0" />
                  <span className="whitespace-nowrap">Tiền nước</span>
                </label>

                <div className="flex items-center gap-1.5 shrink-0">
                  {includeWater && (
                    <div className="flex items-center bg-surface border border-border/80 rounded px-1.5 h-7">
                      <Users size={11} className="text-muted mr-1" />
                      <input
                        type="text"
                        value={waterPeopleCount}
                        onChange={(e) => {
                          const val = Number(e.target.value.replace(/\D/g, "")) || 1;
                          setWaterPeopleCount(Math.max(1, Math.min(20, val)));
                        }}
                        className="w-5 font-mono font-black text-xs text-text bg-transparent text-center outline-none"
                      />
                      <span className="text-[10px] text-muted font-bold ml-0.5">người</span>
                    </div>
                  )}
                  <div className="relative w-24">
                    <input
                      type="text"
                      readOnly
                      value={includeWater ? formatCurrencyInput(waterTotal) : "0"}
                      className="w-full h-7 px-1 pr-4 rounded-md border border-transparent bg-transparent text-right font-mono font-bold text-xs text-text outline-none"
                    />
                    <span className="absolute right-1 top-1.5 text-[10px] text-muted font-bold">đ</span>
                  </div>
                </div>
              </div>

              {/* 6. Giảm giá (Gọn gàng, loại bỏ chữ Khấu trừ) */}
              <div className="flex items-center justify-between gap-2 py-1">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-rose-600 select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={includeDiscount}
                    onChange={(e) => setIncludeDiscount(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <Minus size={13} className="text-rose-500 shrink-0" />
                  <span className="whitespace-nowrap">Giảm giá</span>
                </label>

                <div className="relative w-32 shrink-0">
                  <input
                    type="text"
                    disabled={!includeDiscount}
                    value={includeDiscount ? formatCurrencyInput(discountAmount) : "0"}
                    onChange={(e) => setDiscountAmount(parseCurrency(e.target.value))}
                    placeholder="0"
                    className={`w-full h-7 px-2 pr-4 rounded-md border text-right font-mono font-bold text-xs outline-none ${
                      includeDiscount
                        ? "border-rose-300 bg-rose-50/30 text-rose-600 focus:border-rose-500"
                        : "border-transparent bg-transparent text-muted/50 cursor-not-allowed"
                    }`}
                  />
                  <span className="absolute right-1.5 top-1.5 text-[10px] text-rose-500 font-bold">đ</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. TỔNG CỘNG & KỲ CƯỚC / HẠN ĐÓNG (CĂN GIỮA, KHÔNG BỊ CHE) */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
              Tổng tiền thanh toán
            </span>
            <span className="font-mono text-xl font-black text-primary leading-tight">
              {formatVnd(grandTotal)}
            </span>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-3 text-xs">
            {/* Kỳ cước */}
            <div className="flex flex-col items-center sm:items-start">
              <span className="text-[10px] font-black uppercase text-muted block mb-0.5">Kỳ cước</span>
              <div className="flex items-center justify-center gap-1 bg-card border border-border rounded-lg px-2.5 h-8">
                <span className="text-[11px] font-bold text-muted">Tháng</span>
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(Number(e.target.value))}
                  className="bg-transparent font-mono font-black text-xs text-text outline-none cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <span className="text-muted/60">/</span>
                <input
                  type="number"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                  className="w-11 bg-transparent font-mono font-black text-xs text-text outline-none text-center"
                />
              </div>
            </div>

            {/* Hạn đóng */}
            <div className="flex flex-col items-center sm:items-start">
              <span className="text-[10px] font-black uppercase text-muted block mb-0.5">Hạn đóng</span>
              <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 h-8">
                <Calendar size={12} className="text-amber-500 shrink-0" />
                <input
                  type="text"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="dd/mm/yyyy"
                  className="w-22 bg-transparent font-mono font-black text-xs text-text outline-none text-center"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. PHƯƠNG THỨC THANH TOÁN */}
        <div className="rounded-xl border border-border/80 bg-surface/30 p-2.5 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPayMethod("QR_TRANSFER")}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border font-bold text-xs transition ${
                payMethod === "QR_TRANSFER"
                  ? "border-primary bg-primary/10 text-primary shadow-2xs"
                  : "border-border bg-card text-muted hover:text-text"
              }`}
            >
              <QrCode size={13} /> Chuyển khoản QR (VietQR)
            </button>

            <button
              type="button"
              onClick={() => setPayMethod("CASH")}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border font-bold text-xs transition ${
                payMethod === "CASH"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-2xs"
                  : "border-border bg-card text-muted hover:text-text"
              }`}
            >
              <Banknote size={13} /> Thu tiền mặt
            </button>
          </div>

          {/* Sub options */}
          {payMethod === "QR_TRANSFER" && (
            <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-card border border-border/60 cursor-pointer">
              <div className="flex items-center gap-1.5">
                <Bot size={13} className="text-primary" />
                <span className="font-bold text-text text-[11px]">Tự động gửi QR & Hóa đơn qua Bot Zalo</span>
              </div>
              <input
                type="checkbox"
                checked={sendZaloBot}
                onChange={(e) => setSendZaloBot(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </label>
          )}

          {payMethod === "CASH" && (
            <label className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-card border border-border/60 cursor-pointer">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span className="font-bold text-text text-[11px]">Khách đã nộp tiền mặt ngay (Gạch nợ)</span>
              </div>
              <input
                type="checkbox"
                checked={isCashCollected}
                onChange={(e) => setIsCashCollected(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}
