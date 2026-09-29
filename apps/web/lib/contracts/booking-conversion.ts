import { getContractStatusConfig } from "./contract-status";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export function parseBookingRentalDate(value: string) {
  const parsed = dayjs(value, "DD/MM/YYYY", true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : "";
}

export function calculateBookingFirstRent(monthlyRent: number, startDate: string) {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const daysInMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const billableDays = daysInMonth - start.getUTCDate() + 1;
  return Math.round((Math.round(monthlyRent) * billableDays) / daysInMonth);
}

export function getBookingConversionPaymentSummary(input: {
  bookingBalance: number;
  securityRequired: number;
  firstRentAmount: number;
}) {
  const transferredAmount = Math.min(input.bookingBalance, input.securityRequired);
  const additionalDepositRequired = Math.max(
    input.securityRequired - transferredAmount,
    0,
  );
  return {
    transferredAmount,
    additionalDepositRequired,
    totalRequired: input.securityRequired + input.firstRentAmount,
    totalAdditionalRequired: additionalDepositRequired + input.firstRentAmount,
  };
}

export const BOOKING_CONVERTED_LABEL = "Đã chuyển sang hợp đồng thuê dài hạn";

export function getBookingDepositRefreshInterval(deposit: any, paymentRequest = deposit?.paymentRequest): number | false {
  return ["BOOKING", "RESERVATION"].includes(String(deposit?.type || "").toUpperCase()) &&
    ["DRAFT", "PENDING"].includes(String(deposit?.status || "").toUpperCase()) &&
    ["PENDING", "CONFIRMED"].includes(String(paymentRequest?.status || "").toUpperCase())
    ? 5000
    : false;
}

export function getBookingHoldState(source: any, now = Date.now()) {
  const hold = source?.bookingHold;
  const expiresAt = hold?.expiresAt || null;
  const isActive = Boolean(
    hold?.isActive && hold?.status === "ACTIVE" &&
    expiresAt && new Date(expiresAt).getTime() > now,
  );
  return {
    known: Boolean(hold),
    status: hold?.status || "NONE",
    expiresAt,
    isActive,
    requiresRecovery: Boolean(hold && !isActive && hold.status !== "CONVERTED"),
  };
}

export function getBookingRecoveryErrorMessage(error: unknown) {
  const messages: Record<string, string> = {
    BOOKING_PAYMENT_CONFIRMED_RECONCILIATION_PENDING: "Thanh toán cọc đã xác nhận. Hệ thống đang tự động đồng bộ vào sổ cọc; không thu lại tiền.",
    BOOKING_CONVERT_HOLD_RECOVERY_REQUIRES_EXPIRY: "Chưa thể xác lập chỗ cho hợp đồng thuê. Kiểm tra tình trạng phòng trước khi tiếp tục.",
    BOOKING_CONVERT_HOLD_EXPIRY_INVALID: "Thời hạn giữ phòng mới phải ở trong tương lai.",
    BOOKING_CONVERT_HOLD_ROOM_UNAVAILABLE: "Phòng đang dọn dẹp hoặc bảo trì. Chỉ chuyển đổi sau khi phòng sẵn sàng cho thuê.",
    BOOKING_CONVERT_HOLD_FOREIGN_CONTRACT: "Phòng đã có hợp đồng khác. Kiểm tra hợp đồng đang giữ hoặc thuê phòng trước khi chuyển đổi.",
    BOOKING_CONVERT_HOLD_FOREIGN_CYCLE: "Phòng đã thuộc hồ sơ thuê khác. Kiểm tra kỳ thuê và hồ sơ giữ phòng trước khi chuyển đổi.",
    ROOM_HOLD_EXPIRY_INVALID: "Thời hạn giữ phòng đã hết. Chọn thời hạn mới để tiếp tục.",
    ROOM_HOLD_CONFLICT: "Phòng đã có hồ sơ khác giữ chỗ. Kiểm tra tình trạng phòng và hồ sơ giữ chỗ trước khi chuyển đổi.",
    ROOM_NOT_AVAILABLE: "Phòng hiện không thể giữ. Kiểm tra lại tình trạng phòng trước khi chuyển đổi.",
    ROOM_CAPACITY_EXCEEDED: "Phòng không còn chỗ trống. Kiểm tra người đang ở và các hồ sơ giữ phòng khác.",
    DEPOSIT_RECONCILIATION_UNAVAILABLE: "Đồng bộ cọc tạm thời gián đoạn. Hệ thống sẽ tự thử lại; không thu lại tiền.",
    DEPOSIT_RECONCILIATION_PROOF_REQUIRED: "Thiếu chứng từ thanh toán liên kết. Kiểm tra hóa đơn cọc và giao dịch đã xác nhận; không thu lại tiền.",
    DEPOSIT_RECONCILIATION_PROOF_INVALID: "Chứng từ thanh toán chưa đủ điều kiện đồng bộ. Kiểm tra đối soát; không thu lại tiền.",
    DEPOSIT_RECONCILIATION_SCOPE_INVALID: "Khoản thanh toán chưa khớp số tiền hoặc hồ sơ cọc. Kiểm tra đối soát; không thu lại tiền.",
    DEPOSIT_RECONCILIATION_INVOICE_INVALID: "Hóa đơn thanh toán chưa khớp cọc giữ phòng. Kiểm tra đối soát; không thu lại tiền.",
  };
  return messages[String(error)] || "Chưa thể hoàn tất đồng bộ hoặc chuyển đổi. Kiểm tra chứng từ và tình trạng phòng trước khi tiếp tục.";
}

export function getBookingRentalDefaults(contract: any, today: string) {
  const readAgreedAmount = (label: string) => {
    const match = String(contract?.purpose || "").match(
      new RegExp(`${label}:\\s*([\\d.,]+)`),
    );
    return match ? Number(match[1].replace(/[^0-9]/g, "")) : 0;
  };
  const monthlyRent =
    Number(contract?.monthlyRent || 0) ||
    readAgreedAmount("Giá thuê") ||
    Number(contract?.room?.monthlyPrice || 0);
  const securityRequired = readAgreedAmount("Tiền cọc hợp đồng");
  const plannedDate = contract?.startDate && dayjs(contract.startDate).isValid()
    ? dayjs(contract.startDate).format("YYYY-MM-DD")
    : "";
  const startDate = plannedDate >= today ? plannedDate : today;
  return {
    startDate,
    endDate: dayjs(startDate).add(12, "month").format("YYYY-MM-DD"),
    rentAmount: monthlyRent > 0 ? String(monthlyRent) : "",
    securityRequired: securityRequired > 0 ? String(securityRequired) : "",
  };
}

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

export function isContractSigned(contract: any): boolean {
  if (contract?.signedAt) return true;
  return isBookingContract(contract) && Array.isArray(contract?.attachments) &&
    contract.attachments.some((url: unknown) => typeof url === "string" && /\.pdf(?:[?#]|$)/i.test(url));
}

export function getContractDocumentStatus(contract: any) {
  const hasUploadedContract = Boolean(
    contract?.contractPdfUrl || contract?.pdfUrl || contract?.attachments?.length,
  );
  const hasUploadedCCCD = (contract?.customer?.idImages?.length || 0) >= 2;
  return {
    hasUploadedContract,
    hasUploadedCCCD,
    isComplete: isContractSigned(contract) && hasUploadedContract && hasUploadedCCCD,
  };
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

export function getRentalActivationBlockingMessages(
  readiness: any,
  startDate?: string | Date | null,
): string[] {
  if (readiness?.canActivate !== false) return [];
  const startDateLabel = startDate && dayjs(startDate).isValid()
    ? ` (${dayjs(startDate).format("DD/MM/YYYY")})`
    : "";
  const messages: Record<string, string> = {
    SECURITY_DEPOSIT_UNPAID: "Cọc bảo đảm chưa được ghi nhận đủ.",
    ENTRY_INVOICE_UNPAID: "Hóa đơn kỳ đầu chưa thanh toán đủ.",
    CONTRACT_SIGNATURE_REQUIRED: "Hợp đồng thuê chưa ghi nhận ngày ký.",
    CONTRACT_APPROVAL_REQUIRED: "Hợp đồng thuê chưa được duyệt.",
    CONTRACT_START_DATE_IN_FUTURE: `Chưa đến ngày bắt đầu hợp đồng${startDateLabel}.`,
  };
  const reasons = Array.isArray(readiness.blockingReasons)
    ? readiness.blockingReasons
    : [];
  return reasons.length > 0
    ? reasons.map((reason: string) => messages[reason] || "Điều kiện nhận phòng chưa được xác nhận. Tải lại hồ sơ để kiểm tra.")
    : ["Chưa thể xác nhận nhận phòng. Tải lại hồ sơ để kiểm tra điều kiện."];
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
  const activationBlockers = getRentalActivationBlockingMessages(readiness, rental.startDate);

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
          : activationBlockers.join(" ") || "Hoàn tất điều kiện nhận phòng trước khi kích hoạt hợp đồng.",
      state: rentalActive ? "complete" : rentalReady ? "current" : "blocked",
      done: rentalActive,
    },
  ];
}
