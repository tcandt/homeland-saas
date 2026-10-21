import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const text = readFileSync("components/buildings/RoomPremiumModal.tsx", "utf8");
const source = ts.createSourceFile("RoomPremiumModal.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function helper(name: string) {
  let declaration: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(declaration, `Missing ${name}`).toBeDefined();
  return declaration!.initializer!.getText(source);
}

const helpers = new Function(
  ts.transpileModule(
    `const normalizeVietnameseDate = ${helper("normalizeVietnameseDate")};
     const formatBirthDateForDisplay = ${helper("formatBirthDateForDisplay")};
     return { normalizeVietnameseDate, formatBirthDateForDisplay };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText,
)() as {
  normalizeVietnameseDate(value: string): string;
  formatBirthDateForDisplay(value: string): string;
};

describe("RoomPremiumModal DOB input", () => {
  it("keeps partial typing and backspace text intact until blur", () => {
    expect(helpers.formatBirthDateForDisplay("20/10/200")).toBe("20/10/200");
    expect(helpers.formatBirthDateForDisplay("20/10/20")).toBe("20/10/20");
    expect(helpers.formatBirthDateForDisplay("2")).toBe("2");
  });

  it("normalizes a completed DOB only when formatting on blur", () => {
    expect(helpers.normalizeVietnameseDate("20/10/2000")).toBe("2000-10-20");
    expect(helpers.formatBirthDateForDisplay("2000-10-20")).toBe("20/10/2000");
    expect(text).toMatch(/onBlur=\{\(\) => updateTenantDraft\("birthDate", formatBirthDateForDisplay\(tenantDraft\.birthDate\)\)\}/);
    expect(text).toMatch(/onChange=\{\(event\)\s*=>\s*updateTenantDraft\("birthDate", event\.target\.value\)\s*\}/);
  });
});
