"use client";

import React from "react";
import {
  Building2,
  Calendar,
  Check,
  Clock,
  CreditCard,
  DoorClosed,
  FileText,
  Phone,
  QrCode,
  User,
} from "lucide-react";
import BrandLogo, { HLEmblem } from "@/components/ui/BrandLogo";

export interface InvoiceLineItem {
  stt?: number;
  name: string;
  amount: number;
}

export interface PrintableInvoiceSheetProps {
  invoiceCode?: string;
  periodLabel?: string;
  creationDateStr?: string;
  dueDateStr?: string;
  isPaid?: boolean;
  customerName?: string;
  customerPhone?: string;
  roomName?: string;
  buildingName?: string;
  contractCode?: string;
  paymentMethod?: string;
  totalAmount?: number;
  items?: InvoiceLineItem[];
  qrImageUrl?: string;
  title?: string;
  subtitle?: string;
  codeLabel?: string;
  infoTitle?: string;
  customerLabel?: string;
  statusLabel?: string;
}

const formatVnd = (val: number | string) =>
  `${Number(val || 0).toLocaleString("vi-VN")} đ`;

export default function PrintableInvoiceSheet({
  invoiceCode = "HD-P24-05-4467",
  periodLabel = "Tháng 10/2026",
  creationDateStr = "10/10/2026 10:43",
  dueDateStr = "10/10/2026",
  isPaid = true,
  customerName = "UAT LK08 P24-05 290926",
  customerPhone = "0900240529",
  roomName = "P24-05",
  buildingName = "LK08-24",
  contractCode = "HD-P24-05-4467",
  paymentMethod = "Chuyển khoản / Tiền mặt",
  totalAmount = 4100000,
  items,
  qrImageUrl,
  title = "HÓA ĐƠN THANH TOÁN",
  subtitle = "Dịch vụ quản lý và vận hành tòa nhà",
  codeLabel = "MÃ HÓA ĐƠN",
  infoTitle = "THÔNG TIN KHÁCH THUÊ",
  customerLabel = "Khách thuê",
  statusLabel = "Đã thanh toán",
}: PrintableInvoiceSheetProps) {
  // Fallback default sample items if none provided
  const displayItems =
    Array.isArray(items) && items.length > 0
      ? items
      : [
          {
            stt: 1,
            name: `Tiền thuê phòng ${roomName} - Kỳ ${periodLabel} (Thu trước)`,
            amount: totalAmount > 100000 ? totalAmount - 100000 : totalAmount,
          },
          {
            stt: 2,
            name: "Tiền nước sinh hoạt (1 người) - Sử dụng tháng 2026-09 (Thu sau)",
            amount: totalAmount > 100000 ? 100000 : 0,
          },
        ];

  const sigSpacerClass = displayItems.length > 2 ? "h-9 sm:h-10" : "h-14 sm:h-14";

  return (
    <div
      id="homeland-printable-invoice"
      className="w-full max-w-[820px] mx-auto bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200/90 relative flex flex-col justify-between min-h-[1050px] select-none print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-full print:h-full print:min-h-full print:max-h-full print:rounded-none"
    >
      {/* UPPER SECTION: Brand, Meta, Info, Celebration, Items, Confirmation */}
      <div className="space-y-2.5 shrink-0">
        {/* 1. BRAND HEADER */}
        <div className="flex items-center justify-between pb-0.5">
          {/* Project Homeland Logo according to brand specifications */}
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-homeland.png"
              alt="Homeland Logo"
              className="h-9 w-9 sm:h-10 sm:w-10 object-contain shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
                const next = (e.target as HTMLElement).nextElementSibling;
                if (next) (next as HTMLElement).style.display = "block";
              }}
            />
            <div className="hidden" style={{ display: "none" }}>
              <HLEmblem className="h-9 w-9" />
            </div>
            <div className="flex flex-col select-none leading-none">
              <div className="font-black tracking-tight text-xl sm:text-2xl text-slate-900 flex items-baseline">
                <span>HOME</span>
                <span className="text-emerald-600 ml-1">LAND</span>
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 mt-0.5">
                PREMIUM CRM
              </div>
            </div>
          </div>

          {/* Taglines Right */}
          <div className="text-right space-y-0.5">
            <div className="text-xs sm:text-[13px] font-medium text-slate-500">
              Quản lý tòa nhà thông minh
            </div>
            <div className="text-xs sm:text-[13px] font-medium text-slate-500">
              Nâng tầm trải nghiệm sống
            </div>
          </div>
        </div>

        {/* Subtle Divider */}
        <div className="w-full h-[1px] bg-slate-200/80" />

        {/* 2. TITLE & CODE ROW */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
              {subtitle}
            </p>
          </div>

          {/* Code Box */}
          <div className="rounded-xl border border-indigo-100 bg-[#f5f3ff] px-4 py-2 text-center shrink-0">
            <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {codeLabel}
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-[#4338ca] tracking-tight">
              {invoiceCode}
            </div>
          </div>
        </div>

        {/* 3. 4-ITEM META PILL ROW */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 items-center">
          {/* Meta 1 */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">Kỳ hóa đơn</div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1">{periodLabel}</div>
            </div>
          </div>

          {/* Meta 2 */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">Ngày lập</div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1">{creationDateStr}</div>
            </div>
          </div>

          {/* Meta 3 */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">Hạn thanh toán</div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1">{dueDateStr}</div>
            </div>
          </div>

          {/* Meta 4: Status badge */}
          <div className="flex items-center justify-start sm:justify-end">
            <div className="rounded-xl border border-emerald-200/90 bg-[#ecfdf5] px-3 py-1.5 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
              <div>
                <div className="text-[9.5px] font-semibold text-emerald-700/80 leading-none">
                  Trạng thái
                </div>
                <div className="text-xs sm:text-[13px] font-black text-emerald-800 leading-tight mt-0.5">
                  {isPaid ? statusLabel : "Chờ thanh toán"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. INFORMATION CARD */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 space-y-2">
          <div className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-[#4338ca]">
            {infoTitle}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-4 text-xs">
            {/* Col 1 */}
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <User className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">{customerLabel}</div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm break-words mt-1">
                    {customerName}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">SĐT</div>
                  <div className="font-bold font-mono text-slate-900 text-xs sm:text-sm mt-1">
                    {customerPhone}
                  </div>
                </div>
              </div>
            </div>

            {/* Col 2 */}
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <DoorClosed className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">Phòng</div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm mt-1">
                    {roomName}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Building2 className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">Tòa nhà</div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm mt-1">
                    {buildingName}
                  </div>
                </div>
              </div>
            </div>

            {/* Col 3 */}
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <FileText className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">Hợp đồng</div>
                  <div className="font-bold font-mono text-slate-900 text-xs sm:text-sm mt-1 truncate max-w-[170px]" title={contractCode}>
                    {contractCode}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CreditCard className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">Hình thức thanh toán</div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm mt-1">
                    {paymentMethod}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. SUCCESS CELEBRATION BANNER (MOVED HIGH UP) */}
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-[#f0fdf4] to-[#ecfdf5]/60 py-6 sm:py-6.5 px-6 text-center shadow-xs">
          <div className="relative inline-flex items-center justify-center mb-1.5">
            <div className="flex h-16 w-16 sm:h-[68px] sm:w-[68px] items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/25 ring-4 sm:ring-6 ring-emerald-100">
              <Check className="h-8 w-8 sm:h-9 sm:w-9 stroke-[3.5]" />
            </div>
          </div>

          <div className="text-base sm:text-lg font-black uppercase tracking-wider text-emerald-800 mt-1 mb-0.5">
            ĐÃ THANH TOÁN THÀNH CÔNG
          </div>

          <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-600 tracking-tight my-1.5 sm:my-2">
            {formatVnd(totalAmount)}
          </div>

          <div className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
            Hóa đơn đã được đối soát và ghi nhận vào sổ cái thu tiền.
          </div>
        </div>

        {/* 6. EXPENSE / REVENUE ITEMS TABLE */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-black">
              <tr>
                <th className="py-1.5 px-3 w-12 text-center text-xs sm:text-[13px]">STT</th>
                <th className="py-1.5 px-3 text-xs sm:text-[13px]">Nội dung khoản thu</th>
                <th className="py-1.5 px-3 w-36 sm:w-44 text-right text-xs sm:text-[13px]">Số tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {displayItems.map((it: InvoiceLineItem, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-1.5 px-3 text-center text-slate-400 font-mono text-xs sm:text-sm">
                    {it.stt || idx + 1}
                  </td>
                  <td className="py-1.5 px-3 font-semibold text-slate-800 text-xs sm:text-sm">
                    {it.name}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-xs sm:text-sm">
                    {formatVnd(it.amount)}
                  </td>
                </tr>
              ))}

              {/* TOTAL ROW */}
              <tr className="bg-[#f5f3ff]/50 font-black border-t border-slate-200">
                <td colSpan={2} className="py-2 px-3 text-sm sm:text-base text-[#4338ca]">
                  Tổng cộng
                </td>
                <td className="py-2 px-3 text-right font-mono text-base sm:text-lg font-black text-[#4338ca] whitespace-nowrap">
                  {formatVnd(totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 7. CONFIRMATION STRIP */}
        <div className="rounded-xl border border-emerald-200 bg-[#f0fdf4] px-4 py-2 flex items-center gap-2.5 text-xs sm:text-[13px] text-emerald-800 font-medium">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
            <Check className="h-3 w-3 stroke-[3]" />
          </div>
          <div>
            <b>Đã thu đủ {formatVnd(totalAmount)}.</b> Hóa đơn đã được đối soát và ghi nhận thành công vào sổ cái thu tiền.
          </div>
        </div>
      </div>

      {/* ZONE 3: BOTTOM (Notes & QR, Signatures, Document Footer) */}
      <div className="space-y-2 shrink-0">
        {/* 8. 2 BOTTOM CARDS: GHI CHÚ & THÔNG TIN THANH TOÁN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Card 1: GHI CHÚ */}
          <div className="rounded-xl border border-slate-200/80 p-2.5 bg-white space-y-1">
            <div className="flex items-center gap-2 text-xs sm:text-[13px] font-black uppercase tracking-wider text-[#4338ca]">
              <FileText className="h-4 w-4" />
              <span>GHI CHÚ</span>
            </div>
            <ul className="text-[11px] sm:text-xs text-slate-600 space-y-0.5 list-disc list-inside leading-relaxed">
              <li>Hóa đơn này được lập tự động từ hệ thống Homeland Premium CRM.</li>
              <li>Vui lòng liên hệ Ban quản lý nếu có thắc mắc về nội dung hóa đơn.</li>
            </ul>
          </div>

          {/* Card 2: THÔNG TIN THANH TOÁN + QR */}
          <div className="rounded-xl border border-slate-200/80 p-2.5 bg-white flex items-center justify-between gap-2.5">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 text-xs sm:text-[13px] font-black uppercase tracking-wider text-[#4338ca]">
                <QrCode className="h-4 w-4" />
                <span>THÔNG TIN THANH TOÁN</span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
                Quét mã QR để xem chi tiết giao dịch và đối soát thanh toán.
              </p>
            </div>

            {/* QR Code Box */}
            <div className="h-14 w-14 sm:h-[60px] sm:w-[60px] shrink-0 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shadow-2xs overflow-hidden">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="QR thanh toán"
                  className="h-full w-full object-contain"
                />
              ) : (
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  <rect width="100" height="100" fill="#ffffff" />
                  <rect x="5" y="5" width="28" height="28" fill="#1e1b4b" rx="2" />
                  <rect x="9" y="9" width="20" height="20" fill="#ffffff" rx="1.5" />
                  <rect x="13" y="13" width="12" height="12" fill="#1e1b4b" rx="1" />
                  <rect x="67" y="5" width="28" height="28" fill="#1e1b4b" rx="2" />
                  <rect x="71" y="9" width="20" height="20" fill="#ffffff" rx="1.5" />
                  <rect x="75" y="13" width="12" height="12" fill="#1e1b4b" rx="1" />
                  <rect x="5" y="67" width="28" height="28" fill="#1e1b4b" rx="2" />
                  <rect x="9" y="71" width="20" height="20" fill="#ffffff" rx="1.5" />
                  <rect x="13" y="75" width="12" height="12" fill="#1e1b4b" rx="1" />
                  <rect x="38" y="10" width="6" height="6" fill="#1e1b4b" />
                  <rect x="48" y="10" width="6" height="6" fill="#1e1b4b" />
                  <rect x="56" y="16" width="6" height="6" fill="#1e1b4b" />
                  <rect x="38" y="24" width="6" height="6" fill="#1e1b4b" />
                  <rect x="48" y="24" width="6" height="6" fill="#1e1b4b" />
                  <rect x="10" y="38" width="6" height="6" fill="#1e1b4b" />
                  <rect x="18" y="46" width="6" height="6" fill="#1e1b4b" />
                  <rect x="26" y="38" width="6" height="6" fill="#1e1b4b" />
                  <rect x="38" y="38" width="8" height="8" fill="#4338ca" rx="1" />
                  <rect x="52" y="38" width="8" height="8" fill="#1e1b4b" />
                  <rect x="66" y="38" width="6" height="6" fill="#1e1b4b" />
                  <rect x="78" y="46" width="6" height="6" fill="#1e1b4b" />
                  <rect x="86" y="38" width="6" height="6" fill="#1e1b4b" />
                  <rect x="38" y="52" width="6" height="6" fill="#1e1b4b" />
                  <rect x="48" y="52" width="8" height="8" fill="#4338ca" rx="1" />
                  <rect x="62" y="52" width="6" height="6" fill="#1e1b4b" />
                  <rect x="76" y="58" width="6" height="6" fill="#1e1b4b" />
                  <rect x="86" y="52" width="6" height="6" fill="#1e1b4b" />
                  <rect x="38" y="66" width="6" height="6" fill="#1e1b4b" />
                  <rect x="48" y="74" width="6" height="6" fill="#1e1b4b" />
                  <rect x="58" y="66" width="6" height="6" fill="#1e1b4b" />
                  <rect x="70" y="72" width="6" height="6" fill="#1e1b4b" />
                  <rect x="82" y="68" width="6" height="6" fill="#1e1b4b" />
                  <rect x="42" y="86" width="6" height="6" fill="#1e1b4b" />
                  <rect x="54" y="84" width="8" height="8" fill="#1e1b4b" />
                  <rect x="68" y="86" width="6" height="6" fill="#1e1b4b" />
                  <rect x="82" y="84" width="6" height="6" fill="#1e1b4b" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* 9. SIGNATURES (3 PARTIES) */}
        <div className="pt-2 pb-0.5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-800">Người lập phiếu</div>
              <div className="text-[10px] sm:text-[11px] italic text-slate-400 mt-0.5">(Ký, ghi rõ họ tên)</div>
              <div className={sigSpacerClass} />
              <div className="border-b border-slate-300 w-3/4 mx-auto" />
              <div className="text-xs font-semibold text-slate-700 mt-1 min-h-[16px]" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-800">Khách hàng</div>
              <div className="text-[10px] sm:text-[11px] italic text-slate-400 mt-0.5">(Ký, ghi rõ họ tên)</div>
              <div className={sigSpacerClass} />
              <div className="border-b border-slate-300 w-3/4 mx-auto" />
              <div className="text-xs font-bold text-slate-800 mt-1 min-h-[16px] truncate px-1" title={customerName}>
                {customerName}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-800">Kế toán / Xác nhận</div>
              <div className="text-[10px] sm:text-[11px] italic text-slate-400 mt-0.5">(Ký, ghi rõ họ tên)</div>
              <div className={sigSpacerClass} />
              <div className="border-b border-slate-300 w-3/4 mx-auto" />
              <div className="text-xs font-semibold text-slate-700 mt-1 min-h-[16px]" />
            </div>
          </div>
        </div>

        {/* 10. DOCUMENT FOOTER */}
        <div className="pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
          <div>
            In từ Homeland Premium CRM • Ngày in: {creationDateStr}
          </div>
          <div className="font-mono font-semibold">
            1 / 1
          </div>
        </div>
      </div>
    </div>
  );
}
