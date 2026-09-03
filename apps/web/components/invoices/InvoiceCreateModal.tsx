"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
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
  HelpCircle,
  Loader2,
  Minus,
  Phone,
  Plus,
  QrCode,
  Receipt,
  RotateCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Tag,
  User,
  UserCheck,
  UserPlus,
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
import { customersApi } from "@/lib/api/customers.api";
import { depositsApi } from "@/lib/api/deposits.api";
import { contractsApi } from "@/lib/api/contracts.api";
import { getTenantAvatar } from "../tenants/TenantDetailDrawer";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export type InvoiceModalTab = "INVOICE" | "HOLDING_DEPOSIT" | "HOLDING_REFUND" | "RENT" | "CONTRACT_DEPOSIT";

interface InvoiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRoomId?: string;
  defaultTab?: InvoiceModalTab;
}

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

function addMonthsToDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function InvoiceCreateModal({
  isOpen,
  onClose,
  defaultRoomId,
  defaultTab = "INVOICE",
}: InvoiceCreateModalProps) {
  const queryClient = useQueryClient();
  const { data: rooms = [] } = useRoomsQuery({ limit: 100 });
  const { data: contractsData } = useContractsQuery({ limit: 100 });
  const contracts = Array.isArray(contractsData?.data)
    ? contractsData.data
    : Array.isArray(contractsData)
    ? contractsData
    : [];

  const createMutation = useCreateInvoiceMutation();
  const issueMutation = useIssueInvoiceMutation();
  const payMutation = usePayInvoiceMutation();
  const sendZaloMutation = useSendInvoicePaymentToZaloMutation();

  // Active Tab: Normalize RENT / CONTRACT_DEPOSIT to INVOICE
  const normalizedInitialTab =
    defaultTab === "RENT" || defaultTab === "CONTRACT_DEPOSIT" ? "INVOICE" : defaultTab;
  const [activeTab, setActiveTab] = useState<"INVOICE" | "HOLDING_DEPOSIT" | "HOLDING_REFUND">(
    normalizedInitialTab as any
  );

  // 1. Room Selection
  const [selectedRoomId, setSelectedRoomId] = useState<string>(defaultRoomId || "");

  useEffect(() => {
    if (defaultRoomId) {
      setSelectedRoomId(defaultRoomId);
    }
    if (defaultTab) {
      const norm = defaultTab === "RENT" || defaultTab === "CONTRACT_DEPOSIT" ? "INVOICE" : defaultTab;
      setActiveTab(norm as any);
    }
  }, [defaultRoomId, defaultTab, isOpen]);

  // Lookup Room & Contract from real data
  const selectedRoom = useMemo(() => {
    return rooms.find((r: any) => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  const activeContract = useMemo(() => {
    if (!selectedRoomId) return null;
    return (
      contracts.find(
        (c: any) =>
          (c.roomId === selectedRoomId || c.room?.id === selectedRoomId) &&
          ["ACTIVE", "APPROVED", "DRAFT", "EXPIRING"].includes(c.status)
      ) || null
    );
  }, [contracts, selectedRoomId]);

  // Real representative from room/contract
  const representative = useMemo(() => {
    if (!selectedRoom) return null;
    if (selectedRoom.tenant && (selectedRoom.tenant.name || selectedRoom.tenant.fullName)) {
      return {
        id: selectedRoom.tenant.id,
        fullName: selectedRoom.tenant.name || selectedRoom.tenant.fullName,
        phone: selectedRoom.tenant.phone || "",
        gender: selectedRoom.tenant.gender || "MALE",
        citizenId: selectedRoom.tenant.cccd || selectedRoom.tenant.citizenId || "",
      };
    }
    if (activeContract?.customer) {
      return {
        id: activeContract.customer.id,
        fullName: activeContract.customer.fullName || activeContract.customer.name,
        phone: activeContract.customer.phone || "",
        gender: activeContract.customer.gender || "MALE",
        citizenId: activeContract.customer.identityNo || activeContract.customer.citizenId || "",
      };
    }
    return null;
  }, [selectedRoom, activeContract]);

  // Real roommates from selected room
  const availableRoommates = useMemo(() => {
    if (!selectedRoom) return [];
    const shared = selectedRoom.sharedTenants || [];
    return shared
      .filter((t: any) => (t.name || t.fullName) && (t.name || t.fullName) !== representative?.fullName)
      .map((t: any) => ({
        id: t.id || t.name,
        fullName: t.name || t.fullName,
        phone: t.phone || "",
        gender: t.gender || "MALE",
        citizenId: t.cccd || t.citizenId || "",
      }));
  }, [selectedRoom, representative]);

  // 2. Customer Mode (Existing vs New Customer)
  const [customerMode, setCustomerMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerCitizenId, setNewCustomerCitizenId] = useState("");

  // Recipient Selection (Representative vs Roommate)
  const [recipientType, setRecipientType] = useState<"REPRESENTATIVE" | "ROOMMATE">("REPRESENTATIVE");
  const [selectedRoommateId, setSelectedRoommateId] = useState<string>("");

  const activeExistingRecipient = useMemo(() => {
    if (recipientType === "ROOMMATE" && availableRoommates.length > 0) {
      return availableRoommates.find((r: any) => r.id === selectedRoommateId) || availableRoommates[0];
    }
    return representative;
  }, [recipientType, availableRoommates, selectedRoommateId, representative]);

  const effectiveRecipient = useMemo(() => {
    if (customerMode === "NEW") {
      return {
        id: "",
        fullName: newCustomerName.trim() || "Khách hàng mới",
        phone: newCustomerPhone.trim(),
        citizenId: newCustomerCitizenId.trim(),
        gender: "MALE",
        isNew: true,
      };
    }
    return activeExistingRecipient;
  }, [customerMode, newCustomerName, newCustomerPhone, newCustomerCitizenId, activeExistingRecipient]);

  const hasValidRecipient = customerMode === "NEW" ? !!newCustomerName.trim() && !!newCustomerPhone.trim() : !!effectiveRecipient?.id;

  // 3. Tab 1: HÓA ĐƠN (Tiền kỳ hạn + Cọc hợp đồng)
  const [includeRent, setIncludeRent] = useState<boolean>(true);
  const [roomRent, setRoomRent] = useState<number>(0);

  // Cọc hợp đồng trong Tab Hóa đơn
  const [includeContractDeposit, setIncludeContractDeposit] = useState<boolean>(false);
  const [contractDepositAmount, setContractDepositAmount] = useState<number>(0);
  const [contractDepositNote, setContractDepositNote] = useState<string>("Cọc bảo đảm hợp đồng thuê");
  const [contractDurationMonths, setContractDurationMonths] = useState<number>(6);
  const [contractEndDate, setContractEndDate] = useState<string>(addMonthsToDate(6));

  const [includeElectricity, setIncludeElectricity] = useState<boolean>(true);
  const [electricityAmount, setElectricityAmount] = useState<number>(0);
  const [includeWater, setIncludeWater] = useState<boolean>(true);
  const [waterPeopleCount, setWaterPeopleCount] = useState<number>(1);
  const [waterUnitPrice] = useState<number>(100000); // 100k/person
  const [includeDiscount, setIncludeDiscount] = useState<boolean>(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [includeServiceFee, setIncludeServiceFee] = useState<boolean>(false);

  // 4. Tab 2: Cọc giữ chỗ phòng (Holding Deposit)
  const [holdingDepositAmount, setHoldingDepositAmount] = useState<number>(1000000);
  const [holdingExpiryDate, setHoldingExpiryDate] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [expectedMoveInDate, setExpectedMoveInDate] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [holdingNote, setHoldingNote] = useState<string>("Cọc giữ chỗ khóa phòng chờ vào ở");

  // 5. Tab 3: Hoàn cọc giữ phòng (Holding Deposit Refund - OUTFLOW)
  const [refundAmount, setRefundAmount] = useState<number>(1000000);
  const [refundReason, setRefundReason] = useState<string>("Khách hàng hủy giữ phòng / hoàn trả theo thỏa thuận");
  const [refundMethod, setRefundMethod] = useState<"BANK_TRANSFER" | "CASH">("BANK_TRANSFER");

  // Period & Due Date
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [periodMonth, setPeriodMonth] = useState<number>(currentMonth);
  const [periodYear, setPeriodYear] = useState<number>(currentYear);

  const dueDefault = new Date(Date.now() + 5 * 86400000);
  const [dueDay, setDueDay] = useState<string>(
    `${String(dueDefault.getDate()).padStart(2, "0")}/${String(dueDefault.getMonth() + 1).padStart(2, "0")}/${dueDefault.getFullYear()}`
  );

  // Payment Method & Zalo Bot
  const [payMethod, setPayMethod] = useState<"QR_TRANSFER" | "CASH">("QR_TRANSFER");
  const [isCashCollected, setIsCashCollected] = useState<boolean>(false);
  const [sendZaloBot, setSendZaloBot] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-fill values when Room changes
  useEffect(() => {
    if (selectedRoom) {
      const defaultRent = selectedRoom.price || selectedRoom.monthlyPrice || Number(activeContract?.monthlyRent) || 0;
      setRoomRent(defaultRent);
      const cDeposit = Number(activeContract?.depositMoney) || defaultRent;
      setContractDepositAmount(cDeposit);
      setHoldingDepositAmount(Math.min(defaultRent, 2000000) || 1000000);
      setRefundAmount(Math.min(defaultRent, 2000000) || 1000000);
      setWaterPeopleCount(
        Number(activeContract?.memberCount) || (selectedRoom.sharedTenants?.length ? selectedRoom.sharedTenants.length + 1 : 1)
      );
      setElectricityAmount(0);
      setDiscountAmount(0);

      if (activeContract?.endDate) {
        try {
          const eDate = new Date(activeContract.endDate).toISOString().slice(0, 10);
          setContractEndDate(eDate);
        } catch {}
      }

      if (availableRoommates.length > 0) {
        setSelectedRoommateId(availableRoommates[0].id);
      } else {
        setSelectedRoommateId("");
        setRecipientType("REPRESENTATIVE");
      }
    } else {
      setRoomRent(0);
      setContractDepositAmount(0);
      setHoldingDepositAmount(1000000);
      setRefundAmount(1000000);
      setElectricityAmount(0);
      setDiscountAmount(0);
      setSelectedRoommateId("");
    }
  }, [selectedRoomId, selectedRoom, activeContract, availableRoommates.length]);

  // Calculations per Tab
  const waterTotal = includeWater ? waterUnitPrice * waterPeopleCount : 0;
  const actualDiscount = includeDiscount ? discountAmount : 0;
  const actualServiceFee = includeServiceFee ? serviceFee : 0;

  const grandTotal = useMemo(() => {
    if (activeTab === "HOLDING_DEPOSIT") {
      return holdingDepositAmount;
    }
    if (activeTab === "HOLDING_REFUND") {
      return refundAmount;
    }
    // Tab INVOICE (Thu tiền kỳ hạn + Cọc hợp đồng)
    let sum = 0;
    if (includeRent) sum += roomRent;
    if (includeContractDeposit) sum += contractDepositAmount;
    if (includeElectricity) sum += electricityAmount;
    if (includeWater) sum += waterTotal;
    if (includeServiceFee) sum += actualServiceFee;
    return Math.max(0, sum - actualDiscount);
  }, [
    activeTab,
    holdingDepositAmount,
    refundAmount,
    includeRent,
    roomRent,
    includeContractDeposit,
    contractDepositAmount,
    includeElectricity,
    electricityAmount,
    includeWater,
    waterTotal,
    includeServiceFee,
    actualServiceFee,
    actualDiscount,
  ]);

  // Submit Handler
  const handleCreate = async (autoIssue = true) => {
    if (!selectedRoomId) {
      toast.error("Vui lòng chọn Phòng tạo hóa đơn");
      return;
    }

    if (!hasValidRecipient) {
      toast.error(
        customerMode === "NEW"
          ? "Vui lòng nhập đầy đủ Họ tên và Số điện thoại của khách hàng mới"
          : "Phòng chưa có thông tin khách thuê hợp lệ"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Resolve or Create Customer if in NEW mode
      let customerId = effectiveRecipient?.id || "";
      if (customerMode === "NEW" || !customerId || customerId.startsWith("t-")) {
        const createCustRes = await customersApi.create({
          fullName: newCustomerName.trim() || effectiveRecipient?.fullName || "Khách hàng",
          phone: newCustomerPhone.trim() || effectiveRecipient?.phone || "",
          citizenId: newCustomerCitizenId.trim() || undefined,
          status: "ACTIVE",
          roomId: selectedRoomId,
        });
        const cData = (createCustRes as any)?.data || createCustRes;
        customerId = cData?.id || customerId;
      }

      const periodStr = `Tháng ${String(periodMonth).padStart(2, "0")}/${periodYear}`;
      const parts = dueDay.split("/");
      const dueIso = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : new Date().toISOString().slice(0, 10);

      // Handle TAB 3: Hoàn cọc giữ phòng (OUTFLOW REFUND)
      if (activeTab === "HOLDING_REFUND") {
        const refundPayload = {
          roomId: selectedRoomId,
          customerId,
          contractId: activeContract?.id || undefined,
          period: "Hoàn cọc giữ phòng",
          dueDate: new Date().toISOString(),
          totalAmount: refundAmount,
          paidAmount: refundAmount,
          status: "PAID",
          notes: `[PHIẾU CHI HOÀN CỌC GIỮ PHÒNG] ${refundReason} • Người nhận: ${effectiveRecipient.fullName} (${effectiveRecipient.phone}) • Hình thức: ${refundMethod === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt"}`,
          items: [
            {
              name: "Hoàn trả tiền cọc giữ phòng",
              type: "DISCOUNT",
              amount: -refundAmount,
              quantity: 1,
              description: refundReason,
            },
          ],
        };

        const result: any = await createMutation.mutateAsync(refundPayload);
        const invoiceId = result?.id || result?.data?.id;
        if (invoiceId) {
          try {
            await issueMutation.mutateAsync(invoiceId);
          } catch {}
          try {
            await payMutation.mutateAsync({ id: invoiceId, amount: refundAmount });
          } catch {}
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["invoices"] }),
          queryClient.invalidateQueries({ queryKey: ["deposits"] }),
          queryClient.invalidateQueries({ queryKey: ["rooms"] }),
        ]);

        toast.success(`Đã tạo phiếu hoàn cọc giữ phòng ${formatVnd(refundAmount)} thành công!`);
        onClose();
        return;
      }

      // Handle TAB 2: Cọc giữ chỗ phòng (HOLDING DEPOSIT)
      if (activeTab === "HOLDING_DEPOSIT") {
        const depositCode = `DC-GP-${selectedRoom?.code || selectedRoomId.slice(0, 4)}-${Date.now().toString().slice(-4)}`;
        try {
          await depositsApi.create({
            code: depositCode,
            type: "BOOKING",
            roomId: selectedRoomId,
            customerId,
            amount: holdingDepositAmount,
            status: isCashCollected ? "HELD" : "PENDING",
            expiredAt: holdingExpiryDate,
            note: `${holdingNote} • Ngày dự kiến vào: ${expectedMoveInDate}`,
          });
        } catch (e) {
          console.warn("Could not create deposit record directly:", e);
        }

        const invoicePayload = {
          roomId: selectedRoomId,
          contractId: activeContract?.id || undefined,
          customerId,
          period: "Cọc giữ phòng",
          dueDate: holdingExpiryDate ? new Date(holdingExpiryDate).toISOString() : new Date().toISOString(),
          totalAmount: holdingDepositAmount,
          paidAmount: isCashCollected ? holdingDepositAmount : 0,
          status: isCashCollected ? "PAID" : "UNPAID",
          notes: `[CỌC GIỮ PHÒNG] ${holdingNote} • Khách: ${effectiveRecipient.fullName} (${effectiveRecipient.phone}) • Hạn cọc: ${holdingExpiryDate} • Ngày vào: ${expectedMoveInDate}`,
          items: [
            {
              name: `Tiền cọc giữ chỗ phòng (Hạn: ${holdingExpiryDate})`,
              type: "RENT",
              amount: holdingDepositAmount,
              quantity: 1,
            },
          ],
        };

        const result: any = await createMutation.mutateAsync(invoicePayload);
        const invoiceId = result?.id || result?.data?.id;

        if (autoIssue && invoiceId) {
          try {
            await issueMutation.mutateAsync(invoiceId);
          } catch {}
        }
        if (isCashCollected && invoiceId) {
          try {
            await payMutation.mutateAsync({ id: invoiceId, amount: holdingDepositAmount });
          } catch {}
        }

        if (sendZaloBot && payMethod === "QR_TRANSFER" && invoiceId) {
          try {
            await sendZaloMutation.mutateAsync(invoiceId);
            toast.success(`🤖 Đã gửi mã VietQR cọc giữ phòng qua Bot Zalo cho ${effectiveRecipient.fullName}!`);
          } catch (e: any) {
            toast.success("Tạo hóa đơn cọc giữ phòng thành công!");
          }
        } else {
          toast.success("Tạo hóa đơn cọc giữ phòng thành công!");
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["invoices"] }),
          queryClient.invalidateQueries({ queryKey: ["deposits"] }),
          queryClient.invalidateQueries({ queryKey: ["rooms"] }),
        ]);

        onClose();
        return;
      }

      // Handle TAB 1: HÓA ĐƠN (Thu tiền kỳ hạn + Cọc hợp đồng)
      const items: any[] = [];
      if (includeRent && roomRent > 0) {
        items.push({ name: "Tiền thuê phòng", type: "RENT", amount: roomRent, quantity: 1 });
      }
      if (includeContractDeposit && contractDepositAmount > 0) {
        items.push({
          name: `Tiền đặt cọc hợp đồng (Hạn HĐ: ${contractEndDate})`,
          type: "RENT",
          amount: contractDepositAmount,
          quantity: 1,
        });
      }
      if (includeElectricity && electricityAmount > 0) {
        items.push({ name: "Tiền điện", type: "UTILITY_ELECTRICITY", amount: electricityAmount, quantity: 1 });
      }
      if (includeWater && waterTotal > 0) {
        items.push({
          name: `Tiền nước (${waterPeopleCount} người)`,
          type: "UTILITY_WATER",
          amount: waterTotal,
          quantity: waterPeopleCount,
        });
      }
      if (includeServiceFee && actualServiceFee > 0) {
        items.push({ name: "Phí dịch vụ & tiện ích", type: "SERVICE", amount: actualServiceFee, quantity: 1 });
      }
      if (includeDiscount && discountAmount > 0) {
        items.push({ name: "Giảm giá", type: "DISCOUNT", amount: -discountAmount, quantity: 1 });
      }

      // Automatically sync contract deposit to Deposit module if included
      if (includeContractDeposit && contractDepositAmount > 0) {
        const depositCode = `DC-HD-${selectedRoom?.code || selectedRoomId.slice(0, 4)}-${Date.now().toString().slice(-4)}`;
        try {
          await depositsApi.create({
            code: depositCode,
            type: "SECURITY",
            roomId: selectedRoomId,
            customerId,
            contractId: activeContract?.id || undefined,
            amount: contractDepositAmount,
            status: isCashCollected ? "HELD" : "PENDING",
            note: `${contractDepositNote} • Hạn HĐ: ${contractEndDate}`,
          });
        } catch (e) {
          console.warn("Could not create deposit record directly:", e);
        }

        // Sync contract end date & deposit money if active contract exists
        if (activeContract?.id) {
          try {
            await contractsApi.update(activeContract.id, {
              endDate: new Date(contractEndDate).toISOString(),
              depositMoney: contractDepositAmount,
            });
          } catch (e) {
            console.warn("Could not update contract endDate:", e);
          }
        }
      }

      const payload = {
        roomId: selectedRoomId,
        contractId: activeContract?.id || "",
        customerId,
        period: periodStr,
        dueDate: dueIso,
        totalAmount: grandTotal,
        paidAmount: isCashCollected ? grandTotal : 0,
        status: isCashCollected ? "PAID" : "UNPAID",
        notes: `Hóa đơn ${periodStr} - ${recipientType === "ROOMMATE" ? "Khách ghép" : "Đại diện"}: ${effectiveRecipient.fullName} (${effectiveRecipient.phone})${
          includeContractDeposit ? ` • [GỒM CỌC HĐ: ${formatVnd(contractDepositAmount)} - Hạn HĐ: ${contractEndDate}]` : ""
        }`,
        items: items,
      };

      const result: any = await createMutation.mutateAsync(payload);
      const invoiceId = result?.id || result?.data?.id;

      if (autoIssue && invoiceId) {
        try {
          await issueMutation.mutateAsync(invoiceId);
        } catch {}
      }

      if (isCashCollected && invoiceId) {
        try {
          await payMutation.mutateAsync({ id: invoiceId, amount: grandTotal });
        } catch {}
      }

      if (sendZaloBot && payMethod === "QR_TRANSFER" && invoiceId) {
        try {
          await sendZaloMutation.mutateAsync(invoiceId);
          toast.success(`🤖 Bot Zalo đã gửi hóa đơn & VietQR tới ${effectiveRecipient.fullName} thành công!`, {
            duration: 5000,
          });
        } catch (e: any) {
          toast.error(e?.message || `Khách thuê ${effectiveRecipient.fullName} chưa liên kết Zalo ID với Bot.`);
        }
      } else {
        toast.success(
          includeContractDeposit
            ? "Tạo hóa đơn & đồng bộ tiền cọc hợp đồng thành công!"
            : "Tạo hóa đơn thành công!"
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["deposits"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["rooms"] }),
      ]);

      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Có lỗi xảy ra khi tạo hóa đơn");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFemale = effectiveRecipient?.gender === "FEMALE" || effectiveRecipient?.gender === "Nữ";
  const avatarUrl = getTenantAvatar(
    undefined,
    effectiveRecipient?.fullName || "Khách thuê",
    isFemale ? "FEMALE" : "MALE"
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-[720px]"
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
            <Receipt size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-black text-text leading-tight">Lập hóa đơn & Phiếu thu/chi</h2>
            <span className="text-[11px] text-muted font-medium">Quản lý tiền phòng, cọc giữ chỗ, cọc hợp đồng & hoàn cọc</span>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="rounded-xl font-bold text-xs" onClick={onClose}>
            Hủy
          </Button>

          <div className="flex items-center gap-2">
            {activeTab !== "HOLDING_REFUND" && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl font-bold text-xs"
                onClick={() => handleCreate(false)}
                disabled={!hasValidRecipient || isSubmitting}
              >
                Lưu nháp
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              className={`rounded-xl font-black text-white shadow-xs px-4 text-xs transition ${
                !hasValidRecipient
                  ? "bg-muted/40 cursor-not-allowed opacity-60 text-text/50"
                  : activeTab === "HOLDING_REFUND"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-primary hover:bg-primary/90"
              }`}
              onClick={() => handleCreate(true)}
              disabled={!hasValidRecipient || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" /> Đang xử lý...
                </>
              ) : activeTab === "HOLDING_REFUND" ? (
                <>
                  <ArrowUpRight size={14} className="mr-1.5" /> Tạo phiếu hoàn cọc ({formatVnd(refundAmount)})
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
      <div className="flex flex-col gap-3.5 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {/* TOP TAB BAR - 3 TABS GỘP */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("INVOICE")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "INVOICE"
                ? "bg-card text-primary shadow-xs font-black border border-primary/20"
                : "text-muted hover:text-text"
            }`}
          >
            <Receipt size={14} className="shrink-0" />
            <span className="truncate">Hóa đơn</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("HOLDING_DEPOSIT")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "HOLDING_DEPOSIT"
                ? "bg-card text-amber-600 dark:text-amber-400 shadow-xs font-black border border-amber-500/30"
                : "text-muted hover:text-text"
            }`}
          >
            <Wallet size={14} className="shrink-0 text-amber-500" />
            <span className="truncate">Cọc giữ chỗ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("HOLDING_REFUND")}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "HOLDING_REFUND"
                ? "bg-card text-rose-600 dark:text-rose-400 shadow-xs font-black border border-rose-500/30"
                : "text-muted hover:text-text"
            }`}
          >
            <RotateCcw size={14} className="shrink-0 text-rose-500" />
            <span className="truncate">Hoàn cọc giữ chỗ</span>
          </button>
        </div>

        {/* 1. CHỌN PHÒNG & THÔNG TIN KHÁCH HÀNG */}
        <div className="rounded-xl border border-border/80 bg-surface/30 p-3 flex flex-col gap-2.5">
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
                  const tenantName = room.tenant?.name || room.tenant?.fullName;
                  const isOccupied = !!tenantName;
                  const label = `${bName ? `${bName} • ` : ""}${rCode} ${isOccupied ? `(${tenantName})` : "— [Phòng trống]"}`;
                  return (
                    <option key={room.id} value={room.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Customer Type Toggle: Khách hiện có vs Khách mới */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-muted block mb-1">
                Đối tượng khách
              </label>
              <div className="inline-flex rounded-lg p-0.5 bg-surface border border-border">
                <button
                  type="button"
                  onClick={() => setCustomerMode("EXISTING")}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    customerMode === "EXISTING" ? "bg-card text-primary shadow-xs font-black" : "text-muted hover:text-text"
                  }`}
                >
                  Khách hiện có
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode("NEW")}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    customerMode === "NEW" ? "bg-card text-primary shadow-xs font-black" : "text-muted hover:text-text"
                  }`}
                >
                  + Khách mới
                </button>
              </div>
            </div>
          </div>

          {/* New Customer Form Inputs */}
          {customerMode === "NEW" ? (
            <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 flex flex-col gap-2 animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                <UserPlus size={14} /> Điền thông tin khách hàng mới:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-0.5">Họ và tên *</label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn A"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-border bg-card text-xs font-semibold text-text outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-0.5">Số điện thoại *</label>
                  <input
                    type="tel"
                    placeholder="VD: 0901234567"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-border bg-card text-xs font-mono font-semibold text-text outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-0.5">CCCD / CMND</label>
                  <input
                    type="text"
                    placeholder="Số căn cước công dân"
                    value={newCustomerCitizenId}
                    onChange={(e) => setNewCustomerCitizenId(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-border bg-card text-xs font-mono font-semibold text-text outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Existing Customer Info Bar */
            selectedRoom && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-text text-xs truncate">
                        {effectiveRecipient?.fullName || "Chưa có khách thuê"}
                      </span>
                      <span className="text-[10px] text-muted font-mono">
                        {effectiveRecipient?.phone ? `• ${effectiveRecipient.phone}` : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {availableRoommates.length > 0 && activeTab === "INVOICE" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={recipientType === "ROOMMATE" ? selectedRoommateId : "REP"}
                      onChange={(e) => {
                        if (e.target.value === "REP") {
                          setRecipientType("REPRESENTATIVE");
                        } else {
                          setRecipientType("ROOMMATE");
                          setSelectedRoommateId(e.target.value);
                        }
                      }}
                      className="h-7 px-2 rounded-md border border-border bg-surface text-[11px] font-bold text-text outline-none"
                    >
                      <option value="REP">Đại diện ({representative?.fullName || "Hợp đồng"})</option>
                      {availableRoommates.map((rm: any) => (
                        <option key={rm.id} value={rm.id}>
                          Khách ghép: {rm.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* 2. BODY PER TAB */}

        {/* TAB 1: HÓA ĐƠN (TIỀN KỲ HẠN + CỌC HỢP ĐỒNG GỘP LÀM 1) */}
        {activeTab === "INVOICE" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-1">
              <span className="text-[11px] font-black uppercase text-muted tracking-wider">
                Khoản mục thu tiền kỳ hạn & Cọc hợp đồng
              </span>
              <span className="text-[11px] text-muted font-medium">Tích chọn các khoản thu cần lập</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Tiền phòng */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="inc-rent"
                    checked={includeRent}
                    onChange={(e) => setIncludeRent(e.target.checked)}
                    className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                  />
                  <label htmlFor="inc-rent" className="font-bold text-text flex items-center gap-1.5 cursor-pointer">
                    <Building2 size={15} className="text-primary" /> Tiền phòng
                  </label>
                </div>
                <input
                  type="text"
                  disabled={!includeRent}
                  value={formatCurrencyInput(roomRent)}
                  onChange={(e) => setRoomRent(parseCurrency(e.target.value))}
                  className="w-32 h-7.5 px-2 text-right font-black rounded-lg border border-border bg-surface text-text text-xs outline-none focus:border-primary"
                />
              </div>

              {/* Tiền Cọc hợp đồng */}
              <div
                className={`col-span-1 sm:col-span-2 flex flex-col gap-2 p-2.5 rounded-xl border transition-all ${
                  includeContractDeposit
                    ? "border-indigo-500/50 bg-indigo-50/40 dark:bg-indigo-950/20"
                    : "border-border/70 bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="inc-cdeposit"
                      checked={includeContractDeposit}
                      onChange={(e) => setIncludeContractDeposit(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <label
                      htmlFor="inc-cdeposit"
                      className="font-bold text-text flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck size={15} className="text-indigo-600 dark:text-indigo-400" />
                      <span>Cọc hợp đồng</span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.2 rounded font-medium">
                        Bảo đảm HĐ
                      </span>
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={!includeContractDeposit}
                    value={formatCurrencyInput(contractDepositAmount)}
                    onChange={(e) => setContractDepositAmount(parseCurrency(e.target.value))}
                    placeholder="0 đ"
                    className="w-36 h-7.5 px-2 text-right font-black rounded-lg border border-border bg-card text-indigo-600 dark:text-indigo-400 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Khi tích chọn Cọc hợp đồng: Hiển thị thêm button/input Hạn Hợp Đồng */}
                {includeContractDeposit && (
                  <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 animate-in fade-in-50 duration-200">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                        <Calendar size={13} className="text-indigo-600" /> Hạn hợp đồng:
                      </span>
                      <div className="inline-flex rounded-lg p-0.5 bg-card border border-indigo-200 dark:border-indigo-800 text-[10px]">
                        {[3, 6, 12].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setContractDurationMonths(m);
                              setContractEndDate(addMonthsToDate(m));
                            }}
                            className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                              contractDurationMonths === m
                                ? "bg-indigo-600 text-white shadow-xs font-black"
                                : "text-muted hover:text-text"
                            }`}
                          >
                            {m} tháng
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold text-muted whitespace-nowrap">Đến ngày:</label>
                      <input
                        type="date"
                        value={contractEndDate}
                        onChange={(e) => {
                          setContractEndDate(e.target.value);
                          setContractDurationMonths(0);
                        }}
                        className="h-7 px-2 rounded-md border border-indigo-300 dark:border-indigo-700 bg-card text-[11px] font-bold font-mono text-text outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Tiền điện */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="inc-elec"
                    checked={includeElectricity}
                    onChange={(e) => setIncludeElectricity(e.target.checked)}
                    className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                  />
                  <label htmlFor="inc-elec" className="font-bold text-text flex items-center gap-1.5 cursor-pointer">
                    <Zap size={15} className="text-amber-500" /> Tiền điện
                  </label>
                </div>
                <input
                  type="text"
                  disabled={!includeElectricity}
                  value={formatCurrencyInput(electricityAmount)}
                  onChange={(e) => setElectricityAmount(parseCurrency(e.target.value))}
                  className="w-32 h-7.5 px-2 text-right font-black rounded-lg border border-border bg-surface text-text text-xs outline-none focus:border-primary"
                />
              </div>

              {/* Tiền nước */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="inc-water"
                    checked={includeWater}
                    onChange={(e) => setIncludeWater(e.target.checked)}
                    className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                  />
                  <label htmlFor="inc-water" className="font-bold text-text flex items-center gap-1.5 cursor-pointer">
                    <Droplets size={15} className="text-sky-500" /> Tiền nước
                  </label>
                  <div className="flex items-center gap-1 bg-surface px-1.5 py-0.5 rounded-md border border-border/60 text-[10px] font-bold">
                    <Users size={11} className="text-muted" />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={waterPeopleCount}
                      onChange={(e) => setWaterPeopleCount(Math.max(1, Number(e.target.value)))}
                      className="w-7 text-center bg-transparent outline-none font-bold"
                    />
                    <span>người</span>
                  </div>
                </div>
                <span className="font-black text-text text-xs">{formatVnd(waterTotal)}</span>
              </div>

              {/* Phí dịch vụ */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="inc-svc"
                    checked={includeServiceFee}
                    onChange={(e) => setIncludeServiceFee(e.target.checked)}
                    className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                  />
                  <label htmlFor="inc-svc" className="font-bold text-text flex items-center gap-1.5 cursor-pointer">
                    <Tag size={15} className="text-emerald-500" /> Phí dịch vụ
                  </label>
                </div>
                <input
                  type="text"
                  disabled={!includeServiceFee}
                  value={formatCurrencyInput(serviceFee)}
                  onChange={(e) => setServiceFee(parseCurrency(e.target.value))}
                  placeholder="0 đ"
                  className="w-32 h-7.5 px-2 text-right font-black rounded-lg border border-border bg-surface text-text text-xs outline-none focus:border-primary"
                />
              </div>

              {/* Giảm giá */}
              <div className="col-span-1 sm:col-span-2 flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="inc-disc"
                    checked={includeDiscount}
                    onChange={(e) => setIncludeDiscount(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-500 accent-rose-500 cursor-pointer"
                  />
                  <label htmlFor="inc-disc" className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 cursor-pointer">
                    <Gift size={15} /> Giảm giá / Khuyến mãi
                  </label>
                </div>
                <input
                  type="text"
                  disabled={!includeDiscount}
                  value={formatCurrencyInput(discountAmount)}
                  onChange={(e) => setDiscountAmount(parseCurrency(e.target.value))}
                  placeholder="0 đ"
                  className="w-32 h-7.5 px-2 text-right font-black rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 text-xs outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CỌC GIỮ CHỖ PHÒNG */}
        {activeTab === "HOLDING_DEPOSIT" && (
          <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold">
                <Wallet size={16} /> Phiếu thu cọc giữ chỗ phòng
              </div>
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Khóa phòng chờ vào ở</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                  Số tiền cọc giữ phòng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formatCurrencyInput(holdingDepositAmount)}
                  onChange={(e) => setHoldingDepositAmount(parseCurrency(e.target.value))}
                  className="w-full h-8.5 px-2.5 font-black text-amber-600 dark:text-amber-400 rounded-lg border border-border bg-card text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted block mb-1">Hạn giữ phòng</label>
                <input
                  type="date"
                  value={holdingExpiryDate}
                  onChange={(e) => setHoldingExpiryDate(e.target.value)}
                  className="w-full h-8.5 px-2.5 font-bold rounded-lg border border-border bg-card text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted block mb-1">Ngày dự kiến vào ở</label>
                <input
                  type="date"
                  value={expectedMoveInDate}
                  onChange={(e) => setExpectedMoveInDate(e.target.value)}
                  className="w-full h-8.5 px-2.5 font-bold rounded-lg border border-border bg-card text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted block mb-1">Ghi chú cọc</label>
                <input
                  type="text"
                  placeholder="Ghi chú điều khoản cọc giữ phòng"
                  value={holdingNote}
                  onChange={(e) => setHoldingNote(e.target.value)}
                  className="w-full h-8.5 px-2.5 font-medium rounded-lg border border-border bg-card text-xs outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HOÀN CỌC GIỮ PHÒNG (CHI) */}
        {activeTab === "HOLDING_REFUND" && (
          <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                <ArrowUpRight size={16} /> Phiếu chi hoàn tiền cọc giữ phòng
              </div>
              <span className="text-[11px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md">
                Chiều Chi (-)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted block mb-1">
                  Số tiền hoàn trả <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formatCurrencyInput(refundAmount)}
                  onChange={(e) => setRefundAmount(parseCurrency(e.target.value))}
                  className="w-full h-8.5 px-2.5 font-black text-rose-600 rounded-lg border border-border bg-card text-sm outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-muted block mb-1">Hình thức hoàn tiền</label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="w-full h-8.5 px-2.5 font-bold rounded-lg border border-border bg-card text-xs outline-none focus:border-rose-500"
                >
                  <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                  <option value="CASH">Tiền mặt</option>
                </select>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-muted block mb-1">Lý do hoàn cọc</label>
                <input
                  type="text"
                  placeholder="VD: Khách hàng hủy giữ phòng / hoàn trả theo thỏa thuận"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full h-8.5 px-2.5 font-medium rounded-lg border border-border bg-card text-xs outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. TỔNG TIỀN, KỲ CƯỚC & HẠN ĐÓNG */}
        {activeTab === "INVOICE" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl border border-border/80 bg-surface/30">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
                Tổng tiền thanh toán
              </span>
              <div className="text-lg font-black mt-0.5 text-primary">
                {formatVnd(grandTotal)}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-muted block mb-1">Kỳ cước</span>
              <div className="flex items-center gap-1">
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(Number(e.target.value))}
                  className="h-7.5 px-2 rounded-lg border border-border bg-card text-xs font-bold text-text outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      Tháng {String(m).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <select
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                  className="h-7.5 px-2 rounded-lg border border-border bg-card text-xs font-bold text-text outline-none"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <option key={y} value={y}>
                      /{y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-muted block mb-1">Hạn đóng</span>
              <div className="flex items-center gap-1.5 h-7.5 px-2.5 rounded-lg border border-border bg-card text-xs font-bold text-text">
                <Calendar size={13} className="text-muted shrink-0" />
                <input
                  type="text"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="dd/mm/yyyy"
                  className="w-full bg-transparent outline-none font-mono text-xs"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-surface/30">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
                {activeTab === "HOLDING_REFUND" ? "Tổng tiền hoàn trả" : "Tổng tiền cọc giữ chỗ"}
              </span>
              <div
                className={`text-lg font-black mt-0.5 ${
                  activeTab === "HOLDING_REFUND"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-primary"
                }`}
              >
                {activeTab === "HOLDING_REFUND" ? `- ${formatVnd(grandTotal)}` : formatVnd(grandTotal)}
              </div>
            </div>
          </div>
        )}

        {/* 4. PHƯƠNG THỨC THANH TOÁN & BOT ZALO */}
        {activeTab !== "HOLDING_REFUND" && (
          <div className="rounded-xl border border-border/80 bg-surface/30 p-2.5 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayMethod("QR_TRANSFER")}
                className={`flex items-center justify-center gap-2 p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  payMethod === "QR_TRANSFER"
                    ? "bg-card border-primary text-primary shadow-xs font-black"
                    : "bg-surface border-border text-muted hover:text-text"
                }`}
              >
                <QrCode size={15} /> Chuyển khoản QR (VietQR)
              </button>

              <button
                type="button"
                onClick={() => setPayMethod("CASH")}
                className={`flex items-center justify-center gap-2 p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  payMethod === "CASH"
                    ? "bg-card border-primary text-primary shadow-xs font-black"
                    : "bg-surface border-border text-muted hover:text-text"
                }`}
              >
                <Banknote size={15} /> Thu tiền mặt
              </button>
            </div>

            {payMethod === "QR_TRANSFER" ? (
              <label className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendZaloBot}
                  onChange={(e) => setSendZaloBot(e.target.checked)}
                  className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                />
                <span className="font-bold text-[11px] flex items-center gap-1.5">
                  <Bot size={14} className="text-primary" /> Tự động gửi QR & Hóa đơn qua Bot Zalo cho khách
                </span>
              </label>
            ) : (
              <label className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCashCollected}
                  onChange={(e) => setIsCashCollected(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
                />
                <span className="font-bold text-[11px]">Đã nhận đủ tiền mặt (Đánh dấu đã thanh toán)</span>
              </label>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
