import { describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  access: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => fs);

describe("getLearningStore transient initialization", () => {
  it("retries after a writable-volume initialization failure instead of retaining the rejected promise", async () => {
    vi.resetModules();
    fs.mkdir.mockReset()
      .mockRejectedValueOnce(new Error("read-only volume"))
      .mockResolvedValueOnce(undefined);
    fs.readFile.mockReset().mockRejectedValue(Object.assign(new Error("no samples yet"), { code: "ENOENT" }));

    const { getLearningStore } = await import("./learning-store");
    await expect(getLearningStore()).rejects.toThrow("read-only volume");

    const recovered = await getLearningStore();
    expect(fs.mkdir).toHaveBeenCalledTimes(2);
    expect(recovered.snapshot()).toMatchObject({ storage: "server", storesImages: false });
  });
});
