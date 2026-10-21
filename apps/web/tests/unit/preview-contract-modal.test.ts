import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/contracts/PreviewContractModal.tsx", "utf8");

describe("PreviewContractModal server-backed loading", () => {
  it("waits for the export response and aborts an obsolete request without a synthetic percentage ticker", () => {
    expect(source).toContain("const controller = new AbortController()");
    expect(source).toContain("signal: controller.signal");
    expect(source).toContain("controller.abort()");
    expect(source).toContain('setProgressStatus("Đang chờ máy chủ tạo hợp đồng PDF...")');
    expect(source).toContain('setProgressStatus("Đang tải tài liệu từ máy chủ...")');
    expect(source).toContain("const blob = await res.blob()");
    expect(source).not.toContain("setInterval(");
    expect(source).not.toMatch(/progress(?:Percent|Value|\s*=\s*\d+)/i);
  });
});
