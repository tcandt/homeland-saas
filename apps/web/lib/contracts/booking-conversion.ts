import { getContractStatusConfig } from "./contract-status";

export const BOOKING_CONVERTED_LABEL = "Đã chuyển sang hợp đồng thuê dài hạn";

export type BookingConversionStepState =
  | "complete"
  | "current"
  | "waiting"
  | "blocked";

export type BookingConversionStep = {
  key:
    | "booking-effective"
    | "rental-created"
    | "invoice-sent"
    | "waiting-payment"
    | "payment-confirmed"
    | "rental-active";
  title: string;
  detail: string;
  state: BookingConversionStepState;
  done: boolean;
};

export function isBookingContract(contract: any): boolean {
  if (contract?.termsSnapshot?.convertedFromBookingHold?.sourceContractId || String(contract?.code || "").startsWith("HD-THUE-")) return false;
  return Boolean(contract?.isBookingHold || /hd-coc|cọc giữ phòng|coc giu phong|booking_hold/i.test(`${contract?.code || ""} ${contract?.purpose || ""} ${contract?.contractTemplate || ""}`));
}

export function getLinkedRental(contract: any) {
  if (!isBookingContract(contract)) return null;
  return contract?.bookingConversion?.rentalContract || (contract?.termsSnapshot?.bookingConversion?.rentalContractId ? {
    id: contract.termsSnapshot.bookingConversion.rentalContractId,
    code: contract.termsSnapshot.bookingConversion.rentalContractCode,
  } : null);
}

export function getContractDisplayStatus(contract: any) {
  return getLinkedRental(contract)
    ? { ...getContractStatusConfig(contract.status), label: BOOKING_CONVERTED_LABEL, color: "success" as const }
    : getContractStatusConfig(contract?.status);
}

export function getConversionSteps(view: any): BookingConversionStep[] {
  if (!view?.rentalContract) return [];
  const rental = view.rentalContract;
  const readiness = view.rentalReadiness;
  const invoice = view.entryInvoice;
  const paymentRequest = view.entryPaymentRequest;
  const qrSent = Boolean(
    paymentRequest?.metadata?.zaloSentAt ||
      paymentRequest?.metadata?.zaloDispatchAt,
  );
  const paymentConfirmed = readiness?.entryInvoicePaid === true;
  const invoiceDeliveryComplete = qrSent || paymentConfirmed;
  const rentalActive =
    Boolean(rental.activatedAt) || ["ACTIVE", "EXPIRING"].includes(rental.status);
  const rentalReady = readiness?.canActivate === true;

  return [
    {
      key: "booking-effective",
      title: "Cọc giữ phòng có hiệu lực",
      detail: "Khoản cọc nguồn đã được xác nhận trước khi chuyển đổi.",
      state: "complete",
      done: true,
    },
    {
      key: "rental-created",
      title: "Chuyển cọc sang hợp đồng dài hạn",
      detail: `Đã tạo hợp đồng thuê riêng ${rental.code || ""}; hợp đồng giữ chỗ vẫn được lưu để tra soát.`,
      state: "complete",
      done: true,
    },
    {
      key: "invoice-sent",
      title: "Tạo hóa đơn và gửi QR qua Zalo",
      detail: qrSent
        ? `Đã gửi ${invoice?.code || "hóa đơn kỳ đầu"} và QR thanh toán cho khách.`
        : paymentConfirmed
          ? "Khoản thu đã được xác nhận; không cần gửi lại QR thanh toán."
        : invoice?.id
          ? `${invoice.code || "Hóa đơn kỳ đầu"} đã sẵn sàng để phát hành và gửi.`
          : "Chưa tạo được hóa đơn kỳ đầu.",
      state: invoiceDeliveryComplete ? "complete" : invoice?.id ? "current" : "blocked",
      done: invoiceDeliveryComplete,
    },
    {
      key: "waiting-payment",
      title: "Chờ khách thanh toán",
      detail: paymentConfirmed
        ? "Hệ thống đã nhận đủ tiền của hóa đơn kỳ đầu."
        : qrSent
          ? "Đang chờ giao dịch ngân hàng và đối soát SePay."
          : "Bước này bắt đầu sau khi QR được gửi thành công.",
      state: paymentConfirmed ? "complete" : qrSent ? "waiting" : "blocked",
      done: paymentConfirmed,
    },
    {
      key: "payment-confirmed",
      title: "Xác nhận nhận thanh toán thành công",
      detail: paymentConfirmed
        ? "Hóa đơn kỳ đầu đã được xác nhận thanh toán đủ."
        : "Chỉ hoàn tất khi SePay hoặc nghiệp vụ thu tiền xác nhận khoản thu.",
      state: paymentConfirmed ? "complete" : "blocked",
      done: paymentConfirmed,
    },
    {
      key: "rental-active",
      title: "Hợp đồng thuê dài hạn có hiệu lực",
      detail: rentalActive
        ? "Hợp đồng thuê đã có hiệu lực và phòng đã được bàn giao."
        : rentalReady
          ? "Đã đủ điều kiện để xác nhận nhận phòng và kích hoạt hợp đồng."
          : paymentConfirmed
            ? "Cần hoàn tất ký, duyệt hoặc cọc bảo đảm trước khi nhận phòng."
            : "Hoàn tất thanh toán và hồ sơ hợp đồng trước khi nhận phòng.",
      state: rentalActive ? "complete" : rentalReady ? "current" : "blocked",
      done: rentalActive,
    },
  ];
}
