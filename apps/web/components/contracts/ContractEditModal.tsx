"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Building,
  DoorClosed,
  Calendar,
  Users,
  Wallet,
  Zap,
  Droplets,
  Wifi,
  Trash2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Eye,
  FileCheck,
  ImageIcon,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useUpdateContractMutation } from "@/lib/mutations/contracts.mutations";
import { getTenantAvatar } from "../tenants/TenantDetailDrawer";

type Props = {
  contract: any;
  isOpen: boolean;
  onClose: () => void;
  onRenew: () => void;
  canRenew: boolean;
};

type FormState = {
  building: string;
  room: string;
  startDate: string;
  endDate: string;
  rentAmount: string;
  depositAmount: string;
  paymentCycle: string;
  paymentDay: string;
  notes: string;
  utilityElectricity: boolean;
  utilityWater: boolean;
  utilityWifi: boolean;
  utilityCleaning: boolean;
};

const toDateInput = (value: any) => {
  if (!value) return "";
  const raw = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(raw)
    ? raw.slice(0, 10)
    : new Date(value).toISOString().slice(0, 10);
};

const formatCurrency = (val: string | number) => {
  const num = Number(val);
  if (isNaN(num)) return "0đ";
  return `${num.toLocaleString("vi-VN")}đ`;
};

const formatMoneyInput = (val: string | number) => {
  if (val === "" || val === undefined || val === null) return "";
  const clean = typeof val === "number" ? String(val) : String(val).replace(/\D/g, "");
  if (!clean) return "";
  const num = Number(clean);
  if (isNaN(num)) return "";
  return num.toLocaleString("vi-VN");
};

const parseMoneyInput = (val: string) => {
  return val.replace(/\D/g, "");
};

export default function ContractEditModal({
  contract,
  isOpen,
  onClose,
  onRenew,
  canRenew,
}: Props) {
  const update = useUpdateContractMutation();
  const [activeStep, setActiveStep] = useState(1);

  const initialForm = useMemo<FormState>(() => {
    return {
      building: contract?.room?.building?.code || contract?.room?.building?.name || "LK01-32",
      room: contract?.room?.code || contract?.room?.number || "LK01.32",
      startDate: toDateInput(contract?.startDate) || "2026-09-29",
      endDate: toDateInput(contract?.endDate) || "2027-09-29",
      rentAmount: String(contract?.rentAmount ?? contract?.monthlyRent ?? 4000000),
      depositAmount: String(contract?.depositAmount ?? contract?.depositMoney ?? 8000000),
      paymentCycle: "Hàng tháng",
      paymentDay: "Mùng 1",
      notes: contract?.purpose || "",
      utilityElectricity: true,
      utilityWater: true,
      utilityWifi: false,
      utilityCleaning: false,
    };
  }, [contract]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm);
      setError("");
      setActiveStep(1);
    }
  }, [initialForm, isOpen]);

  const customerName =
    contract?.customer?.fullName || contract?.customer?.name || "UAT LK01.32 2PN MUMN94T9";
  const customerPhone = contract?.customer?.phone || contract?.customerPhone || "0984 393 373";
  const customerGender = contract?.customer?.gender || "MALE";
  const avatarUrl = getTenantAvatar(contract?.customer?.avatar, customerName, customerGender);
  const roomName = contract?.room?.code || contract?.room?.number || "PN 32-02";
  const buildingTitle = contract?.room?.building?.name || "Tòa nhà LK01-32";

  // Check diffs
  const initialStartDate = toDateInput(contract?.startDate) || "2026-09-29";
  const initialEndDate = toDateInput(contract?.endDate) || "2027-09-29";
  const initialRent = Number(contract?.rentAmount ?? contract?.monthlyRent ?? 3500000);
  const currentRent = Number(form.rentAmount) || 0;
  const initialDeposit = Number(contract?.depositAmount ?? contract?.depositMoney ?? 7000000);
  const currentDeposit = Number(form.depositAmount) || 0;

  const hasFinancialChanges =
    currentRent !== initialRent || currentDeposit !== initialDeposit || form.startDate !== initialStartDate || form.endDate !== initialEndDate;

  const handleSave = () => {
    if (form.endDate < form.startDate) {
      setError("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
      return;
    }

    const payload: Record<string, any> = {
      startDate: form.startDate,
      endDate: form.endDate,
      rentAmount: Number(form.rentAmount) || 0,
      depositAmount: Number(form.depositAmount) || 0,
      purpose: form.notes,
    };

    update.mutate(
      { id: contract.id, data: payload },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err: any) => {
          setError(err?.message || "Không thể cập nhật hợp đồng.");
        },
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-[1100px]"
      testId="contract-edit-modal"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 shrink-0">
            <FileText size={16} />
          </div>
          <span className="text-base font-black text-slate-800 dark:text-white">
            Chỉnh sửa hợp đồng thuê phòng
          </span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose} className="rounded-xl px-4 text-xs font-bold text-slate-500 hover:text-slate-700">
            Hủy
          </Button>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" onClick={onClose} className="rounded-xl px-4 text-xs font-bold border-slate-200">
              Lưu nháp
            </Button>
            <Button
              onClick={handleSave}
              isLoading={update.isPending}
              className="rounded-xl px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-xs"
            >
              <CheckCircle2 size={15} className="mr-1.5" />
              Lưu cập nhật
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Contract Title Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-white/[0.08] pb-3.5">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base md:text-lg font-black text-slate-800 dark:text-white">
              {customerName}
            </h3>
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Đang hiệu lực
            </span>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {roomName} • {buildingTitle}
          </span>
        </div>

        {/* 4-Step Wizard Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-1.5 bg-slate-50/50 dark:bg-white/[0.02]">
          {[
            { step: 1, title: "Thông tin chung", subtitle: "Thông tin hợp đồng" },
            { step: 2, title: "Khách thuê", subtitle: "Thông tin người thuê" },
            { step: 3, title: "Tài chính", subtitle: "Giá thuê, thanh toán" },
            { step: 4, title: "Hồ sơ", subtitle: "Tài liệu, chữ ký" },
          ].map((item) => {
            const isActive = activeStep === item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setActiveStep(item.step)}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 text-left ${
                  isActive
                    ? "bg-white dark:bg-card shadow-xs border border-primary/20"
                    : "hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    isActive
                      ? "bg-primary text-white shadow-xs"
                      : "bg-slate-200/70 dark:bg-white/[0.1] text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {item.step}
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-xs font-bold truncate ${
                      isActive ? "text-primary" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-6 items-start">
          {/* Left Column: Form Fields */}
          <div className="flex flex-col gap-6">
            {/* 1. Thông tin hợp đồng */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black text-sm">
                <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <Building size={13} />
                </div>
                <span>Thông tin hợp đồng</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tòa nhà <span className="text-[10px] font-normal text-slate-400">(Cố định)</span>
                  </label>
                  <div className="w-full h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] px-3 flex items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    {form.building}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Phòng <span className="text-[10px] font-normal text-slate-400">(Cố định)</span>
                  </label>
                  <div className="w-full h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] px-3 flex items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    {form.room}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Ngày bắt đầu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card px-3 text-xs font-mono font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Ngày kết thúc <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card px-3 text-xs font-mono font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* 2. Thông tin tài chính */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black text-sm">
                <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <Wallet size={13} />
                </div>
                <span>Thông tin tài chính</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Giá thuê / tháng <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(form.rentAmount)}
                      onChange={(e) => setForm({ ...form, rentAmount: parseMoneyInput(e.target.value) })}
                      placeholder="0"
                      className="w-full h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card pl-3 pr-7 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      đ
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Tiền cọc <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatMoneyInput(form.depositAmount)}
                      onChange={(e) => setForm({ ...form, depositAmount: parseMoneyInput(e.target.value) })}
                      placeholder="0"
                      className="w-full h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card pl-3 pr-7 text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      đ
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Chu kỳ thanh toán <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.paymentCycle}
                    onChange={(e) => setForm({ ...form, paymentCycle: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card px-3 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                  >
                    <option value="Hàng tháng">Hàng tháng</option>
                    <option value="Quý (3 tháng)">Quý (3 tháng)</option>
                    <option value="6 tháng">6 tháng</option>
                    <option value="1 năm">1 năm</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Ngày thanh toán <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.paymentDay}
                    onChange={(e) => setForm({ ...form, paymentDay: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card px-3 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                  >
                    <option value="Mùng 1">Mùng 1</option>
                    <option value="Mùng 5">Mùng 5</option>
                    <option value="Mùng 10">Mùng 10</option>
                    <option value="Mùng 15">Mùng 15</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Ghi chú
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {form.notes.length}/200
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={200}
                    value={form.notes}
                    placeholder="Nhập ghi chú về thanh toán, ưu đãi..."
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card px-3 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* 3. Dịch vụ & tiện ích */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black text-sm">
                <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <Zap size={13} />
                </div>
                <span>Dịch vụ & tiện ích</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Điện */}
                <label
                  className={`flex flex-col gap-1 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                    form.utilityElectricity
                      ? "border-primary/40 bg-purple-50/40 dark:bg-purple-950/20"
                      : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                      <Zap size={13} />
                      <span>Điện</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.utilityElectricity}
                      onChange={(e) => setForm({ ...form, utilityElectricity: e.target.checked })}
                      className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">Tính theo đồng hồ</span>
                </label>

                {/* Nước */}
                <label
                  className={`flex flex-col gap-1 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                    form.utilityWater
                      ? "border-primary/40 bg-blue-50/40 dark:bg-blue-950/20"
                      : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                      <Droplets size={13} />
                      <span>Nước</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.utilityWater}
                      onChange={(e) => setForm({ ...form, utilityWater: e.target.checked })}
                      className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">Tính theo đồng hồ</span>
                </label>

                {/* Wifi */}
                <label
                  className={`flex flex-col gap-1 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                    form.utilityWifi
                      ? "border-primary/40 bg-emerald-50/40 dark:bg-emerald-950/20"
                      : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <Wifi size={13} />
                      <span>Wifi</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.utilityWifi}
                      onChange={(e) => setForm({ ...form, utilityWifi: e.target.checked })}
                      className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">Bao gồm trong giá thuê</span>
                </label>

                {/* Vệ sinh / Rác */}
                <label
                  className={`flex flex-col gap-1 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                    form.utilityCleaning
                      ? "border-primary/40 bg-teal-50/40 dark:bg-teal-950/20"
                      : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-300">
                      <Trash2 size={13} />
                      <span>Vệ sinh / Rác</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.utilityCleaning}
                      onChange={(e) => setForm({ ...form, utilityCleaning: e.target.checked })}
                      className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">Bao gồm trong giá thuê</span>
                </label>
              </div>
            </div>

            {/* 4. Hồ sơ & chữ ký */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black text-sm">
                <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <FileCheck size={13} />
                </div>
                <span>Hồ sơ & chữ ký</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Upload HĐ PDF */}
                <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1.5 bg-slate-50/50 dark:bg-white/[0.02]">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                    PDF
                  </div>
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Kéo thả file PDF vào đây hoặc <span className="text-primary cursor-pointer hover:underline">nhấp để chọn file</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Hỗ trợ file PDF, tối đa 10MB</span>
                </div>

                {/* Upload CCCD Mặt trước */}
                <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl p-2.5 flex items-center gap-2.5 bg-white dark:bg-card relative group">
                  <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border">
                    <img
                      src="/placeholder-cccd.jpg"
                      alt="CCCD"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                      className="w-full h-full object-cover"
                    />
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-100">
                      CCCD
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                      CCCD_mat_truoc.jpg
                    </div>
                    <span className="text-[10px] text-slate-400">2.4 MB</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Xóa ảnh CCCD"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Upload CCCD Mặt sau */}
                <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1 bg-slate-50/50 dark:bg-white/[0.02] cursor-pointer hover:border-primary/50">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <ImageIcon size={14} />
                  </div>
                  <div className="text-[11px] font-bold text-primary">
                    Thêm ảnh mặt sau
                  </div>
                  <span className="text-[10px] text-slate-400">PNG, JPG (tối đa 5MB)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Xem trước thay đổi (Live Diff) */}
          <div className="flex flex-col gap-4 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 bg-slate-50/40 dark:bg-white/[0.01]">
            <div>
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black text-sm">
                <Eye size={15} className="text-primary" />
                <span>Xem trước thay đổi</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                So sánh thông tin trước và sau khi cập nhật
              </p>
            </div>

            {/* Customer mini card */}
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-card border border-slate-200/70 dark:border-white/[0.08]">
              <img
                src={avatarUrl}
                alt={customerName}
                className="w-8 h-8 rounded-lg object-cover border"
              />
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-800 dark:text-white truncate">
                  {customerName}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {customerPhone}
                </div>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl overflow-hidden bg-white dark:bg-card">
              <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-slate-50/80 dark:bg-white/[0.02] text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b">
                <span>Thông tin</span>
                <span>Hiện tại</span>
                <span>Sau khi cập nhật</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
                <div className="grid grid-cols-3 gap-2 px-3 py-2 items-center">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Giá thuê / tháng</span>
                  <span className="text-slate-500 line-through font-mono text-[11px]">{formatCurrency(initialRent)}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                    {formatCurrency(currentRent)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 px-3 py-2 items-center">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Tiền cọc</span>
                  <span className="text-slate-500 line-through font-mono text-[11px]">{formatCurrency(initialDeposit)}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                    {formatCurrency(currentDeposit)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 px-3 py-2 items-center">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Ngày bắt đầu</span>
                  <span className={`font-mono text-[11px] ${form.startDate !== initialStartDate ? "text-slate-500 line-through" : "text-slate-600"}`}>
                    {initialStartDate}
                  </span>
                  <span className={`font-mono text-[11px] ${form.startDate !== initialStartDate ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-semibold text-slate-800 dark:text-white"}`}>
                    {form.startDate}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 px-3 py-2 items-center">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Ngày kết thúc</span>
                  <span className={`font-mono text-[11px] ${form.endDate !== initialEndDate ? "text-slate-500 line-through" : "text-slate-600"}`}>
                    {initialEndDate}
                  </span>
                  <span className={`font-mono text-[11px] ${form.endDate !== initialEndDate ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-semibold text-slate-800 dark:text-white"}`}>
                    {form.endDate}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 px-3 py-2 items-center">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Chu kỳ thanh toán</span>
                  <span className="text-slate-600 text-[11px]">Hàng tháng</span>
                  <span className="font-semibold text-slate-800 dark:text-white text-[11px]">{form.paymentCycle}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 px-3 py-2 items-center">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Ngày thanh toán</span>
                  <span className="text-slate-600 text-[11px]">Mùng 1</span>
                  <span className="font-semibold text-slate-800 dark:text-white text-[11px]">{form.paymentDay}</span>
                </div>
              </div>
            </div>

            {/* Warning Alert if financial or date changes */}
            {hasFinancialChanges && (
              <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-amber-800 dark:text-amber-200">
                    Có thay đổi về giá thuê hoặc thời gian hợp đồng
                  </span>
                  <span className="text-amber-700/90 dark:text-amber-300 text-[11px]">
                    Vui lòng kiểm tra kỹ thông tin trước khi lưu. Các thay đổi sẽ được áp dụng từ ngày hiệu lực.
                  </span>
                </div>
              </div>
            )}

            {/* Informational Notes */}
            <div className="flex gap-2.5 rounded-xl border border-purple-200/60 dark:border-purple-800/30 bg-purple-50/40 dark:bg-purple-950/15 p-3 text-xs">
              <Info size={15} className="text-purple-600 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                <strong className="text-purple-700 dark:text-purple-300 font-bold">Lưu ý</strong>
                <ul className="list-disc pl-3.5 space-y-0.5">
                  <li>Việc chỉnh sửa sẽ tạo bản ghi lịch sử thay đổi.</li>
                  <li>Thông tin hợp đồng sẽ được cập nhật ngay sau khi lưu.</li>
                  <li>Nếu thay đổi giá thuê, hệ thống sẽ tự động cập nhật hóa đơn kỳ tiếp theo.</li>
                  <li>Vui lòng đảm bảo các thông tin và hồ sơ là chính xác.</li>
                </ul>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs font-bold text-rose-600">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
