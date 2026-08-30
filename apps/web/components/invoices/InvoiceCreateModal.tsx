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
  Minus,
  Phone,
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
import { getTenantAvatar } from "../tenants/TenantDetailDrawer";
import toast from "react-hot-toast";

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

  // 1. Room & Tenant Selection
  const [selectedRoomId, setSelectedRoomId] = useState<string>(defaultRoomId || "");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("REPRESENTATIVE");
  const [customRecipientName, setCustomRecipientName] = useState<string>("");
  const [customRecipientPhone, setCustomRecipientPhone] = useState<string>("");

  // 2. Fee Line Items (All fees can be included together in one invoice)
  const [includeRent, setIncludeRent] = useState<boolean>(true);
  const [roomRent, setRoomRent] = useState<number>(4500000);

  const [includeContractDeposit, setIncludeContractDeposit] = useState<boolean>(false);
  const [contractDeposit, setContractDeposit] = useState<number>(4500000);

  const [includeHoldingDeposit, setIncludeHoldingDeposit] = useState<boolean>(false);
  const [holdingDeposit, setHoldingDeposit] = useState<number>(1000000);

  const [includeElectricity, setIncludeElectricity] = useState<boolean>(true);
  const [electricityAmount, setElectricityAmount] = useState<number>(0);

  const [includeWater, setIncludeWater] = useState<boolean>(true);
  const [waterPeopleCount, setWaterPeopleCount] = useState<number>(1);
  const [waterUnitPrice, setWaterUnitPrice] = useState<number>(100000);

  const [includeService, setIncludeService] = useState<boolean>(false);
  const [serviceFee, setServiceFee] = useState<number>(0);

  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // 3. Period & Due Date
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [period, setPeriod] = useState<string>(`Tháng ${String(currentMonth).padStart(2, "0")}/${currentYear}`);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  );

  // 4. Payment Method & Zalo Bot
  const [payMethod, setPayMethod] = useState<"QR_TRANSFER" | "CASH">("QR_TRANSFER");
  const [isCashCollected, setIsCashCollected] = useState<boolean>(false);
  const [sendZaloBot, setSendZaloBot] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Find Room & Contract
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

  // Representative & Roommates
  const representative = useMemo(() => {
    return activeContract?.customer || { fullName: "Nguyễn Đức Tính", phone: "0567867889", gender: "MALE" };
  }, [activeContract]);

  const memberCount = activeContract?.memberCount || 1;

  // Auto-fill defaults when Room is selected
  useEffect(() => {
    if (selectedRoom) {
      const defaultRent = selectedRoom.price || activeContract?.monthlyRent || 4500000;
      setRoomRent(defaultRent);
      setContractDeposit(defaultRent);
      setWaterPeopleCount(memberCount);

      if (representative) {
        setCustomRecipientName(representative.fullName || representative.name || "");
        setCustomRecipientPhone(representative.phone || "");
      }
    }
  }, [selectedRoom, activeContract, representative, memberCount]);

  // Water Calculation
  const waterTotal = includeWater ? waterUnitPrice * waterPeopleCount : 0;

  // Grand Total Calculation
  const grandTotal = useMemo(() => {
    let sum = 0;
    if (includeRent) sum += roomRent;
    if (includeContractDeposit) sum += contractDeposit;
    if (includeHoldingDeposit) sum += holdingDeposit;
    if (includeElectricity) sum += electricityAmount;
    if (includeWater) sum += waterTotal;
    if (includeService) sum += serviceFee;
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
    includeService,
    serviceFee,
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
      // Build clean itemized breakdown
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
      if (includeService && serviceFee > 0) {
        items.push({ name: "Wifi & Dịch vụ tiện ích", type: "SERVICE", amount: serviceFee, quantity: 1 });
      }
      if (discountAmount > 0) {
        items.push({ name: "Khấu trừ / Giảm giá", type: "DISCOUNT", amount: -discountAmount, quantity: 1 });
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
        notes: `Hóa đơn ${period} - Khách: ${customRecipientName} (${customRecipientPhone})`,
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

  const isFemale = representative?.gender === "FEMALE" || representative?.gender === "Nữ";
  const avatarUrl = getTenantAvatar(representative?.avatar, representative?.fullName, representative?.gender);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-[640px]"
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt size={17} />
          </div>
          <div>
            <h2 className="text-base font-black text-text leading-tight">Lập hóa đơn thanh toán</h2>
            <span className="text-[11px] font-bold text-muted">Tùy chỉnh khoản thu & phát hành qua Bot Zalo</span>
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
        {/* 1. CHỌN PHÒNG & XÁC NHẬN KHÁCH THUÊ */}
        <div className="rounded-2xl border border-border/70 bg-surface/40 p-3.5 flex flex-col gap-3">
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
                <option value="">-- Chọn phòng thanh toán --</option>
                {rooms.map((room: any) => (
                  <option key={room.id} value={room.id}>
                    {room.building?.name || room.building?.code || "Tòa LK01.31"} • Phòng {room.code || room.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Role */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-muted block mb-1">
                Người nhận hóa đơn
              </label>
              <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-0.5 h-9.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecipientId("REPRESENTATIVE");
                    setCustomRecipientName(representative?.fullName || "Nguyễn Đức Tính");
                    setCustomRecipientPhone(representative?.phone || "0567867889");
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-lg text-[11px] font-bold h-full transition ${
                    selectedRecipientId === "REPRESENTATIVE"
                      ? "bg-primary text-white shadow-2xs"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <User size={12} /> Đại diện HĐ
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecipientId("ROOMMATE")}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-lg text-[11px] font-bold h-full transition ${
                    selectedRecipientId === "ROOMMATE"
                      ? "bg-primary text-white shadow-2xs"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <Users size={12} /> Khách thuê ghép
                </button>
              </div>
            </div>
          </div>

          {/* Tenant Contact Information Card */}
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
                <Badge variant="neutral" className="text-[10px]">
                  {selectedRoom?.code ? `Phòng ${selectedRoom.code}` : "Đang thuê"}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* 2. BẢNG KÊ CÁC KHOẢN PHÍ THANH TOÁN (HỢP NHẤT TOÀN DIỆN) */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface/60 border-b border-border/60 text-[11px] font-black uppercase tracking-wider text-muted select-none">
            <span>Khoản mục thu tiền</span>
            <span>Số tiền (VNĐ)</span>
          </div>

          <div className="divide-y divide-border/40 p-1 text-xs">
            {/* Item 1: Tiền thuê phòng */}
            <div className="flex items-center justify-between py-2 px-2.5 hover:bg-surface/30 rounded-xl transition">
              <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={includeRent}
                  onChange={(e) => setIncludeRent(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <Building2 size={14} className="text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-text block leading-tight">Tiền thuê phòng</span>
                  <span className="text-[10px] text-muted">Định kỳ hàng tháng</span>
                </div>
              </label>
              {includeRent ? (
                <input
                  type="number"
                  value={roomRent}
                  onChange={(e) => setRoomRent(Number(e.target.value) || 0)}
                  className="w-32 h-8 px-2 rounded-lg border border-border bg-surface font-mono font-bold text-right text-xs text-text outline-none focus:border-primary"
                />
              ) : (
                <span className="text-muted italic text-[11px]">Không thu</span>
              )}
            </div>

            {/* Item 2: Tiền đặt cọc hợp đồng */}
            <div className="flex items-center justify-between py-2 px-2.5 hover:bg-surface/30 rounded-xl transition">
              <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={includeContractDeposit}
                  onChange={(e) => setIncludeContractDeposit(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <ShieldCheck size={14} className="text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-text block leading-tight">Tiền cọc hợp đồng</span>
                  <span className="text-[10px] text-muted">Bảo chứng tài sản (hoàn cọc khi trả phòng)</span>
                </div>
              </label>
              {includeContractDeposit ? (
                <input
                  type="number"
                  value={contractDeposit}
                  onChange={(e) => setContractDeposit(Number(e.target.value) || 0)}
                  className="w-32 h-8 px-2 rounded-lg border border-border bg-surface font-mono font-bold text-right text-xs text-text outline-none focus:border-primary"
                />
              ) : (
                <span className="text-muted italic text-[11px]">Không thu</span>
              )}
            </div>

            {/* Item 3: Tiền cọc giữ phòng */}
            <div className="flex items-center justify-between py-2 px-2.5 hover:bg-surface/30 rounded-xl transition">
              <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={includeHoldingDeposit}
                  onChange={(e) => setIncludeHoldingDeposit(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <Wallet size={14} className="text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-text block leading-tight">Cọc giữ phòng</span>
                  <span className="text-[10px] text-muted">Khoản cọc trước khi vào ở</span>
                </div>
              </label>
              {includeHoldingDeposit ? (
                <input
                  type="number"
                  value={holdingDeposit}
                  onChange={(e) => setHoldingDeposit(Number(e.target.value) || 0)}
                  className="w-32 h-8 px-2 rounded-lg border border-border bg-surface font-mono font-bold text-right text-xs text-text outline-none focus:border-primary"
                />
              ) : (
                <span className="text-muted italic text-[11px]">Không thu</span>
              )}
            </div>

            {/* Item 4: Tiền điện (EVN) */}
            <div className="flex items-center justify-between py-2 px-2.5 hover:bg-surface/30 rounded-xl transition">
              <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={includeElectricity}
                  onChange={(e) => setIncludeElectricity(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <Zap size={14} className="text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-text block leading-tight">Tiền điện</span>
                  <span className="text-[10px] text-muted">Theo chỉ số EVN - Giá nhà nước</span>
                </div>
              </label>
              {includeElectricity ? (
                <input
                  type="number"
                  value={electricityAmount}
                  onChange={(e) => setElectricityAmount(Number(e.target.value) || 0)}
                  placeholder="0 đ"
                  className="w-32 h-8 px-2 rounded-lg border border-border bg-surface font-mono font-bold text-right text-xs text-text outline-none focus:border-primary"
                />
              ) : (
                <span className="text-muted italic text-[11px]">Không thu</span>
              )}
            </div>

            {/* Item 5: Tiền nước (100k / người) */}
            <div className="flex items-center justify-between py-2 px-2.5 hover:bg-surface/30 rounded-xl transition">
              <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={includeWater}
                  onChange={(e) => setIncludeWater(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <Droplets size={14} className="text-sky-500 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-text block leading-tight">
                    Tiền nước ({waterPeopleCount} người × 100k)
                  </span>
                  <span className="text-[10px] text-muted">100.000 đ / người / tháng</span>
                </div>
              </label>

              {includeWater ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 bg-surface border border-border rounded-lg px-1.5 h-8">
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
                  <span className="font-mono font-bold text-xs text-text w-24 text-right">
                    {formatVnd(waterTotal)}
                  </span>
                </div>
              ) : (
                <span className="text-muted italic text-[11px]">Không thu</span>
              )}
            </div>

            {/* Item 6: Wifi & Dịch vụ khác */}
            <div className="flex items-center justify-between py-2 px-2.5 hover:bg-surface/30 rounded-xl transition">
              <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={includeService}
                  onChange={(e) => setIncludeService(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <Wifi size={14} className="text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-text block leading-tight">Wifi & Dịch vụ khác</span>
                  <span className="text-[10px] text-muted">Vệ sinh / Rác / Thang máy</span>
                </div>
              </label>
              {includeService ? (
                <input
                  type="number"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(Number(e.target.value) || 0)}
                  placeholder="0 đ"
                  className="w-32 h-8 px-2 rounded-lg border border-border bg-surface font-mono font-bold text-right text-xs text-text outline-none focus:border-primary"
                />
              ) : (
                <span className="text-emerald-600 font-bold text-[11px]">Miễn phí</span>
              )}
            </div>

            {/* Item 7: Khấu trừ / Giảm giá */}
            <div className="flex items-center justify-between py-2 px-2.5 hover:bg-surface/30 rounded-xl transition">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Minus size={14} className="text-rose-500 shrink-0" />
                <span className="font-bold text-muted">Khấu trừ / Giảm giá (nếu có)</span>
              </div>
              <input
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                placeholder="0 đ"
                className="w-32 h-8 px-2 rounded-lg border border-border bg-surface font-mono font-bold text-right text-xs text-rose-600 outline-none focus:border-rose-500"
              />
            </div>
          </div>
        </div>

        {/* 3. TỔNG CỘNG & KỲ HẠN THANH TOÁN */}
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
              Tổng tiền thanh toán
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
                className="h-8 px-2 w-28 rounded-lg border border-border bg-card font-mono text-xs font-bold text-text outline-none focus:border-primary"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted block">Hạn đóng</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border bg-card font-mono text-xs font-bold text-text outline-none focus:border-primary"
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
