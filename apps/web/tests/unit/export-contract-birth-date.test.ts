import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  renders: [] as any[],
  converterCalls: 0,
}));

vi.mock("fs", () => ({ default: {
  existsSync: () => true,
  readFileSync: () => Buffer.from("template"),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
} }));
vi.mock("child_process", () => ({ execSync: () => { state.converterCalls += 1; } }));
vi.mock("pizzip", () => ({ default: class {
  file() { return undefined; }
} }));
vi.mock("docxtemplater", () => ({ default: class {
  render(data: any) { state.renders.push(data); }
  getZip() { return { generate: () => Buffer.from("synthetic docx") }; }
} }));
vi.mock("@/lib/server/route-auth", () => ({
  requireRoutePermission: async () => ({ authorization: "Bearer synthetic-secret", user: {} }),
}));
vi.mock("@/lib/server/contract-table-layout", () => ({
  normalizeContractIdentityTables: (xml: string) => xml,
}));
vi.mock("@/lib/contracts/contract-birth-date", async () => import("../../lib/contracts/contract-birth-date"));

import { POST } from "../../app/api/export-contract/route";

const request = (ngaySinh: unknown) => new Request("http://local/api/export-contract", {
  method: "POST",
  body: JSON.stringify({ hoTen: "Synthetic tenant", ngaySinh }),
});

describe("export-contract DOB validation", () => {
  beforeEach(() => { state.renders = []; state.converterCalls = 0; });

  it.each([undefined, "..........................", "31/04/2000", "2999-01-01"])("returns 422 before render or conversion for invalid DOB %j", async (ngaySinh) => {
    const response = await POST(request(ngaySinh));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "CUSTOMER_BIRTH_DATE_REQUIRED" });
    expect(state.renders).toHaveLength(0);
    expect(state.converterCalls).toBe(0);
  });

  it("normalizes a local dd/mm DOB for the contract template without day/month swapping", async () => {
    const response = await POST(request("2/1/1999"));
    expect(response.status).toBe(200);
    expect(state.renders).toEqual([expect.objectContaining({ ngaySinh: "02/01/1999" })]);
    expect(state.converterCalls).toBe(0);
  });
});
