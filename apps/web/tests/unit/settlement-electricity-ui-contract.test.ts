import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

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
});
