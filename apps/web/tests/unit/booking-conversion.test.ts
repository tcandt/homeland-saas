import { describe, it, expect } from "vitest";
import { getLinkedRental, getContractDisplayStatus, getConversionSteps, isBookingContract, BOOKING_CONVERTED_LABEL } from "../../lib/contracts/booking-conversion";
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
});
