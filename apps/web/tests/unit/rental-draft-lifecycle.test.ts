import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getContractDocumentStatus } from "../../lib/contracts/booking-conversion";

const sourcePath = resolve(process.cwd(), "components/buildings/RoomPremiumModal.tsx");
const source = ts.createSourceFile(
  sourcePath,
  readFileSync(sourcePath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function callsIn(name: string) {
  let declaration: ts.VariableDeclaration | undefined;
  const find = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) declaration = node;
    ts.forEachChild(node, find);
  };
  find(source);
  expect(declaration, `Missing ${name}`).toBeDefined();
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(declaration!);
  return calls;
}

describe("Rental draft lifecycle", () => {
  it("keeps an explicitly zero deposit when calculating the initial invoice", () => {
    let amountDeclaration: ts.VariableDeclaration | undefined;
    const find = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "createInitialInvoiceForContract") {
        const visit = (child: ts.Node) => {
          if (ts.isVariableDeclaration(child) && child.name.getText(source) === "amount") amountDeclaration = child;
          ts.forEachChild(child, visit);
        };
        visit(node);
      }
      ts.forEachChild(node, find);
    };
    find(source);
    expect(amountDeclaration?.initializer?.getText(source)).toContain("contract.depositMoney ?? roomData?.monthlyPrice ?? 0");
    expect(amountDeclaration?.initializer?.getText(source)).toContain("contract.monthlyRent ?? roomData?.monthlyPrice ?? 0");
  });

  it.each(["commitTenantDraft", "createBookingHoldFlow"])(
    "%s never marks a new contract as signed",
    (name) => {
      const creates = callsIn(name).filter((call) => call.expression.getText(source) === "contractsApi.create");
      expect(creates).toHaveLength(1);
      const payload = creates[0].arguments[0] as ts.ObjectLiteralExpression;
      expect(ts.isObjectLiteralExpression(payload)).toBe(true);
      expect(payload.properties.map((property) => property.name?.getText(source))).not.toContain("signedAt");
    },
  );

  it("saving a customer never updates the room lifecycle directly", () => {
    const calls = callsIn("commitTenantDraft").map((call) => call.expression.getText(source));
    expect(calls).not.toContain("onUpdateRoom");
    expect(calls).not.toContain("roomsApi.update");
  });
});

describe("Signed document evidence", () => {
  const signedAt = "2026-09-29T00:00:00+07:00";
  const customer = { idImages: ["front.png", "back.png"] };

  it("a signing date alone does not claim that documents are uploaded", () => {
    expect(getContractDocumentStatus({ signedAt }).isComplete).toBe(false);
  });

  it("one CCCD image is incomplete", () => {
    const result = getContractDocumentStatus({ signedAt, attachments: ["contract.pdf"], customer: { idImages: ["front.png"] } });
    expect(result.hasUploadedCCCD).toBe(false);
    expect(result.isComplete).toBe(false);
  });

  it("unsigned rental files do not complete signing", () => {
    expect(getContractDocumentStatus({ attachments: ["contract.pdf"], customer }).isComplete).toBe(false);
  });

  it("requires the signing date, contract file and both CCCD images", () => {
    expect(getContractDocumentStatus({ signedAt, attachments: ["contract.pdf"], customer }).isComplete).toBe(true);
  });

  it("supports existing PDF URL references", () => {
    expect(getContractDocumentStatus({ signedAt, contractPdfUrl: "contract.pdf", customer }).isComplete).toBe(true);
  });

  it("keeps booking PDF signing evidence without confusing it with complete identity documents", () => {
    expect(getContractDocumentStatus({ code: "HD-COC-01", attachments: ["booking.pdf"] }).isComplete).toBe(false);
    expect(getContractDocumentStatus({ code: "HD-COC-01", attachments: ["booking.pdf"], customer }).isComplete).toBe(true);
  });
});
