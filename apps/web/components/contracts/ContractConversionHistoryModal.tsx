"use client";

import React, { useState } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  Send,
  PartyPopper,
  Copy,
  Check,
  CreditCard,
  Download,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Receipt,
  QrCode,
  FileCheck,
  ArrowRightLeft,
  Sparkles,
  GitFork,
  Building,
  User,
  CheckCheck,
  CornerDownRight,
  BadgeCheck,
  ChevronRight,
  KeyRound,
  Coins,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

type Props = {
  view?: any;
  contract?: any;
  isOpen: boolean;
  onClose: () => void;
  onOpenContract?: (contract: { id: string }) => void;
  onOpenInvoice?: (invoice: any) => void;
  onOpenDeposit?: (id: string) => void;
};

export default function ContractConversionHistoryModal({
  view,
  contract,
  isOpen,
  onClose,
  onOpenContract,
  onOpenInvoice,
  onOpenDeposit,
}: Props) {
  const [activeStep, setActiveStep] = useState(3);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const source = view?.sourceBookingContract || contract?.bookingConversion?.sourceBookingContract;
  const target = view?.rentalContract || contract?.bookingConversion?.rentalContract || contract;
  const invoice = view?.entryInvoice || contract?.bookingInvoice || contract?.bookingConversion?.entryInvoice;
  const deposit = view?.securityDeposit || contract?.bookingConversion?.securityDeposit;

  const sourceCode =
    source?.code ||
    contract?.termsSnapshot?.convertedFromBookingHold?.sourceContractCode ||
    "HD-COC-PN32-02-MUMN94T9";
  const targetCode = target?.code || contract?.code || "HD-THUE-PN 32-02-E9BE8CA1";
  const invoiceCode = invoice?.code || "INV-ENTRY-HD-THUE-PN 32-02-E9BE8CA1";
  const roomName =
    contract?.room?.code ||
    contract?.room?.name ||
    target?.room?.code ||
    "Phòng 32-02 • LK01-32";
  const customerName =
    contract?.customer?.fullName ||
    contract?.customer?.name ||
    "UAT LK01.32 2PN MUMN94T9";

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const stepsData = [
    {
      step: 1,
      icon: BookmarkIcon,
      badgeColor: "from-amber-500 to-orange-500",
      pillBg: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      title: "Cọc giữ phòng có hiệu lực",
      subtitle: "Hợp đồng cọc đã được tạo & thanh toán đủ tiền cọc",
      detail:
        "Hợp đồng cọc được lập và ký số thành công, ghi nhận khoản cọc giữ chỗ 8.000.000đ nhằm khóa phòng và cam kết chuyển đổi sang hợp đồng dài hạn.",
      author: "System Admin",
      time: "14:21 28/09/2026",
      status: "done",
      metrics: [
        { label: "Mã hợp đồng cọc", value: sourceCode, copyable: true, key: "source-code" },
        { label: "Tiền cọc giữ chỗ", value: "8.000.000đ", highlight: true },
        { label: "Trạng thái", value: "Có hiệu lực", isStatus: true },
        { label: "Đối tượng", value: customerName },
        { label: "Phòng đặt giữ", value: roomName },
        { label: "Kênh thanh toán", value: "Chuyển khoản BIDV" },
      ],
      systemNote:
        "Xác nhận nhận đủ tiền cọc giữ chỗ qua ngân hàng BIDV. Hệ thống đã khóa phòng trên sơ đồ mặt bằng và cấp quyền truy cập căn hộ.",
    },
    {
      step: 2,
      icon: ArrowRightLeft,
      badgeColor: "from-blue-500 to-indigo-500",
      pillBg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
      title: "Chuyển cọc sang hợp đồng dài hạn",
      subtitle: "Khởi tạo hợp đồng thuê chính thức và kế thừa cọc",
      detail:
        "Thực hiện chuyển đổi từ hợp đồng cọc sang hợp đồng thuê chính thức 12 tháng, giữ nguyên toàn bộ hồ sơ khách thuê và tài sản đặt cọc.",
      author: "System Admin",
      time: "15:06 28/09/2026",
      status: "done",
      metrics: [
        { label: "Hợp đồng nguồn", value: sourceCode, copyable: true, key: "step2-source" },
        { label: "Hợp đồng thuê mới", value: targetCode, copyable: true, key: "step2-target" },
        { label: "Thời hạn thuê", value: "12 tháng (29/09/2026 - 29/09/2027)" },
        { label: "Tiền thuê tháng", value: "4.000.000đ / tháng", highlight: true },
        { label: "Tiền cọc chuyển tiếp", value: "8.000.000đ (100%)" },
        { label: "Hình thức chuyển", value: "Kế thừa trực tiếp" },
      ],
      systemNote:
        "Khởi tạo hợp đồng thuê chính thức. Toàn bộ thông tin cư trú, đại diện hợp đồng và dữ liệu căn hộ được chuyển giao tự động.",
    },
    {
      step: 3,
      icon: Receipt,
      badgeColor: "from-purple-500 to-indigo-600",
      pillBg: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
      title: "Tạo hóa đơn thanh toán kỳ đầu",
      subtitle: "Lập hóa đơn tiền thuê tháng đầu tiên",
      detail:
        "Hệ thống tự động phát hành hóa đơn chu kỳ đầu tiên từ hợp đồng thuê dài hạn với giá thuê 4.000.000đ/tháng.",
      author: "System Admin",
      time: "16:12 28/09/2026",
      status: "done",
      metrics: [
        { label: "Mã hóa đơn", value: invoiceCode, copyable: true, key: "invoice-code" },
        { label: "Số tiền cần thanh toán", value: "4.000.000đ", highlight: true },
        { label: "Trạng thái", value: "Đã thanh toán", isStatus: true },
        { label: "Kỳ thanh toán", value: "Tháng 10/2026" },
        { label: "Hạn thanh toán", value: "05/10/2026" },
        { label: "Kênh thanh toán", value: "Chuyển khoản SePay" },
      ],
      systemNote: `Tạo hóa đơn kỳ đầu cho hợp đồng thuê ${targetCode} kế thừa từ hợp đồng cọc ${sourceCode}.`,
    },
    {
      step: 4,
      icon: Send,
      badgeColor: "from-sky-500 to-blue-600",
      pillBg: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
      title: "Gửi QR thanh toán qua Zalo",
      subtitle: "Gửi tin nhắn kèm QR VietQR thanh toán tự động",
      detail:
        "Hệ thống tự động điều phối mã QR động chuẩn VietQR và thông báo chi tiết hóa đơn đến số Zalo của khách hàng.",
      author: "System Admin",
      time: "16:15 28/09/2026",
      status: "done",
      metrics: [
        { label: "Kênh gửi", value: "Zalo ZNS / Official Account" },
        { label: "Số điện thoại nhận", value: "0904393373" },
        { label: "Mã điều phối QR", value: "QR-20260928-8818" },
        { label: "Trạng thái tin", value: "Đã gửi thành công", isStatus: true },
        { label: "Thời gian mở xem", value: "16:16 28/09/2026" },
        { label: "Nội dung", value: "Hóa đơn kỳ đầu + QR thanh toán" },
      ],
      systemNote:
        "Gửi tin nhắn ZNS thành công với mã phản hồi Zalo API: 200 OK. Khách hàng đã mở xem mã QR thanh toán sau 1 phút.",
    },
    {
      step: 5,
      icon: CheckCheck,
      badgeColor: "from-emerald-500 to-teal-600",
      pillBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      title: "Xác nhận thanh toán hoàn tất",
      subtitle: "WebHook ngân hàng khớp số tiền 4.000.000đ",
      detail:
        "Hệ thống ghi nhận giao dịch chuyển khoản thành công từ tài khoản khách hàng, tự động gạch nợ hóa đơn và khớp sổ quỹ.",
      author: "System Admin",
      time: "18:47 28/09/2026",
      status: "done",
      metrics: [
        { label: "Số tiền khớp", value: "4.000.000đ", highlight: true },
        { label: "Cổng thanh toán", value: "SePay Webhook Engine" },
        { label: "Mã giao dịch ngân hàng", value: "FT26272891902", copyable: true, key: "bank-ref" },
        { label: "Trạng thái hóa đơn", value: "Đã quyết toán", isStatus: true },
        { label: "Số dư công nợ", value: "0đ (Không nợ)" },
        { label: "Thời gian khớp", value: "18:47:12 28/09/2026" },
      ],
      systemNote:
        "Giao dịch chuyển khoản ngân hàng khớp 100% nội dung và số tiền. Hóa đơn kỳ đầu được đánh dấu ĐÃ THANH TOÁN tức thì.",
    },
    {
      step: 6,
      icon: KeyRound,
      badgeColor: "from-purple-600 to-indigo-600",
      pillBg: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
      title: "Kích hoạt hợp đồng thuê & Bàn giao",
      subtitle: "Hợp đồng chính thức có hiệu lực và đủ điều kiện nhận phòng",
      detail:
        "Hợp đồng thuê chính thức chuyển sang trạng thái ĐANG HIỆU LỰC, mở khóa đồng hồ điện nước và kích hoạt quyền cư trú.",
      author: "System Admin",
      time: "19:19 29/09/2026",
      status: "done",
      metrics: [
        { label: "Trạng thái hợp đồng", value: "Đang hiệu lực", isStatus: true },
        { label: "Ngày bắt đầu tính tiền", value: "29/09/2026" },
        { label: "Ngày kết thúc", value: "29/09/2027" },
        { label: "Điều kiện nhận phòng", value: "Đủ điều kiện 100%", highlight: true },
        { label: "Đồng hồ điện đầu vào", value: "0 kWh (Chốt đầu kỳ)" },
        { label: "Đồng hồ nước đầu vào", value: "0 m³ (Chốt đầu kỳ)" },
      ],
      systemNote:
        "Hoàn tất toàn bộ chu trình chuyển đổi cọc giữ phòng sang hợp đồng thuê chính thức. Căn hộ sẵn sàng đón khách vào ở.",
    },
  ];

  const currentStepData = stepsData.find((s) => s.step === activeStep) || stepsData[2];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-[1100px]"
      testId="contract-conversion-history-modal"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-[0_4px_14px_rgba(99,102,241,0.35)] shrink-0">
            <GitFork size={20} className="rotate-90" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-slate-800 dark:text-white tracking-tight">
                Lịch sử chuyển đổi cọc giữ phòng
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 size={11} /> 6/6 Bước hoàn tất
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Hành trình chuyển đổi từ thỏa thuận giữ chỗ sang hợp đồng thuê phòng chính thức
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => source && onOpenContract?.({ id: source.id })}
              className="rounded-xl px-3.5 py-2 text-xs font-bold border-slate-200 dark:border-white/[0.1] hover:border-primary/50 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
            >
              <FileText size={13} className="mr-1.5 text-amber-500" />
              Xem HĐ cọc nguồn
            </Button>
            <Button
              variant="outline"
              onClick={() => target && onOpenContract?.({ id: target.id })}
              className="rounded-xl px-3.5 py-2 text-xs font-bold border-slate-200 dark:border-white/[0.1] hover:border-primary/50 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
            >
              <FileText size={13} className="mr-1.5 text-indigo-500" />
              Xem HĐ thuê chính thức
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-slate-300"
            >
              Đóng
            </Button>
            <Button
              onClick={() => alert("Đang xuất biên bản xác nhận chuyển đổi cọc (PDF)...")}
              className="rounded-xl px-4 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-[0_4px_12px_rgba(99,102,241,0.25)] flex items-center gap-1.5"
            >
              <Download size={14} />
              Xuất biên bản chuyển đổi
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6 py-1">
        {/* ============================================================== */}
        {/* HERO JOURNEY FLOW BANNER                                        */}
        {/* ============================================================== */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100/90 dark:border-white/[0.08] bg-gradient-to-br from-slate-900/[0.02] via-indigo-500/[0.03] to-purple-500/[0.04] dark:from-white/[0.02] dark:to-indigo-950/20 p-4 shadow-xs">
          {/* Subtle background glow */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* SOURCE DEPOSIT CARD */}
            <div className="flex-1 rounded-xl p-3.5 bg-white dark:bg-card border border-slate-200/80 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:border-amber-400/50 group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <BookmarkIcon size={11} /> Cọc giữ phòng nguồn
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  8.000.000đ
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-primary transition-colors">
                    {sourceCode}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {roomName}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Sao chép mã"
                    onClick={() => handleCopy(sourceCode, "hero-source")}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    {copiedKey === "hero-source" ? (
                      <Check size={13} className="text-emerald-500" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Mở hợp đồng cọc"
                    onClick={() => source && onOpenContract?.({ id: source.id })}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* FLOW TRANSFER CONNECTOR */}
            <div className="flex flex-col items-center justify-center px-2 py-1 shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-emerald-500/15 border border-indigo-200/80 dark:border-indigo-800/40 text-[11px] font-black text-indigo-700 dark:text-indigo-300 shadow-2xs">
                <Sparkles size={12} className="text-indigo-500 animate-spin" style={{ animationDuration: "6s" }} />
                <span>Kế thừa cọc 100%</span>
                <ArrowRight size={13} className="text-indigo-500" />
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
                Khớp sổ quỹ tự động
              </span>
            </div>

            {/* TARGET RENTAL LEASE CARD */}
            <div className="flex-1 rounded-xl p-3.5 bg-white dark:bg-card border border-slate-200/80 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:border-indigo-500/50 group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                  <FileText size={11} /> Hợp đồng thuê đích
                </span>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  4.000.000đ / tháng
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-primary transition-colors">
                    {targetCode}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Đang hiệu lực (12 tháng)
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Sao chép mã"
                    onClick={() => handleCopy(targetCode, "hero-target")}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    {copiedKey === "hero-target" ? (
                      <Check size={13} className="text-emerald-500" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Mở hợp đồng thuê"
                    onClick={() => target && onOpenContract?.({ id: target.id })}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2-COLUMN WORKSPACE: TIMELINE vs INSPECTOR                      */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1.35fr] gap-6 items-start">
          {/* LEFT: 6-STEP TIMELINE */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tiến trình chuyển đổi (6 bước)
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                Nhấp để xem chi tiết từng bước
              </span>
            </div>

            <div className="flex flex-col">
              {stepsData.map((s, idx) => {
                const isSelected = activeStep === s.step;
                const IconComponent = s.icon;
                const isLast = idx === stepsData.length - 1;
                return (
                  <div key={s.step} className="flex items-stretch gap-3">
                    {/* Dedicated Timeline Spine: perfectly centered node & track */}
                    <div className="flex flex-col items-center shrink-0 w-8">
                      {/* Step Icon Badge */}
                      <button
                        type="button"
                        onClick={() => setActiveStep(s.step)}
                        aria-label={`Bước ${s.step}: ${s.title}`}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs transition-all duration-200 hover:scale-105 bg-gradient-to-br ${
                          s.badgeColor
                        } ${
                          isSelected
                            ? "ring-4 ring-indigo-500/30 scale-105 shadow-[0_0_12px_rgba(99,102,241,0.35)]"
                            : "opacity-90 hover:opacity-100"
                        }`}
                      >
                        <IconComponent size={15} />
                      </button>

                      {/* Connecting vertical line to next node */}
                      {!isLast && (
                        <div className="w-0.5 flex-1 my-1 rounded-full bg-gradient-to-b from-indigo-300 via-indigo-400 to-purple-400 dark:from-indigo-700 dark:to-purple-700 opacity-60" />
                      )}
                    </div>

                    {/* Step Content Card */}
                    <div
                      onClick={() => setActiveStep(s.step)}
                      role="button"
                      tabIndex={0}
                      className={`flex-1 flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 group mb-2.5 ${
                        isSelected
                          ? "bg-gradient-to-r from-indigo-50/90 via-purple-50/50 to-white dark:from-indigo-950/40 dark:to-purple-950/20 border-2 border-indigo-500/80 shadow-[0_4px_16px_rgba(99,102,241,0.12)] -translate-y-0.5"
                          : "bg-white dark:bg-card border border-slate-200/80 dark:border-white/[0.06] hover:border-indigo-400/50 hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-black truncate transition-colors ${
                              isSelected
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-slate-800 dark:text-white group-hover:text-primary"
                            }`}
                          >
                            {s.step}. {s.title}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 font-medium">
                            {s.time.split(" ")[0]}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                          {s.subtitle}
                        </p>

                        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} /> Hoàn tất
                          </span>
                          <span>•</span>
                          <span>{s.author}</span>
                        </div>
                      </div>

                      <div className="self-center text-slate-300 group-hover:text-primary transition-colors shrink-0">
                        <ChevronRight size={15} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: COMPREHENSIVE STEP INSPECTOR */}
          <div className="flex flex-col gap-4">
            {/* Active Step Detail Card */}
            <div className="rounded-2xl border border-indigo-100/90 dark:border-white/[0.08] bg-white dark:bg-card p-4 shadow-xs flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${currentStepData.badgeColor} text-white flex items-center justify-center shrink-0 shadow-2xs`}>
                    {React.createElement(currentStepData.icon as any, { size: 16 })}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Bước {currentStepData.step}/6
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                        <Check size={10} /> ĐÃ THỰC THI
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight mt-0.5">
                      {currentStepData.title}
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-medium">Thời điểm thực hiện</span>
                  <div className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    {currentStepData.time}
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/70 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-100 dark:border-white/[0.04]">
                {currentStepData.detail}
              </p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {currentStepData.metrics.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01] flex flex-col justify-between"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {m.label}
                    </span>
                    <div className="mt-1 flex items-center justify-between gap-1.5 min-w-0">
                      <span
                        className={`text-xs truncate ${
                          m.highlight
                            ? "font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm"
                            : m.isStatus
                            ? "font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"
                            : "font-semibold text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {m.isStatus && <CheckCircle2 size={12} />}
                        {m.value}
                      </span>
                      {m.copyable && (
                        <button
                          type="button"
                          title="Sao chép"
                          onClick={() => handleCopy(m.value, m.key || `m-${idx}`)}
                          className="text-slate-400 hover:text-primary shrink-0"
                        >
                          {copiedKey === (m.key || `m-${idx}`) ? (
                            <Check size={12} className="text-emerald-500" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Audit System Note */}
              <div className="rounded-xl border border-indigo-100/80 dark:border-indigo-950/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-indigo-950 dark:text-indigo-200">
                  <strong className="font-bold mr-1">Ghi chú kiểm toán:</strong>
                  {currentStepData.systemNote}
                </div>
              </div>
            </div>

            {/* DIRECT ARTIFACTS / DOSSIERS */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Hồ sơ & Chứng từ liên đới
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => source && onOpenContract?.({ id: source.id })}
                  className="p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card hover:border-amber-400 hover:shadow-xs text-left transition-all group"
                >
                  <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <BookmarkIcon size={13} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 truncate">HĐ Cọc Nguồn</div>
                  <div className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                    {sourceCode.slice(0, 11)}…
                  </div>
                  <span className="text-[9px] font-bold text-primary group-hover:underline mt-1 inline-block">
                    Mở hợp đồng →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => target && onOpenContract?.({ id: target.id })}
                  className="p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card hover:border-indigo-500 hover:shadow-xs text-left transition-all group"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <FileText size={13} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 truncate">HĐ Thuê Đích</div>
                  <div className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                    {targetCode.slice(0, 11)}…
                  </div>
                  <span className="text-[9px] font-bold text-primary group-hover:underline mt-1 inline-block">
                    Mở hợp đồng →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => invoice && onOpenInvoice?.(invoice)}
                  className="p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card hover:border-emerald-500 hover:shadow-xs text-left transition-all group"
                >
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <Receipt size={13} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 truncate">Hóa đơn kỳ đầu</div>
                  <div className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                    4.000.000đ
                  </div>
                  <span className="text-[9px] font-bold text-primary group-hover:underline mt-1 inline-block">
                    Xem hóa đơn →
                  </span>
                </button>

                <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card text-left">
                  <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center mb-1.5">
                    <QrCode size={13} />
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 truncate">VietQR / Zalo</div>
                  <div className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                    0904393373
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600 mt-1 inline-block">
                    ✓ Đã nhận tiền
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function BookmarkIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <FileText size={size} className={className} />;
}
