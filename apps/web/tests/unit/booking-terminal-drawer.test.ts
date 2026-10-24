import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceText = readFileSync("components/contracts/OperationsContractDrawer.tsx", "utf8");

function footerText() {
  const start = sourceText.indexOf('footer={', sourceText.indexOf('testId="contract-detail-drawer"'));
  const end = sourceText.indexOf('\n      >', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sourceText.slice(start, end);
}

describe("terminal booking drawer footer", () => {
  it("hides only invoice creation for a terminal booking hold", () => {
    const footer = footerText();
    expect(footer).toContain("!(isBookingHold && statusConfig?.isTerminal)");
    expect(footer).toContain("<Receipt size={14} /> Tạo hóa đơn");
  });

  it("keeps entry-invoice access available for historical rental contracts", () => {
    const footer = footerText();
    const invoiceAction = footer.slice(footer.indexOf("!(isBookingHold && statusConfig?.isTerminal)"));
    expect(invoiceAction).toContain("if (detailContract.entryInvoice)");
    expect(invoiceAction).toContain("setFlowInvoice(detailContract.entryInvoice)");
    expect(invoiceAction).not.toContain("!statusConfig?.isTerminal &&");
  });

  it("does not present cancelled holds as a completed conversion", () => {
    expect(sourceText).toContain('statusConfig?.isTerminal ? "Không chuyển đổi" : "Chưa chuyển đổi"');
    expect(sourceText).not.toContain('statusConfig?.isTerminal ? "Hoàn tất"');
  });
});
