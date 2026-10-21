import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getStore: vi.fn() }));
vi.mock("@/lib/utils/learning-store", async () => {
  const { isLearningStorageError } = await import("./learning-store");
  return { getLearningStore: mocks.getStore, isLearningStorageError };
});
import { GET, POST } from "../../app/api/learning/v1/[...path]/route";

const context = (name: string) => ({ params: Promise.resolve({ path: [name] }) });
const post = (body: unknown) => new Request("http://localhost/api/learning/v1/samples", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => { mocks.getStore.mockReset(); });

describe("Learning route storage and input errors", () => {
  it("serves snapshots and accepts samples from the temporary store", async () => {
    const snapshot = { storage: "temporary", corner: [], qr: [], storesImages: false };
    const addMany = vi.fn().mockResolvedValue({ accepted: 1, rejected: 0, duplicates: 0 });
    mocks.getStore.mockResolvedValue({ snapshot: () => snapshot, addMany });
    const result = await GET(new Request("http://localhost/api/learning/v1/snapshot"), context("snapshot"));
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(await result.json()).toMatchObject(snapshot);
    const sample = { kind: "qr", payload: { x: 0.8, y: 0.2, span: 0.1, source: "zxing" } };
    const saved = await POST(post({ samples: [sample] }), context("samples"));
    expect(saved.status).toBe(202);
    expect(addMany).toHaveBeenCalledWith([sample]);
  });

  it("reports a storage write failure as 503 instead of blaming a valid sample with 400", async () => {
    const error = Object.assign(new Error("EACCES private/server/path"), { code: "EACCES" });
    mocks.getStore.mockResolvedValue({ addMany: vi.fn().mockRejectedValue(error) });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(post({ samples: [{ kind: "qr", payload: {} }] }), context("samples"));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("private/server/path");
    } finally { log.mockRestore(); }
  });

  it.each([null, [], { samples: [] }, { samples: Array(33).fill({}) }])("rejects malformed sample envelopes before opening storage: %j", async (body) => {
    expect((await POST(post(body), context("samples"))).status).toBe(400);
    expect(mocks.getStore).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON as 400", async () => {
    const request = new Request("http://localhost/api/learning/v1/samples", { method: "POST", body: "{" });
    expect((await POST(request, context("samples"))).status).toBe(400);
    expect(mocks.getStore).not.toHaveBeenCalled();
  });
});
