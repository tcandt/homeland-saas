import { getLinkedRental, isBookingContract } from "./booking-conversion";

export const BOOKING_CANCEL_REASONS = [
  { value: "NOT_CONTINUING", label: "Khách không tiếp tục thuê" },
  { value: "EXPIRED", label: "Hết hạn hợp đồng cọc giữ phòng" },
  { value: "REFUND_REQUEST", label: "Khách xin nhận lại tiền cọc" },
  { value: "OTHER", label: "Lý do khác" },
];

export function canCancelBookingContract(contract: any, deposit: any) {
  if (!isBookingContract(contract) || getLinkedRental(contract) || !deposit?.id || contract?.reconciliationError || deposit?.reconciliationError) return false;
  if (!["BOOKING", "RESERVATION"].includes(deposit.type) ||
    (deposit.contractId && deposit.contractId !== contract.id) ||
    (deposit.rentalCycleId && contract.rentalCycleId && deposit.rentalCycleId !== contract.rentalCycleId)) return false;
  if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "EXPIRED"].includes(contract.status)) return false;
  if (deposit.status === "PAID") return true;
  const marker = contract?.termsSnapshot?.bookingCommand;
  return deposit.status === "PENDING" && marker?.depositId === deposit.id &&
    Boolean(marker?.invoiceId && marker.invoiceId === contract?.bookingInvoice?.id);
}

export function buildBookingCancellationAmounts(balance: number, mode: string, refundInput: string) {
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("Số dư cọc không hợp lệ. Hãy tải lại hợp đồng.");
  if (!["FULL", "PARTIAL", "NONE"].includes(mode)) throw new Error("Vui lòng chọn cách xử lý tiền cọc.");
  const refund = mode === "FULL" ? balance : mode === "NONE" ? 0 : Number(refundInput);
  if (!Number.isSafeInteger(refund) || refund < 0 || refund > balance ||
    (mode === "PARTIAL" && (!refundInput.trim() || refund <= 0 || refund >= balance))) {
    throw new Error("Tiền hoàn một phần phải lớn hơn 0 và nhỏ hơn số dư cọc thực thu.");
  }
  return { refundAmount: refund, keepAmount: balance - refund, deductAmount: 0 };
}
