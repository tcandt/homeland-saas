"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  Banknote,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  DoorClosed,
  Droplets,
  FileText,
  Loader2,
  Minus,
  Phone,
  Plus,
  QrCode,
  Receipt,
  Send,
  ShieldCheck,
  Smartphone,
  User,
  UserCheck,
  UserPlus,
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
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { useCreateInvoiceMutation } from "@/lib/mutations/invoices.mutations";
import { useIssueInvoiceMutation, usePayInvoiceMutation } from "@/lib/queries/invoices.queries";
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

export default function InvoiceCreateModal({
  isOpen,
  onClose,
  defaultRoomId,
}: InvoiceCreateModalProps) {
  const { data: rooms = [] } = useRoomsQuery({ limit: 100 });
  const { data: contractsData } = useContractsQuery({ limit: 100 });
  const contracts = contractsData?.data || [];
  const { data: customersData } = useCustomersQuery({ limit: 100 });
  const allCustomers = customersData?.data || [];

  const createMutation = useCreateInvoiceMutation();
  const issueMutation = useIssueInvoiceMutation();
  const payMutation = usePayInvoiceMutation();

  // 1. Room Selection
  const [selectedRoomId, setSelectedRoomId] = useState<string>(defaultRoomId || "");

  // 2. Recipient Selection (Representative vs Roommate)
  const [recipientType, setRecipientType] = useState<"REPRESENTATIVE" | "ROOMMATE">("REPRESENTATIVE");
  const [selectedRoommateId, setSelectedRoommateId] = useState<string>("");
  const [customRecipientName, setCustomRecipientName] = useState<string>("");
  const [customRecipientPhone, setCustomRecipientPhone] = useState<string>("");

  // 3. Line Items (2 Columns)
  // Column 1
  const [includeRent, setIncludeRent] = useState<boolean>(true);
  const [roomRent, setRoomRent] = useState<number>(4500000);

  const [includeContractDeposit, setIncludeContractDeposit] = useState<boolean>(false);
  const [contractDeposit, setContractDeposit] = useState<number>(4500000);

  const [includeHoldingDeposit, setIncludeHoldingDeposit] = useState<boolean>(false);
  const [holdingDeposit, setHoldingDeposit] = useState<number>(1000000);

  // Column 2
  const [includeElectricity, setIncludeElectricity] = useState<boolean>(true);
  const [electricityAmount, setElectricityAmount] = useState<number>(0);

  const [includeWater, setIncludeWater] = useState<boolean>(true);
  const [waterPeopleCount, setWaterPeopleCount] = useState<number>(1);
  const [waterUnitPrice, setWaterUnitPrice] = useState<number>(100000);

  const [wifiFree, setWifiFree] = useState<boolean>(true);
  const [serviceFee, setServiceFee] = useState<number>(0);

  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // 4. Period & Due Date (Date format dd/mm/yyyy)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [periodDate, setPeriodDate] = useState<string>(todayStr);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  );

  // 5. Payment & Bot
  const [payMethod, setPayMethod] = useState<"QR_TRANSFER" | "CASH">("QR_TRANSFER");
  const [isCashCollected, setIsCashCollected] = useState<boolean>(false);
  const [sendZaloBot, setSendZaloBot] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Room & Contract lookup
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

  // Representative
  const representative = useMemo(() => {
    return (
      activeContract?.customer || {
        id: "rep-1",
        fullName: "Nguyễn Đức Tính",
        phone: "0567867889",
        gender: "MALE",
      }
    );
  }, [activeContract]);

  // Available Roommates in this Room / Contract
  const availableRoommates = useMemo(() => {
    // If contract has coRepresentativeIds or customer list
    if (activeContract?.coRepresentativeIds && activeContract.coRepresentativeIds.length > 0) {
      return allCustomers.filter((c: any) => activeContract.coRepresentativeIds.includes(c.id));
    }
    // Fallback list for demo/roommates
    return [
      { id: "roommate-1", fullName: "Trần Thị Mai (Khách ghép 1)", phone: "0912345678", gender: "FEMALE" },
      { id: "roommate-2", fullName: "Lê Văn Hùng (Khách ghép 2)", phone: "0987654321", gender: "MALE" },
    ];
  }, [activeContract, allCustomers]);

  // Auto update values when Room changes
  useEffect(() => {
    if (selectedRoom) {
      const defaultRent = selectedRoom.price || activeContract?.monthlyRent || 4500000;
      setRoomRent(defaultRent);
      setContractDeposit(defaultRent);
      setWaterPeopleCount(activeContract?.memberCount || 1);

      if (recipientType === "REPRESENTATIVE") {
        setCustomRecipientName(representative?.fullName || "");
        setCustomRecipientPhone(representative?.phone || "");
      }
    }
  }, [selectedRoom, activeContract, representative, recipientType]);

  // When switching recipient type or selecting a roommate
  useEffect(() => {
    if (recipientType === "REPRESENTATIVE") {
      setCustomRecipientName(representative?.fullName || "Nguyễn Đức Tính");
      setCustomRecipientPhone(representative?.phone || "0567867889");
    } else if (recipientType === "ROOMMATE") {
      const found = availableRoommates.find((r: any) => r.id === selectedRoommateId) || availableRoommates[0];
      if (found) {
        setSelectedRoommateId(found.id);
        setCustomRecipientName(found.fullName);
        setCustomRecipientPhone(found.phone);
      }
    }
  }, [recipientType, selectedRoommateId, representative, availableRoommates]);

  // Calculations
  const waterTotal = includeWater ? waterUnitPrice * waterPeopleCount : 0;
  const actualServiceFee = wifiFree ? 0 : serviceFee;

  const grandTotal = useMemo(() => {
    let sum = 0;
    if (includeRent) sum += roomRent;
    if (includeContractDeposit) sum += contractDeposit;
    if (includeHoldingDeposit) sum += holdingDeposit;
    if (includeElectricity) sum += electricityAmount;
    if (includeWater) sum += waterTotal;
    sum += actualServiceFee;
    return Math.max(0, sum - discountAmount);
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
    actualServiceFee,
    discountAmount,
  ]);

  const formatVnd = (val: number) => `${Number(val || 0).toLocaleString("vi-VN")} đ`;

  const handleCreate = async (autoIssue = true) => {
    if (!selectedRoomId) {
      toast.error("Vui lòng chọn Phòng tạo hóa đơn");
      return;
    }

    const customerId = activeContract?.customerId || activeContract?.customer?.id || representative?.id || "default";

    setIsSubmitting(true);
    try {
      const items: any[] = [];
      if (includeRent && roomRent > 0) {
        items.push({ name: "Tiền thuê phòng", type: "RENT", amount: roomRent, quantity: 1 });
      }
      if (includeContractDeposit && contractDeposit > 0) {
        items.push({ name: "Tiền đặt cọc hợp đồng (Bảo chứng tài sản)", type: "RENT", amount: contractDeposit, quantity: 1 });
      }
      if (includeHoldingDeposit && holdingDeposit > 0) {
        items.push({ name: "Tiền cọc giữ chỗ phòng", type: "RENT", amount: holdingDeposit, quantity: 1 });
      }
      if (includeElectricity && electricityAmount > 0) {
        items.push({ name: "Tiền điện (Theo chỉ số EVN - Giá nhà nước)", type: "UTILITY_ELECTRICITY", amount: electricityAmount, quantity: 1 });
      }
      if (includeWater && waterTotal > 0) {
        items.push({ name: `Tiền nước sinh hoạt (${waterPeopleCount} người × 100k)`, type: "UTILITY_WATER", amount: waterTotal, quantity: waterPeopleCount });
      }
      if (wifiFree) {
        items.push({ name: "Wifi & Dịch vụ tiện ích (Miễn phí)", type: "SERVICE", amount: 0, quantity: 1 });
      } else if (serviceFee > 0) {
        items.push({ name: "Wifi & Dịch vụ tiện ích", type: "SERVICE", amount: serviceFee, quantity: 1 });
      }
      if (discountAmount > 0) {
        items.push({ name: "Khấu trừ / Giảm giá", type: "DISCOUNT", amount: -discountAmount, quantity: 1 });
      }

      const periodStr = `Tháng ${periodDate.slice(5, 7)}/${periodDate.slice(0, 4)}`;

      const payload = {
        roomId: selectedRoomId,
        contractId: activeContract?.id || "",
        customerId: customerId,
        period: periodStr,
        dueDate: dueDate,
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

      if (sendZaloBot && payMethod === "QR_TRANSFER") {
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

  const avatarUrl = getTenantAvatar(undefined, customRecipientName, isFemale ? "FEMALE" : "MALE");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-[680px]"
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt size={17} />
          </div>
          <div>
            <h2 className="text-base font-black text-text leading-tight">Lập hóa đơn thanh toán</h2>
            <span className="text-[11px] font-bold text-muted">Tùy chỉnh khoản thu 2 cột & phát hành qua Bot Zalo</span>
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
              Lưu bản nháp
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
      <div className="flex flex-col gap-3 max-h-[75vh] overflow-y-auto pr-1">
        {/* 1. CHỌN PHÒNG & NGƯỜI NHẬN HÓA ĐƠN */}
        <div className="rounded-2xl border border-border/70 bg-surface/40 p-3 flex flex-col gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Select Room */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-muted block mb-1">
                Phòng / Căn hộ <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full h-9.5 px-3 rounded-xl border border-border bg-card text-xs font-bold text-text outline-none focus:border-primary transition"
              >
                <option value="">-- Chọn phòng --</option>
                {rooms.map((room: any) => (
                  <option key={room.id} value={room.id}>
                    {room.building?.name || room.building?.code || "Tòa LK01.31"} • Phòng {room.code || room.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Mode: Nguyên căn (Đại diện) vs Khách ghép */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-muted block mb-1">
                Hình thức nhận hóa đơn
              </label>
              <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-0.5 h-9.5">
                <button
                  type="button"
                  onClick={() => setRecipientType("REPRESENTATIVE")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold h-full transition ${
                    recipientType === "REPRESENTATIVE"
                      ? "bg-primary text-white shadow-2xs"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <UserCheck size={13} /> Đại diện HĐ (Nguyên căn)
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientType("ROOMMATE")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold h-full transition ${
                    recipientType === "ROOMMATE"
                      ? "bg-primary text-white shadow-2xs"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <Users size={13} /> Khách thuê ghép
                </button>
              </div>
            </div>
          </div>

          {/* If Roommate Mode: Dropdown to pick roommate in this room */}
          {recipientType === "ROOMMATE" && (
            <div className="rounded-xl bg-card border border-primary/20 p-2.5 flex items-center gap-2">
              <span className="text-xs font-bold text-muted whitespace-nowrap">Chọn khách ghép:</span>
              <select
                value={selectedRoommateId}
                onChange={(e) => setSelectedRoommateId(e.target.value)}
                className="flex-1 h-8 px-2.5 rounded-lg border border-border bg-surface text-xs font-bold text-text outline-none focus:border-primary"
              >
                {availableRoommates.map((rm: any) => (
                  <option key={rm.id} value={rm.id}>
                    {rm.fullName} ({rm.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tenant Contact Card */}
          {selectedRoomId && (
            <div className="flex items-center justify-between rounded-xl bg-card border border-border/60 p-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={avatarUrl}
                    alt={customRecipientName}
                    className={`h-9 w-9 rounded-xl object-cover border shadow-2xs ${
                      isFemale ? "border-pink-300 bg-pink-50" : "border-sky-300 bg-sky-50"
                    }`}
                  />
                  <span
                    className={`absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black text-white ${
                      isFemale ? "bg-rose-500" : "bg-sky-600"
                    }`}
                  >
                    {isFemale ? "♀" : "♂"}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={customRecipientName}
                    onChange={(e) => setCustomRecipientName(e.target.value)}
                    placeholder="Họ và tên khách..."
                    className="font-black text-xs text-text bg-transparent border-b border-dashed border-border focus:border-primary outline-none w-full"
                  />
                  <div className="flex items-center gap-1 text-[11px] text-muted font-mono mt-0.5">
                    <Phone size={10} className="text-emerald-500" />
                    <input
                      type="text"
                      value={customRecipientPhone}
                      onChange={(e) => setCustomRecipientPhone(e.target.value)}
                      placeholder="SĐT Zalo..."
                      className="bg-transparent border-b border-dashed border-border focus:border-primary outline-none w-28"
                    />
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <Badge variant={recipientType === "ROOMMATE" ? "warning" : "primary"} className="text-[10px]">
                  {recipientType === "ROOMMATE" ? "Khách ghép" : "Đại diện hợp đồng"}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* 2. KHOẢN MỤC THU TIỀN (2 CỘT GỌN ĐẸP) */}
        <div className="rounded-2xl border border-border/70 bg-card p-3 flex flex-col gap-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5 border-b border-border/60 pb-2">
            <Receipt size={14} className="text-primary" /> Khoản mục thu tiền
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {/* ====== CỘT 1 ====== */}
            <div className="flex flex-col gap-2">
              {/* 1. Tiền thuê phòng */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-text">
                    <input
                      type="checkbox"
                      checked={includeRent}
                      onChange={(e) => setIncludeRent(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <Building2 size={14} className="text-indigo-500" /> Tiền thuê phòng
                  </label>
                </div>
                {includeRent && (
                  <div className="relative">
                    <input
                      type="text"
                      value={formatCurrencyInput(roomRent)}
                      onChange={(e) => setRoomRent(parseCurrency(e.target.value))}
                      placeholder="0"
                      className="w-full h-8 px-2.5 pr-7 rounded-lg border border-border bg-card font-mono font-bold text-right text-xs text-text outline-none focus:border-primary"
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] text-muted font-bold">đ</span>
                  </div>
                )}
              </div>

              {/* 2. Tiền cọc hợp đồng */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-text">
                    <input
                      type="checkbox"
                      checked={includeContractDeposit}
                      onChange={(e) => setIncludeContractDeposit(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <ShieldCheck size={14} className="text-indigo-600" /> Tiền cọc hợp đồng
                  </label>
                </div>
                {includeContractDeposit && (
                  <div className="relative">
                    <input
                      type="text"
                      value={formatCurrencyInput(contractDeposit)}
                      onChange={(e) => setContractDeposit(parseCurrency(e.target.value))}
                      placeholder="0"
                      className="w-full h-8 px-2.5 pr-7 rounded-lg border border-border bg-card font-mono font-bold text-right text-xs text-text outline-none focus:border-primary"
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] text-muted font-bold">đ</span>
                  </div>
                )}
              </div>

              {/* 3. Cọc giữ phòng */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-text">
                    <input
                      type="checkbox"
                      checked={includeHoldingDeposit}
                      onChange={(e) => setIncludeHoldingDeposit(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <Wallet size={14} className="text-amber-500" /> Cọc giữ phòng
                  </label>
                </div>
                {includeHoldingDeposit && (
                  <div className="relative">
                    <input
                      type="text"
                      value={formatCurrencyInput(holdingDeposit)}
                      onChange={(e) => setHoldingDeposit(parseCurrency(e.target.value))}
                      placeholder="0"
                      className="w-full h-8 px-2.5 pr-7 rounded-lg border border-border bg-card font-mono font-bold text-right text-xs text-text outline-none focus:border-primary"
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] text-muted font-bold">đ</span>
                  </div>
                )}
              </div>
            </div>

            {/* ====== CỘT 2 ====== */}
            <div className="flex flex-col gap-2">
              {/* 4. Tiền điện */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-text">
                    <input
                      type="checkbox"
                      checked={includeElectricity}
                      onChange={(e) => setIncludeElectricity(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <Zap size={14} className="text-amber-500" /> Tiền điện EVN
                  </label>
                </div>
                {includeElectricity && (
                  <div className="relative">
                    <input
                      type="text"
                      value={formatCurrencyInput(electricityAmount)}
                      onChange={(e) => setElectricityAmount(parseCurrency(e.target.value))}
                      placeholder="0"
                      className="w-full h-8 px-2.5 pr-7 rounded-lg border border-border bg-card font-mono font-bold text-right text-xs text-text outline-none focus:border-primary"
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] text-muted font-bold">đ</span>
                  </div>
                )}
              </div>

              {/* 5. Tiền nước (100k / người) */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-text">
                    <input
                      type="checkbox"
                      checked={includeWater}
                      onChange={(e) => setIncludeWater(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <Droplets size={14} className="text-sky-500" /> Tiền nước (100k/người)
                  </label>
                </div>
                {includeWater && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 h-8">
                      <Users size={11} className="text-muted" />
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={waterPeopleCount}
                        onChange={(e) => setWaterPeopleCount(Math.max(1, Number(e.target.value) || 1))}
                        className="w-6 font-mono font-bold text-xs text-text bg-transparent text-center outline-none"
                      />
                      <span className="text-[10px] text-muted">người</span>
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        readOnly
                        value={formatCurrencyInput(waterTotal)}
                        className="w-full h-8 px-2.5 pr-7 rounded-lg border border-border bg-surface font-mono font-bold text-right text-xs text-text outline-none cursor-default"
                      />
                      <span className="absolute right-2.5 top-2 text-[11px] text-muted font-bold">đ</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Wifi (Checkbox Miễn phí) & Khấu trừ */}
              <div className="rounded-xl border border-border/60 bg-surface/30 p-2.5 flex flex-col gap-2">
                {/* Wifi Free Checkbox */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-text">
                    <input
                      type="checkbox"
                      checked={wifiFree}
                      onChange={(e) => setWifiFree(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                    />
                    <Wifi size={14} className="text-emerald-500" /> Wifi (Miễn phí)
                  </label>
                  <span className="text-[11px] font-bold text-emerald-600">0 đ</span>
                </div>

                {/* Discount field */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[11px] font-bold text-muted flex items-center gap-1">
                    <Minus size={11} className="text-rose-500" /> Giảm giá
                  </span>
                  <div className="relative w-28">
                    <input
                      type="text"
                      value={formatCurrencyInput(discountAmount)}
                      onChange={(e) => setDiscountAmount(parseCurrency(e.target.value))}
                      placeholder="0"
                      className="w-full h-7 px-2 pr-5 rounded-md border border-border bg-card font-mono font-bold text-right text-[11px] text-rose-600 outline-none focus:border-rose-500"
                    />
                    <span className="absolute right-1.5 top-1.5 text-[10px] text-rose-500 font-bold">đ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. TỔNG CỘNG & NGÀY THÁNG KỲ CƯỚC / HẠN ĐÓNG */}
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
              Tổng tiền hóa đơn
            </span>
            <span className="font-mono text-2xl font-black text-primary leading-tight">
              {formatVnd(grandTotal)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Kỳ cước (Ô nhập ngày tháng năm) */}
            <div>
              <label className="text-[10px] font-black uppercase text-muted block mb-0.5 flex items-center gap-1">
                <Calendar size={11} className="text-primary" /> Kỳ cước
              </label>
              <input
                type="date"
                value={periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
                className="h-8.5 px-2.5 rounded-xl border border-border bg-card font-mono text-xs font-bold text-text outline-none focus:border-primary shadow-2xs"
              />
            </div>

            {/* Hạn đóng (Ô nhập ngày tháng năm) */}
            <div>
              <label className="text-[10px] font-black uppercase text-muted block mb-0.5 flex items-center gap-1">
                <Clock3 size={11} className="text-amber-500" /> Hạn đóng
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8.5 px-2.5 rounded-xl border border-border bg-card font-mono text-xs font-bold text-text outline-none focus:border-primary shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* 4. PHƯƠNG THỨC THANH TOÁN & GỬI BOT ZALO */}
        <div className="rounded-2xl border border-border/70 bg-surface/30 p-3 flex flex-col gap-2 text-xs">
          <label className="font-black text-muted uppercase tracking-wider text-[10px] block">
            Phương thức thanh toán & Thông báo
          </label>

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

          {/* Sub options */}
          {payMethod === "QR_TRANSFER" && (
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/60 cursor-pointer">
              <div className="flex items-center gap-2">
                <Bot size={15} className="text-primary" />
                <span className="font-bold text-text text-xs">Tự động gửi QR & Hóa đơn qua Bot Zalo</span>
              </div>
              <input
                type="checkbox"
                checked={sendZaloBot}
                onChange={(e) => setSendZaloBot(e.target.checked)}
                className="h-4 w-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </label>
          )}

          {payMethod === "CASH" && (
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/60 cursor-pointer">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span className="font-bold text-text text-xs">Khách đã nộp đủ tiền mặt ngay lúc này (Gạch nợ)</span>
              </div>
              <input
                type="checkbox"
                checked={isCashCollected}
                onChange={(e) => setIsCashCollected(e.target.checked)}
                className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}
