import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const fallbackRoot = vi.hoisted(() => ({ value: "" }));
vi.mock("node:os", async (original) => {
  const os = await original<typeof import("node:os")>();
  return { ...os, tmpdir: () => fallbackRoot.value || os.tmpdir() };
});

afterEach(async () => {
  vi.unstubAllEnvs();
  if (fallbackRoot.value) await rm(fallbackRoot.value, { recursive: true, force: true });
  fallbackRoot.value = "";
});

describe("Learning storage fallback", () => {
  it("persists sanitized samples in a temporary directory when the primary path cannot be a directory", async () => {
    fallbackRoot.value = await mkdtemp(path.join(tmpdir(), "homeland-qr-fallback-test-"));
    const blockedPath = path.join(fallbackRoot.value, "not-a-directory");
    await writeFile(blockedPath, "synthetic test fixture");
    vi.stubEnv("CCCD_LEARNING_DATA_DIR", path.join(blockedPath, "learning"));
    vi.resetModules();
    const { getLearningStore } = await import("./learning-store");
    const store = await getLearningStore();
    expect(store.snapshot()).toMatchObject({ storage: "temporary", storesImages: false, storesQrPayload: false });
    expect(store.dataDir.startsWith(fallbackRoot.value + path.sep)).toBe(true);

    const payload = { x: 0.8, y: 0.2, span: 0.1, source: "zxing" };
    expect(await store.addMany([{ kind: "qr", payload }])).toMatchObject({ accepted: 1, rejected: 0 });
    expect(await store.addMany([{ kind: "qr", payload: { ...payload, qrText: "private content" } }]))
      .toMatchObject({ accepted: 0, rejected: 1 });
    expect(await readFile(store.filePath, "utf8")).not.toContain("private content");

    vi.resetModules();
    const restarted = await (await import("./learning-store")).getLearningStore();
    expect(restarted.snapshot()).toMatchObject({ storage: "temporary", counts: { qr: 1, corner: 0 } });
    expect(restarted.snapshot().qr[0]).toMatchObject(payload);

    // Recover the same configured primary path, then restart twice: accepted
    // temporary samples must return to primary storage exactly once.
    await rm(blockedPath);
    vi.resetModules();
    const recovered = await (await import("./learning-store")).getLearningStore();
    expect(recovered.snapshot()).toMatchObject({ storage: "server", counts: { qr: 1, corner: 0 } });
    expect(recovered.snapshot().qr[0]).toMatchObject(payload);
    await recovered.addMany(Array.from({ length: 20_001 }, (_, index) => ({
      kind: "qr", payload: { ...payload, source: `zxing-${index}` },
    })));
    vi.resetModules();
    const recoveredAgain = await (await import("./learning-store")).getLearningStore();
    expect(recoveredAgain.snapshot()).toMatchObject({ storage: "server", counts: { qr: 20_002, corner: 0 } });
  });
});
