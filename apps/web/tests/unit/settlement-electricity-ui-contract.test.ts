import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { settlementElectricityIssue, settlementElectricityValues } from "../../lib/contracts/settlement-electricity";

const drawerText = readFileSync("components/contracts/OperationsContractDrawer.tsx", "utf8");
const drawer = ts.createSourceFile("OperationsContractDrawer.tsx", drawerText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function functionText(name: string) {
  let match: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(drawer) === name) match = node;
    ts.forEachChild(node, visit);
  };
  visit(drawer);
  expect(match).toBeDefined();
  return match!.getText(drawer);
}

describe("settlement electricity UI contract", () => {
  it("synchronizes the selected room before refreshing the settlement preview and autofilling it", () => {
    const sync = functionText("handleSyncElectricity");
    const syncIndex = sync.indexOf("await hunonicApi.syncRoom(detailContract.roomId)");
    const previewIndex = sync.indexOf("await contractsApi.previewSettlement(");
    expect(syncIndex).toBeGreaterThanOrEqual(0);
    expect(previewIndex).toBeGreaterThan(syncIndex);
    expect(sync).toContain("delete payload.electricityAmount");
    expect(sync).toContain("delete payload.electricityClosingKwh");
    expect(sync).toContain("settlementElectricityValues(preview?.utilitySnapshot?.electricity)");
    expect(sync).toContain("electricityAmount: \"\", electricityClosingKwh: \"\"");
  });

  it("uses the room sync endpoint and renders the server date as read-only", () => {
    const apiText = readFileSync("lib/api/hunonic.api.ts", "utf8");
    expect(apiText).toContain("/hunonic/rooms/${encodeURIComponent(roomId)}/sync");
    expect(drawerText).toMatch(/data-testid="contract-settlement-actual-move-out-date"[\s\S]{0,160}type="date"[\s\S]{0,160}readOnly/);
    expect(drawerText).toContain("toDateInputValue(settlementPreview.actualMoveOutDate)");
  });

  it("does not announce sync success when the refreshed preview requires manual electricity evidence", async () => {
    const declaration = functionText("handleSyncElectricity");
    const preview = { utilitySnapshot: { electricity: {
      manualRequired: true,
      manualRequiredReason: "ELECTRICITY_BASELINE_REQUIRED",
      monthKwh: null,
      calculatedAmountVnd: null,
    } } };
    const showToast = vi.fn();
    const setSettlementForm = vi.fn((recipe) => recipe({ electricityAmount: "100", electricityClosingKwh: "10" }));
    const dependencies = {
      settlementSyncInFlightRef: { current: false },
      detailContract: { id: "contract-1", roomId: "room-1" },
      settlementSessionRef: { current: 1 },
      settlementPreviewRequestRef: { current: 0 },
      setIsSyncingHunonic: vi.fn(),
      hunonicApi: { syncRoom: vi.fn().mockResolvedValue(undefined) },
      buildSettlementPayload: vi.fn(() => ({ electricityAmount: "100", electricityClosingKwh: "10" })),
      contractsApi: { previewSettlement: vi.fn().mockResolvedValue(preview) },
      setSettlementPreview: vi.fn(),
      settlementElectricityValues,
      setSettlementForm,
      settlementElectricityIssue,
      showToast,
    };
    const output = ts.transpileModule(
      `const ${declaration}; return handleSyncElectricity;`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
    ).outputText;
    const handler = new Function("deps", `const { ${Object.keys(dependencies).join(",")} } = deps; ${output}`)(dependencies);

    await handler();

    expect(dependencies.hunonicApi.syncRoom).toHaveBeenCalledWith("room-1");
    expect(dependencies.contractsApi.previewSettlement).toHaveBeenCalledOnce();
    expect(setSettlementForm).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("Thiếu chỉ số điện đầu kỳ"),
      "info",
    );
    expect(showToast).not.toHaveBeenCalledWith(
      "Đã đồng bộ công tơ điện và cập nhật số liệu thành công!",
      "success",
    );
  });
});
