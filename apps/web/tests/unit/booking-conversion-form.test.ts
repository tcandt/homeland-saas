import { describe, expect, it } from "vitest";
import { calculateBookingFirstRent, getBookingConversionPaymentSummary, getBookingRentalDefaults, getBookingHoldState, getBookingRecoveryErrorMessage, parseBookingRentalDate, getBookingDepositRefreshInterval } from "../../lib/contracts/booking-conversion";
import { depositAdapter } from "../../lib/adapters/deposit.adapter";

describe("booking conversion total payment", () => {
  it("requires 11 million after a paid 1 million booking, 4 million first rent and 8 million security", () => {
    const firstRentAmount = calculateBookingFirstRent(4_000_000, "2026-10-01");
    expect(firstRentAmount).toBe(4_000_000);
    expect(getBookingConversionPaymentSummary({
      bookingBalance: 1_000_000,
      securityRequired: 8_000_000,
      firstRentAmount,
    })).toEqual({
      transferredAmount: 1_000_000,
      additionalDepositRequired: 7_000_000,
      totalRequired: 12_000_000,
      totalAdditionalRequired: 11_000_000,
    });
  });

  it.each([
    ["2026-10-16", 1_600_000],
    ["2026-04-16", 1_550_000],
    ["2024-02-29", 106_897],
  ])("prorates remaining calendar days for %s", (startDate, expected) => {
    expect(calculateBookingFirstRent(3_100_000, startDate)).toBe(expected);
  });

  it.each([
    ["2026-09-30", 133_333, 7_133_333],
    ["2026-09-29", 266_667, 7_266_667],
  ])("keeps prorated rent and total in whole dong for %s", (startDate, rent, total) => {
    const firstRentAmount = calculateBookingFirstRent(4_000_000, startDate);
    expect(firstRentAmount).toBe(rent);
    expect(getBookingConversionPaymentSummary({
      bookingBalance: 1_000_000,
      securityRequired: 8_000_000,
      firstRentAmount,
    }).totalAdditionalRequired).toBe(total);
  });

  it.each([8_000_000, 9_000_000])("still requires first rent when booking covers security (%d)", (bookingBalance) => {
    expect(getBookingConversionPaymentSummary({
      bookingBalance,
      securityRequired: 8_000_000,
      firstRentAmount: 4_000_000,
    })).toMatchObject({ additionalDepositRequired: 0, totalAdditionalRequired: 4_000_000 });
  });
});

describe("automatic booking payment reconciliation", () => {
  it.each([
    ["BOOKING", "PENDING", "CONFIRMED", 5000],
    ["RESERVATION", "DRAFT", "CONFIRMED", 5000],
    ["BOOKING", "PENDING", "PENDING", 5000],
    ["BOOKING", "PAID", "CONFIRMED", false],
    ["BOOKING", "CONVERTED_TO_CONTRACT", "CONFIRMED", false],
    ["BOOKING", "CANCELLED", "CONFIRMED", false],
    ["SECURITY", "PENDING", "CONFIRMED", false],
    ["BOOKING", "PENDING", "FAILED", false],
  ])("refreshes %s/%s/%s only while the booking needs reconciliation", (type, status, paymentStatus, expected) => {
    expect(getBookingDepositRefreshInterval({ type, status }, { status: paymentStatus })).toBe(expected);
  });
  it("retains payment proof errors and the payment request through the deposit adapter", () => {
    const adapted = depositAdapter.toUI({
      id: "deposit", type: "BOOKING", status: "PENDING", availableBalance: 0,
      reconciliationError: "DEPOSIT_RECONCILIATION_PROOF_INVALID",
      paymentRequest: { id: "request", status: "CONFIRMED" },
    });
    expect(adapted.reconciliationError).toBe("DEPOSIT_RECONCILIATION_PROOF_INVALID");
    expect(getBookingDepositRefreshInterval(adapted)).toBe(5000);
  });
  it("never asks the operator to manually synchronize a confirmed payment", () => {
    expect(getBookingRecoveryErrorMessage("BOOKING_PAYMENT_CONFIRMED_RECONCILIATION_PENDING")).toContain("tự động đồng bộ");
    expect(getBookingRecoveryErrorMessage("BOOKING_PAYMENT_CONFIRMED_RECONCILIATION_PENDING")).not.toContain("Tải lại");
  });
  it("uses an automatic-retry fallback instead of a manual reload instruction", () => {
    const message = getBookingRecoveryErrorMessage("UNKNOWN_RECONCILIATION_ERROR");
    expect(message).toContain("Kiểm tra chứng từ");
    expect(message).not.toContain("Tải lại");
  });
});

describe("editable rental dates", () => {
  it.each([
    ["05/10/2026", "2026-10-05"],
    ["28/09/2026", "2026-09-28"],
    ["29/02/2024", "2024-02-29"],
    ["29/02/2026", ""],
    ["31/04/2026", ""],
    ["28/13/2026", ""],
    ["05/10/20", ""],
    ["", ""],
  ])("parses %s strictly as day/month/year", (input, expected) => {
    expect(parseBookingRentalDate(input)).toBe(expected);
  });
});

describe("booking conversion rental defaults", () => {
  it("keeps the scheduled October move-in date and previews 11 million instead of September's last three days", () => {
    const defaults = getBookingRentalDefaults({
      startDate: "2026-10-01T00:00:00.000Z",
      monthlyRent: 4_000_000,
      purpose: "Tiền cọc hợp đồng: 8.000.000 đồng",
    }, "2026-09-28");
    expect(defaults).toMatchObject({ startDate: "2026-10-01", endDate: "2027-10-01" });
    const firstRentAmount = calculateBookingFirstRent(Number(defaults.rentAmount), defaults.startDate);
    expect(firstRentAmount).toBe(4_000_000);
    expect(getBookingConversionPaymentSummary({ bookingBalance: 1_000_000, securityRequired: Number(defaults.securityRequired), firstRentAmount }).totalAdditionalRequired).toBe(11_000_000);
  });
  it("uses the new rental start date and agreed security amount instead of the booking cash amount", () => {
    expect(
      getBookingRentalDefaults(
        {
          startDate: "2026-09-22",
          depositMoney: 1000000,
          monthlyRent: "2000000",
          purpose:
            "Cọc giữ phòng | Giá thuê: 2.000.000 đồng/tháng | Tiền cọc hợp đồng: 4.000.000 đồng",
        },
        "2026-09-28",
      ),
    ).toEqual({
      startDate: "2026-09-28",
      endDate: "2027-09-28",
      rentAmount: "2000000",
      securityRequired: "4000000",
    });
  });
  it("requires an explicit security amount when no rental security was agreed", () => {
    expect(
      getBookingRentalDefaults(
        {
          depositMoney: 1000000,
          purpose: "Tiền cọc hợp đồng: ........ đồng",
          room: { monthlyPrice: "3000000" },
        },
        "2026-09-28",
      ),
    ).toMatchObject({ securityRequired: "", rentAmount: "3000000" });
  });
  it("uses the legacy agreed rental price and handles leap-year term boundaries", () => {
    expect(
      getBookingRentalDefaults(
        { monthlyRent: 0, purpose: "Giá thuê: 2,000,000 đồng/tháng" },
        "2024-02-29",
      ),
    ).toMatchObject({ rentAmount: "2000000", endDate: "2025-02-28" });
  });
});

describe("booking hold presentation", () => {
  const now = new Date("2026-09-28T08:00:00Z").getTime();
  const expired = { bookingHold: { status: "EXPIRED", expiresAt: "2026-09-22T16:59:00Z", isActive: false, requiresRecovery: true } };
  it("never infers room reservation from a paid deposit", () => {
    expect(getBookingHoldState({ bookingDeposit: { status: "PAID" } }, now).isActive).toBe(false);
    expect(getBookingHoldState(expired, now)).toMatchObject({ isActive: false, status: "EXPIRED" });
  });
  it("uses a valid existing hold without extending it and rechecks expiry", () => {
    const source = { bookingHold: { status: "ACTIVE", isActive: true, expiresAt: "2026-09-29T08:00:00Z" } };
    expect(getBookingHoldState(source, now).isActive).toBe(true);
    expect(getBookingHoldState(source, now + 86400000).requiresRecovery).toBe(true);
    expect(getBookingHoldState(source, now + 86400000).isActive).toBe(false);
  });
  it("does not recover a converted hold", () => {
    expect(getBookingHoldState({ bookingHold: { status: "CONVERTED", isActive: false } }, now).requiresRecovery).toBe(false);
  });
  it.each([
    ["BOOKING_CONVERT_HOLD_ROOM_UNAVAILABLE", "dọn dẹp hoặc bảo trì"],
    ["BOOKING_CONVERT_HOLD_FOREIGN_CONTRACT", "hợp đồng khác"],
    ["BOOKING_CONVERT_HOLD_FOREIGN_CYCLE", "hồ sơ thuê khác"],
    ["ROOM_HOLD_CONFLICT", "hồ sơ khác giữ chỗ"],
  ])("explains room recovery conflict %s without exposing an internal code", (code, reason) => {
    const message = getBookingRecoveryErrorMessage(code);
    expect(message).toContain(reason);
    expect(message).not.toContain(code);
  });
});
