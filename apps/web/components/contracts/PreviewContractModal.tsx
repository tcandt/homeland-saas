"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { renderAsync } from "docx-preview";
import dayjs from "dayjs";
import { Download, Printer, X, FileText } from "lucide-react";
import { numberToWordsVietnamese } from "../../lib/utils/number-to-words";
import { getAuthorizationHeader } from "../../lib/auth/auth-header";

export function PreviewContractModal({
  isOpen,
  onClose,
  contract,
}: {
  isOpen: boolean;
  onClose: () => void;
  contract: any;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("Đang khởi tạo tài liệu...");
  const [error, setError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string>("HopDong_ThuePhong.pdf");

  const LANDLORDS: Record<string, any> = {
    TINH: {
      hoTenChuNha: "NGUYỄN ĐỨC TÍNH",
      ngaySinhChuNha: "13/03/1997",
      cccdChuNha: "054097010677",
      diaChiChuNha: "LK01.31 Khu đô thị Ân Phú , phường Tân An , tỉnh Đắk Lắk",
      dienThoaiChuNha: "0373129295 - 0567867889 ( Tính )",
      chuTaiKhoan: "HKD NGUYEN DUC TINH",
      soTaiKhoan: "8818406081",
      nganHang: "BIDV",
    },
    THE: {
      hoTenChuNha: "PHAN VĂN THỂ",
      ngaySinhChuNha: "24/11/1994",
      cccdChuNha: "066094006596 , Cấp ngày: 15/10/2025 tại Cục cảnh sát",
      diaChiChuNha: "LK01.31 Khu đô thị Ân Phú , phường Tân An , tỉnh Đắk Lắk",
      dienThoaiChuNha: "0373129295 - 0567.79.2222 ( Thể )",
      chuTaiKhoan: "HKD PHAN VAN THE",
      soTaiKhoan: "8827905414",
      nganHang: "BIDV",
    },
  };

  useEffect(() => {
    if (!isOpen || !contract) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      setProgress(0);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setProgress(12);
    setProgressStatus("Đang đọc thông số hợp đồng...");
    setError(null);

    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    setCurrentBlob(null);

    // Smooth percentage progress ticker
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 94) return prev;
        let step = 3;
        if (prev < 40) step = 5;
        else if (prev < 70) step = 3;
        else if (prev < 88) step = 2;
        else step = 1;

        const next = Math.min(94, prev + step);
        if (next > 25 && next < 55) {
          setProgressStatus("Đang kết xuất văn bản & chuyển đổi PDF...");
        } else if (next >= 55 && next < 80) {
          setProgressStatus("Đang đồng bộ trang A4 và định dạng chuẩn...");
        } else if (next >= 80) {
          setProgressStatus("Sắp hoàn tất, đang chuẩn bị hiển thị...");
        }
        return next;
      });
    }, 110);

    async function loadContractDoc() {
      try {
        const landlordInfo = LANDLORDS[contract.chuNha || "TINH"] || LANDLORDS["TINH"];
        const rentAmount = Number(
          contract.monthlyRent || contract.rentPrice || contract.rentAmount || contract.tienThue || 0
        );
        const depositAmount = Number(
          contract.depositMoney || contract.deposit || contract.depositAmount || contract.tienCoc || 0
        );

        const payloadData = {
          hoTen:
            contract.hoTen ||
            contract.customer?.fullName ||
            contract.customer?.name ||
            contract.name ||
            "..........................",
          ngaySinh: contract.ngaySinh
            ? contract.ngaySinh
            : contract.customer?.birthDate
            ? dayjs(contract.customer.birthDate).format("DD/MM/YYYY")
            : contract.birthDate
            ? dayjs(contract.birthDate).format("DD/MM/YYYY")
            : "..........................",
          cccd:
            contract.cccd ||
            contract.customer?.identityNo ||
            contract.customer?.citizenId ||
            contract.citizenId ||
            "..........................",
          diaChi:
            contract.diaChi ||
            contract.customer?.address ||
            contract.address ||
            "..........................",
          dienThoai:
            contract.dienThoai ||
            contract.customer?.phone ||
            contract.customer?.phoneNumber ||
            contract.phone ||
            "..........................",
          dienThoaiNguoithan:
            contract.dienThoaiNguoithan ||
            contract.customer?.emergencyPhone ||
            contract.emergencyPhone ||
            "-",
          ngayKyHD: contract.signedAt ? dayjs(contract.signedAt).format("DD") : "...",
          thangKyHD: contract.signedAt ? dayjs(contract.signedAt).format("MM") : "...",
          namKyHD: contract.signedAt ? dayjs(contract.signedAt).format("YYYY") : "....",
          ngayKyhopdong: contract.ngayKyhopdong || (contract.signedAt ? dayjs(contract.signedAt).format("DD/MM/YYYY") : ".........................."),
          ngayThanhToanDauTien: contract.ngayThanhToanDauTien || (contract.firstPaymentDate ? dayjs(contract.firstPaymentDate).format("DD/MM/YYYY") : ".........................."),
          mucDichThue: contract.mucDichThue || contract.purpose || "Để ở",
          tienThue: rentAmount,
          tienThueChu: rentAmount ? numberToWordsVietnamese(rentAmount) : "..........................",
          tienCoc: depositAmount,
          tienCocChu: depositAmount ? numberToWordsVietnamese(depositAmount) : "..........................",
          ngayBatDau: contract.ngayBatDau || (contract.startDate ? dayjs(contract.startDate).format("DD/MM/YYYY") : ".........................."),
          ngayKetThuc: contract.ngayKetThuc || (contract.endDate ? dayjs(contract.endDate).format("DD/MM/YYYY") : ".........................."),
          maPhong: contract.maPhong || contract.room?.code || contract.room?.name || contract.roomCode || "..........................",
          soPhongNgu: contract.soPhongNgu || (contract.room as any)?.roomType || "1 phòng ngủ",
          thoiHanThue: contract.thoiHanThue || "1 năm",
          toaNha: contract.toaNha || contract.buildingName || "..........................",
          diachiToanha: contract.diachiToanha || contract.buildingAddress || "..........................",
          chuNha: contract.chuNha || "TINH",
          ...landlordInfo,
        };

        const safeCustomer = (payloadData.hoTen || "KhachHang")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .trim()
          .replace(/\s+/g, "_");
        const safeRoom = (payloadData.maPhong || "").replace(/[^a-zA-Z0-9]/g, "");

        // Request export with format=pdf for direct browser PDF viewer
        const res = await fetch("/api/export-contract?format=pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthorizationHeader() },
          body: JSON.stringify(payloadData),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Không thể tạo file hợp đồng từ server");
        }

        const blob = await res.blob();
        if (!isMounted) return;

        clearInterval(timer);
        setProgress(100);
        setProgressStatus("Hoàn tất kết xuất tài liệu!");
        setCurrentBlob(blob);

        if (blob.type.includes("pdf")) {
          setDownloadFilename(`HopDong_${safeCustomer}${safeRoom ? `_${safeRoom}` : ""}.pdf`);
          const url = URL.createObjectURL(blob);
          setPdfBlobUrl(url);
          setTimeout(() => {
            if (isMounted) setIsLoading(false);
          }, 160);
        } else {
          // Fallback to docx-preview if docx returned
          setDownloadFilename(`HopDong_${safeCustomer}${safeRoom ? `_${safeRoom}` : ""}.docx`);
          if (containerRef.current) {
            await renderAsync(blob, containerRef.current, undefined, {
              className: "docx-viewer",
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              ignoreLastRenderedPageBreak: true,
              experimental: true,
              trimXmlDeclaration: true,
              debug: false,
            });
          }
          setTimeout(() => {
            if (isMounted) setIsLoading(false);
          }, 160);
        }
      } catch (err: any) {
        clearInterval(timer);
        if (isMounted) {
          console.error(err);
          setError(err.message || "Lỗi khi tải file hợp đồng");
          setIsLoading(false);
        }
      }
    }

    loadContractDoc();

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [isOpen, contract]);

  const handleDownload = () => {
    if (!currentBlob) return;
    const url = window.URL.createObjectURL(currentBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (pdfBlobUrl) {
      const iframe = document.getElementById("contract-pdf-iframe") as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
        return;
      }
    }
    window.print();
  };

  if (!isOpen || typeof document === "undefined") return null;

  const roomCode = contract?.maPhong || contract?.room?.code || contract?.roomCode || "Phòng";
  const tenantName = contract?.hoTen || contract?.customer?.fullName || contract?.customer?.name || contract?.name || "";

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 z-[10030]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog with 1 SINGLE ULTRA-SLEEK COMPACT HEADER */}
      <div className="relative w-full max-w-[1080px] bg-card border border-border/70 rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 overflow-hidden max-h-[96vh]">
        {/* Slim Header Bar (44px height, all controls in one line) */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-card border-b border-border/50 shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileText size={15} />
            </div>
            <h3 className="font-black text-[13px] sm:text-sm text-text whitespace-nowrap">
              Hồ sơ hợp đồng
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[11px] font-black shrink-0">
              {roomCode}
            </span>
            {tenantName && (
              <span className="hidden sm:inline-flex text-xs font-bold text-muted truncate max-w-[220px]">
                • {tenantName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !!error}
              className="inline-flex items-center gap-1.5 h-7.5 px-2.5 rounded-lg border border-border/60 hover:bg-surface text-text text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
              title="In hợp đồng"
            >
              <Printer size={13} className="text-muted" />
              <span className="hidden sm:inline">In hợp đồng</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isLoading || !currentBlob}
              className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-40"
              title="Tải xuống PDF hợp đồng"
            >
              <Download size={13} />
              <span>Tải PDF</span>
            </button>
            <div className="w-[1px] h-4 bg-border/60 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="h-7.5 w-7.5 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer"
              title="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Viewer Container with Loading Progress */}
        <div className="w-full h-[84vh] relative bg-[#525659]/5 dark:bg-black/40 overflow-hidden">
          {/* Loading Overlay with Progress Percentage */}
          {isLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/92 backdrop-blur-xs p-6 text-center animate-in fade-in duration-150">
              {/* Animated Progress Ring / Counter */}
              <div className="relative flex items-center justify-center mb-3">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <span className="absolute font-black text-sm text-primary font-mono">
                  {progress}%
                </span>
              </div>

              <h4 className="font-black text-[15px] text-text">
                Đang chuẩn bị hợp đồng PDF ({progress}%)
              </h4>
              <p className="text-xs text-muted max-w-xs mt-1 leading-relaxed font-medium">
                {progressStatus}
              </p>

              {/* Progress bar line */}
              <div className="w-64 max-w-full h-1.5 bg-border/50 rounded-full overflow-hidden mt-3.5 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-primary via-violet-500 to-primary transition-all duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card p-6 text-center">
              <span className="text-sm font-bold text-rose-500 mb-2">{error}</span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-surface hover:bg-surface/80 text-text cursor-pointer"
              >
                Đóng
              </button>
            </div>
          )}

          {/* PDF iframe or docx viewer */}
          {pdfBlobUrl ? (
            <iframe
              id="contract-pdf-iframe"
              src={pdfBlobUrl}
              title="Hợp đồng PDF"
              className="w-full h-full border-none"
            />
          ) : (
            <div ref={containerRef} className="w-full h-full overflow-auto p-4 flex justify-center" />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
