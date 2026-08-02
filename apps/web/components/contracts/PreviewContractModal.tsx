"use client";

import React, { useEffect, useRef, useState } from "react";
import { Modal } from "../ui/Modal";
import { renderAsync } from "docx-preview";
import dayjs from "dayjs";
import { Loader2 } from "lucide-react";
import { numberToWordsVietnamese } from "../../lib/utils/number-to-words";

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
  const [error, setError] = useState<string | null>(null);

  const LANDLORDS: Record<string, any> = {
    TINH: {
      hoTenChuNha: "NGUYỄN ĐỨC TÍNH",
      ngaySinhChuNha: "13/03/1997",
      cccdChuNha: "054097010677",
      diaChiChuNha: "LK01.31 Khu đô thị \u00c2n Phú , phường Tân An , tỉnh Đắk Lắk",
      dienThoaiChuNha: "0373129295 - 0567867889 ( Tính )",
      chuTaiKhoan: "HKD NGUYEN DUC TINH",
      soTaiKhoan: "8818406081",
      nganHang: "BIDV",
    },
    THE: {
      hoTenChuNha: "PHAN VĂN THẾ",
      ngaySinhChuNha: "24/11/1994",
      cccdChuNha: "066094006596 , Cấp ngày: 15/10/2025 tại Cục cảnh sát",
      diaChiChuNha: "LK01.31 Khu đô thị \u00c2n Phú , phường Tân An , tỉnh Đắk Lắk",
      dienThoaiChuNha: "0373129295 - 0567.79.2222 ( Thế )",
      chuTaiKhoan: "HKD PHAN VAN THE",
      soTaiKhoan: "8827905414",
      nganHang: "BIDV",
    }
  };

  useEffect(() => {
    if (!isOpen || !contract) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    async function loadDocx() {
      try {
        const landlordInfo = LANDLORDS[contract.chuNha || "TINH"] || LANDLORDS["TINH"];

        const payloadData = {
          hoTen: contract.customer?.fullName || contract.customer?.name || "..........................",
          ngaySinh: contract.customer?.birthDate ? dayjs(contract.customer.birthDate).format("DD/MM/YYYY") : "..........................",
          cccd: contract.customer?.identityNo || contract.customer?.citizenId || "..........................",
          diaChi: contract.customer?.address || "..........................",
          dienThoai: contract.customer?.phone || "..........................",
          dienThoaiNguoithan: contract.customer?.emergencyPhone || "",
          ngayKyHD: contract.signedAt ? dayjs(contract.signedAt).format("DD") : "...",
          thangKyHD: contract.signedAt ? dayjs(contract.signedAt).format("MM") : "...",
          namKyHD: contract.signedAt ? dayjs(contract.signedAt).format("YYYY") : "....",
          ngayKyhopdong: contract.signedAt ? dayjs(contract.signedAt).format("DD/MM/YYYY") : "..........................",
          ngayThanhToanDauTien: contract.firstPaymentDate ? dayjs(contract.firstPaymentDate).format("DD/MM/YYYY") : "..........................",
          mucDichThue: contract.purpose || "Để ở",
          tienThue: Number(contract.monthlyRent) || 0,
          tienThueChu: contract.monthlyRent ? numberToWordsVietnamese(Number(contract.monthlyRent)) : "..........................",
          tienCoc: Number(contract.depositMoney) || 0,
          tienCocChu: contract.depositMoney ? numberToWordsVietnamese(Number(contract.depositMoney)) : "..........................",
          ngayBatDau: contract.startDate ? dayjs(contract.startDate).format("DD/MM/YYYY") : "..........................",
          ngayKetThuc: contract.endDate ? dayjs(contract.endDate).format("DD/MM/YYYY") : "..........................",
          maPhong: contract.room?.code || contract.room?.name || "..........................",
          soPhongNgu: "1", // Hardcode for now, will support 2PN later
          thoiHanThue: contract.thoiHanThue || "1 năm",
          chuNha: contract.chuNha || "TINH",
          ...landlordInfo,
        };

        const res = await fetch("/api/export-contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadData),
        });

        if (!res.ok) {
          throw new Error("Không thể tạo file hợp đồng từ server");
        }

        const blob = await res.blob();

        if (isMounted && containerRef.current) {
          await renderAsync(blob, containerRef.current, undefined, {
            className: "docx-viewer", // custom class
            inWrapper: true, // wraps content
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: true,
            trimXmlDeclaration: true,
            debug: false,
          });
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(err);
          setError(err.message || "Lỗi khi tải file hợp đồng");
          setIsLoading(false);
        }
      }
    }

    loadDocx();

    return () => {
      isMounted = false;
    };
  }, [isOpen, contract]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hợp đồng thuê căn hộ"
      maxWidth="max-w-[900px]"
      zIndex={10030}
    >
      <div className="w-full h-[70vh] bg-gray-100 overflow-auto relative rounded-md border">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <span className="text-sm font-medium text-muted">Đang tải tài liệu...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
            <span className="text-sm font-medium text-rose-500">{error}</span>
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>
    </Modal>
  );
}
