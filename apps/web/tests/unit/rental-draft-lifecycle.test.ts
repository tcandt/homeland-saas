import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
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

function legacyImportBranch() {
  let branch: ts.IfStatement | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node) && node.expression.getText(source) === 'rentalIntentMode === "LEGACY"' && node.thenStatement.getText(source).includes("contractsApi.importExisting(")) {
      branch = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(branch, "Missing legacy import branch").toBeDefined();
  return branch!;
}

async function finishLegacyImport({ waitForZalo = false, currentContext = true }: { waitForZalo?: boolean; currentContext?: boolean } = {}) {
  const importExisting = vi.fn().mockResolvedValue({
    contract: { id: "legacy-contract-uat", code: "HD-CU-101-uat", status: "ACTIVE" },
    missingDocuments: ["CCCD_FRONT", "CCCD_BACK", "CONTRACT_FILE"],
    nextBillingDate: "2026-11-01",
  });
  const setRoomData = vi.fn((recipe: (previous: any) => any) => recipe({ code: "P101", status: "vacant" }));
  const closeTenantModal = vi.fn();
  const beginZaloWaitingIfNeeded = vi.fn(() => waitForZalo);
  const showToast = vi.fn();
  const dependencies = {
    rentalIntentMode: "LEGACY",
    contractDraft: { ngayBatDau: "2026-01-01", ngayKetThuc: "2027-10-15", ngayKyhopdong: "", tienThue: "3.000.000 đ", tienCoc: "6.000.000 đ" },
    legacyPaidThrough: "2026-10-31",
    normalizeStrictYmdDate: (value: string) => value,
    getEndOfMonthYmd: () => "2026-10-31",
    getLocalYMD: () => "2026-10-20",
    customerId: "customer-uat",
    roomContext: { roomId: "room-uat" },
    roomData: { code: "P101" },
    expectedGeneration: 7,
    legacyAttachments: [],
    contractsApi: { importExisting },
    tenantSelectionContext: { current: currentContext ? { generation: 7, roomId: "room-uat" } : { generation: 8, roomId: "other-room" } },
    setLegacyMissingDocuments: vi.fn(),
    queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
    setRoomData,
    savedTenantInfo: { name: "Old tenant" },
    remainingContractDays: vi.fn(() => 360),
    setActiveTab: vi.fn(),
    formatYmdForVietnamDisplay: (value: string) => value,
    showToast,
    beginZaloWaitingIfNeeded,
    closeTenantModal,
  };
  const body = ts.transpileModule(legacyImportBranch().getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  await new Function("deps", `const { ${Object.keys(dependencies).join(",")} } = deps; return (async () => { ${body} })();`)(dependencies);
  return { ...dependencies, importExisting };
}

describe("Rental draft lifecycle", () => {
  // Run the production booking branch with controlled API/UI dependencies.
  // In particular, a QR failure happens AFTER the booking was persisted.
  async function finishBooking(paymentRequest: unknown, waitForZalo: boolean) {
    let bookingBranch: ts.IfStatement | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isIfStatement(node) && node.expression.getText(source) === 'rentalIntentMode === "BOOKING"' && node.thenStatement.getText(source).includes("await createBookingHoldFlow(")) {
        bookingBranch = node;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(bookingBranch).toBeDefined();
    const closeTenantModal = vi.fn();
    const beginZaloWaitingIfNeeded = vi.fn(() => waitForZalo);
    const showToast = vi.fn();
    const dependencies = {
      rentalIntentMode: "BOOKING",
      customerId: "customer-uat",
      roomContext: { roomId: "room-uat" },
      expectedGeneration: 1,
      tenantSelectionContext: { current: { generation: 1, roomId: "room-uat" } },
      createBookingHoldFlow: vi.fn().mockResolvedValue({
        invoice: { id: "invoice-uat" },
        paymentRequest,
        paymentRequestError: paymentRequest ? null : "PROVIDER_DISABLED",
      }),
      queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
      setActiveTab: vi.fn(), closeTenantModal, beginZaloWaitingIfNeeded, showToast,
    };
    const body = ts.transpileModule(bookingBranch!.getText(source), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    await new Function("deps", `const { ${Object.keys(dependencies).join(",")} } = deps; return (async () => { ${body} })();`)(dependencies);
    return dependencies;
  }

  it("closes the persisted booking form when QR creation fails instead of offering another save", async () => {
    const result = await finishBooking(null, false);
    expect(result.closeTenantModal).toHaveBeenCalledExactlyOnceWith(true);
    expect(result.beginZaloWaitingIfNeeded).not.toHaveBeenCalled();
    expect(result.showToast).toHaveBeenCalledWith(expect.stringContaining("không lập lại cọc"), "info");
    expect(result.createBookingHoldFlow).toHaveBeenCalledTimes(1);
  });

  it("closes a successful booking when the customer does not need the Zalo linking step", async () => {
    const result = await finishBooking({ id: "qr-uat" }, false);
    expect(result.closeTenantModal).toHaveBeenCalledExactlyOnceWith(true);
    expect(result.beginZaloWaitingIfNeeded).toHaveBeenCalledWith("customer-uat", "invoice-uat");
  });

  it("preserves the Zalo linking step only when it is actually opened", async () => {
    const result = await finishBooking({ id: "qr-uat" }, true);
    expect(result.closeTenantModal).not.toHaveBeenCalled();
  });

  it("imports a paid legacy tenancy once without creating an entry invoice or QR", async () => {
    const result = await finishLegacyImport();
    expect(result.importExisting).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      idempotencyKey: "room-flow:legacy:room-uat:customer-uat:7",
      customerId: "customer-uat", roomId: "room-uat", startDate: "2026-01-01", endDate: "2027-10-15",
      signedAt: "2026-01-01", paidThrough: "2026-10-31", rentAmount: 3000000, depositAmount: 6000000,
      attachments: [],
    }));
    expect(result.setLegacyMissingDocuments).toHaveBeenCalledWith(["CCCD_FRONT", "CCCD_BACK", "CONTRACT_FILE"]);
    expect(result.setRoomData).toHaveBeenCalledOnce();
    expect(result.setActiveTab).toHaveBeenCalledWith("rental_flow");
    expect(result.beginZaloWaitingIfNeeded).toHaveBeenCalledExactlyOnceWith("customer-uat");
    expect(result.closeTenantModal).toHaveBeenCalledExactlyOnceWith(true);
    expect(result.showToast).toHaveBeenCalledWith(expect.stringContaining("thu từ tháng sau"), "success");
    const calls = (() => {
      const found: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) found.push(node.expression.getText(source));
        ts.forEachChild(node, visit);
      };
      visit(legacyImportBranch());
      return found;
    })();
    expect(calls).toContain("contractsApi.importExisting");
    expect(calls).not.toContain("createInitialInvoiceForContract");
    expect(calls).not.toContain("paymentsApi.sendInvoiceToZalo");
  });

  it("keeps missing-document warnings nonblocking and opens Zalo completion only once", async () => {
    const result = await finishLegacyImport({ waitForZalo: true });
    expect(result.setLegacyMissingDocuments).toHaveBeenCalledOnce();
    expect(result.beginZaloWaitingIfNeeded).toHaveBeenCalledExactlyOnceWith("customer-uat");
    expect(result.closeTenantModal).not.toHaveBeenCalled();
    expect(source.getText()).toContain("Hồ sơ còn thiếu, vẫn có thể đồng bộ");
    expect(source.getText()).toContain("Thiếu CCCD mặt trước đã duyệt.");
    expect(source.getText()).toContain("Thiếu CCCD mặt sau đã duyệt.");
    expect(source.getText()).toContain("Chưa có tệp hợp đồng.");
  });

  it("does not transition the UI or request Zalo when the room context changed during import", async () => {
    const result = await finishLegacyImport({ currentContext: false });
    expect(result.importExisting).toHaveBeenCalledOnce();
    expect(result.setLegacyMissingDocuments).not.toHaveBeenCalled();
    expect(result.setRoomData).not.toHaveBeenCalled();
    expect(result.beginZaloWaitingIfNeeded).not.toHaveBeenCalled();
    expect(result.closeTenantModal).not.toHaveBeenCalled();
    expect(result.showToast).toHaveBeenCalledWith(expect.stringContaining("Ngữ cảnh phòng đã thay đổi"), "info");
  });

  it("uses balance-based payment labels in the room invoice table", () => {
    expect(source.getText()).toContain("const paymentState = getInvoicePaymentPresentation(inv)");
    expect(source.getText()).toContain("{paymentState.label}");
  });

  it("delegates initial billing to the canonical entry-billing service", () => {
    const declaration = source.statements
      .flatMap((statement) => {
        const found: ts.VariableDeclaration[] = [];
        const visit = (node: ts.Node) => {
          if (ts.isVariableDeclaration(node) && node.name.getText(source) === "createInitialInvoiceForContract") found.push(node);
          ts.forEachChild(node, visit);
        };
        visit(statement);
        return found;
      })[0];
    expect(declaration).toBeDefined();
    const body = declaration!.initializer?.getText(source) || "";
    expect(body).toContain("prepareEntryBilling");
  });

  it.each(["commitTenantDraft", "createBookingHoldFlow"])(
    "%s never marks a new contract as signed",
    (name) => {
      const creates = callsIn(name).filter((call) => ["contractsApi.create", "contractsApi.createBookingHold"].includes(call.expression.getText(source)));
      expect(creates).toHaveLength(1);
      const payload = creates[0].arguments[0] as ts.ObjectLiteralExpression;
      if (ts.isObjectLiteralExpression(payload)) {
        expect(payload.properties.map((property) => property.name?.getText(source))).not.toContain("signedAt");
      } else {
        expect(creates[0].getText(source)).not.toContain("signedAt");
      }
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
    expect(getContractDocumentStatus({ code: "HD-COC-01", signedAt, attachments: ["booking.pdf"], customer }).isComplete).toBe(true);
  });
});
