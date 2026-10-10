import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import ContractConversionHistoryModal from "../../components/contracts/ContractConversionHistoryModal";

vi.mock("../../components/ui/Modal", () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const booking = { id: "booking", code: "REAL-BOOKING", isBookingHold: true };
const view = {
  rentalContract: { id: "rental", code: "REAL-LEASE", status: "DRAFT" },
  rentalReadiness: { canActivate: false, entryInvoicePaid: false },
};

function render(contract = booking, conversion: any = view) {
  return renderToStaticMarkup(<ContractConversionHistoryModal contract={contract} view={conversion} isOpen onClose={() => {}} />);
}

describe("conversion history only reports persisted evidence", () => {
  it("shows the current source and live draft without fabricating completed payment or occupancy", () => {
    const html = render();
    expect(html).toContain("REAL-BOOKING");
    expect(html).toContain("REAL-LEASE");
    expect(html).toContain("Chưa tạo được hóa đơn kỳ đầu");
    expect(html).not.toContain("6/6");
    expect(html).not.toContain("MUMN94T9");
    expect(html).not.toContain("8.000.000");
    expect(html).not.toContain("FT26272891902");
    expect(html).not.toContain("Xuất biên bản");
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });

  it("never displays evidence from a view unrelated to the current contract", () => {
    const html = render({ ...booking, id: "unrelated" }, { ...view, sourceBookingContract: booking });
    expect(html).toContain("Chưa có liên kết chuyển đổi hợp lệ");
    expect(html).not.toContain("REAL-LEASE");
  });

  it("does not infer conversion from room or demo code alone", () => {
    expect(render({ ...booking, code: "HD-COC-PN32-02-MUMN94T9" }, null)).toContain("Chưa có liên kết chuyển đổi hợp lệ");
  });
});

describe("upload and delivery do not invent signatures or communications", () => {
  const sourceText = readFileSync("components/contracts/OperationsContractDrawer.tsx", "utf8");
  const source = ts.createSourceFile("drawer.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  it("contract upload only updates attachments, never signedAt", () => {
    let upload: ts.VariableDeclaration | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "executeUploadContractFile") upload = node;
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(upload).toBeDefined();
    expect(upload!.getText(source)).not.toContain("signedAt:");
    expect(upload!.getText(source)).not.toContain("đã ký");
  });
  it("booking Zalo delivery completes only on communication evidence", () => {
    expect(sourceText).toContain("done: bookingQrSent,");
    expect(sourceText).not.toContain("bookingPaidByCash");
    expect(sourceText).not.toContain("bookingQrFlowDone");
  });
});
