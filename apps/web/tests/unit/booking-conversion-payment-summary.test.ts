import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingConversionPaymentSummary } from "../../components/contracts/BookingConversionPaymentSummary";

describe("booking conversion payment summary", () => {
  it("does not show fractional dong from older invoice data", () => {
    const html = renderToStaticMarkup(React.createElement(BookingConversionPaymentSummary, {
      rentAmount: 133_333.33,
      securityAmount: 8_000_000,
      paidDepositAmount: 1_000_000,
      totalDue: 7_133_333.33,
      startDate: "2026-09-30",
      totalTestId: "booking-conversion-total-due",
    }));
    expect(html).toContain("133.333 đ");
    expect(html).toMatch(/data-testid="booking-conversion-total-due"[^>]*>7\.133\.333 đ/);
    expect(html).not.toContain(",33");
  });

  it("shows only rent, security, the paid deduction, and the total with the billing period", () => {
    const html = renderToStaticMarkup(React.createElement(BookingConversionPaymentSummary, {
      rentAmount: 4_000_000,
      securityAmount: 8_000_000,
      paidDepositAmount: 1_000_000,
      totalDue: 11_000_000,
      startDate: "2026-10-01",
      totalTestId: "booking-conversion-total-due",
    }));
    expect(html.match(/<dt\b/g)).toHaveLength(4);
    expect(html).toContain("01/10 - 31/10/2026");
    expect(html).toContain("- 1.000.000 đ");
    expect(html).toMatch(/data-testid="booking-conversion-total-due"[^>]*>11\.000\.000 đ/);
    expect(html).not.toContain("Chuyển sang cọc");
    expect(html).not.toContain("Cọc cần thu thêm");
  });

  it("identifies the actual date range when a partial first month is selected", () => {
    const html = renderToStaticMarkup(React.createElement(BookingConversionPaymentSummary, {
      rentAmount: 400_000,
      securityAmount: 8_000_000,
      paidDepositAmount: 1_000_000,
      totalDue: 7_400_000,
      startDate: "2026-09-28",
      totalTestId: "booking-conversion-total-due",
    }));
    expect(html).toContain("28/09 - 30/09/2026");
    expect(html).toContain("400.000 đ");
  });
});
