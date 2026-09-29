import { describe, it, expect } from "vitest";
import { getLinkedRental, getContractDisplayStatus, getConversionSteps, getRentalActivationBlockingMessages, isBookingContract, isContractSigned, BOOKING_CONVERTED_LABEL } from "../../lib/contracts/booking-conversion";
import { getOperationsContractKpiSummary } from "../../lib/contracts/operations-contract-kpi";

describe("booking source traceability", () => {
  const rental = { id: "lease", code: "HD-THUE-01", status: "DRAFT", signedAt: null };
  const source = { id: "booking", code: "HD-COC-01", status: "APPROVED", bookingConversion: { rentalContract: rental } };
  it("keeps source business status separate from target legal approval and pending counts", () => {
    expect(getLinkedRental(source)?.id).toBe("lease");
    expect(getContractDisplayStatus(source).label).toBe(BOOKING_CONVERTED_LABEL);
    expect(getContractDisplayStatus(rental).label).toBe("Bản nháp");
    expect(getOperationsContractKpiSummary([source, rental]).pending).toBe(1);
  });
  it("does not classify the rental as a booking because its purpose references the source", () => {
    expect(isBookingContract({ ...rental, purpose: "Chuyển từ HD-COC-01" })).toBe(false);
    expect(getLinkedRental({ ...rental, bookingConversion: source.bookingConversion })).toBeNull();
  });
  it("counts an uploaded booking PDF as signed without inferring rental signatures or approval", () => {
    expect(isContractSigned({ ...source, status: "DRAFT", signedAt: null, attachments: ["document-storage://contracts/booking.pdf"] })).toBe(true);
    expect(isContractSigned({ ...source, signedAt: null, attachments: ["document-storage://contracts/scan.jpg"] })).toBe(false);
    expect(isContractSigned({ ...rental, status: "APPROVED", attachments: ["document-storage://contracts/lease.pdf"] })).toBe(false);
    expect(isContractSigned({ ...rental, signedAt: "2026-09-29T00:00:00.000Z" })).toBe(true);
  });
  it("does not infer signature, payment, or move-in from conversion alone", () => {
    expect(getConversionSteps(source.bookingConversion).map((step) => step.done)).toEqual([true, true, false, false, false, false]);
    const liveView = { rentalContract: { ...rental, status: "APPROVED", signedAt: "2026-09-01" }, rentalReadiness: { depositPaid: true, entryInvoicePaid: true } };
    expect(getConversionSteps(liveView).map((step) => step.done)).toEqual([true, true, true, true, true, false]);
    expect(getConversionSteps({ ...liveView, rentalContract: { ...liveView.rentalContract, activatedAt: "2026-09-02", status: "ACTIVE" } }).at(-1)?.done).toBe(true);
  });
  it("shows QR delivery and waiting for payment as distinct states", () => {
    const waitingView = {
      rentalContract: rental,
      entryInvoice: { id: "invoice-1", code: "INV-01", status: "ISSUED" },
      entryPaymentRequest: { metadata: { zaloSentAt: "2026-09-02T08:00:00.000Z" } },
      rentalReadiness: { entryInvoicePaid: false, canActivate: false },
    };
    const steps = getConversionSteps(waitingView);
    expect(steps.find((step) => step.key === "invoice-sent")?.state).toBe("complete");
    expect(steps.find((step) => step.key === "waiting-payment")?.state).toBe("waiting");
    expect(steps.find((step) => step.key === "payment-confirmed")?.state).toBe("blocked");
  });
  it("names the actual move-in blockers, including a future start date", () => {
    const readiness = { canActivate: false, blockingReasons: ["CONTRACT_START_DATE_IN_FUTURE"] };
    expect(getRentalActivationBlockingMessages(readiness, "2026-10-01")).toEqual([
      "Chưa đến ngày bắt đầu hợp đồng (01/10/2026).",
    ]);
    const steps = getConversionSteps({ rentalContract: { ...rental, startDate: "2026-10-01" }, rentalReadiness: readiness });
    expect(steps.at(-1)?.detail).toContain("Chưa đến ngày bắt đầu hợp đồng (01/10/2026).");
    expect(steps.at(-1)?.detail).not.toContain("ký, duyệt");
    expect(getRentalActivationBlockingMessages({ canActivate: false, blockingReasons: ["SECURITY_DEPOSIT_UNPAID", "ENTRY_INVOICE_UNPAID"] })).toEqual([
      "Cọc bảo đảm chưa được ghi nhận đủ.",
      "Hóa đơn kỳ đầu chưa thanh toán đủ.",
    ]);
    expect(getRentalActivationBlockingMessages({ canActivate: true, blockingReasons: ["ENTRY_INVOICE_UNPAID"] })).toEqual([]);
  });
});
