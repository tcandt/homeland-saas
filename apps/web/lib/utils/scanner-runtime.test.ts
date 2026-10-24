import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(resolve(process.cwd(), "public/qr/scanner-runtime.js"), "utf8");
function runtime() {
  const revokeObjectURL = vi.fn();
  class Image {
    onload!: () => void;
    onerror!: () => void;
    set src(url: string) { queueMicrotask(() => url === "bad" ? this.onerror() : this.onload()); }
  }
  const window: any = {};
  runInNewContext(source, { window, Image, URL: { revokeObjectURL }, Date, setTimeout });
  return { ...window.CCCDScannerRuntime, revokeObjectURL };
}
describe("embedded scanner runtime", () => {
  it("waits for Mat bindings, not just imread", async () => {
    const { waitForOpenCv } = runtime();
    const cv: any = { imread() {} };
    let ready = false;
    const pending = waitForOpenCv(cv).then(() => { ready = true; });
    await Promise.resolve();
    expect(ready).toBe(false);
    cv.Mat = class {};
    await pending;
    expect(ready).toBe(true);
  });
  it("rejects initialization timeout", async () => {
    await expect(runtime().waitForOpenCv({}, 0)).rejects.toThrow("CCCD_OPENCV_INITIALIZATION_TIMEOUT");
  });
  it("propagates asynchronous detection failures and releases the image", async () => {
    const api = runtime();
    await expect(api.loadImage("image", async () => { throw Error("detection failed"); })).rejects.toThrow("detection failed");
    await Promise.resolve();
    expect(api.revokeObjectURL).toHaveBeenCalledWith("image");
  });
  it("waits for detection to finish and rejects unreadable images", async () => {
    const api = runtime();
    expect(await api.loadImage("image", async () => "detected")).toBe("detected");
    await expect(api.loadImage("bad", () => {})).rejects.toThrow("CCCD_IMAGE_LOAD_FAILED");
    expect(api.revokeObjectURL).toHaveBeenCalledWith("bad");
  });
});
