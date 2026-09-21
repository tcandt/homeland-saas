import { describe, expect, it } from "vitest";
import { amountToVietnameseWords } from "./notification-sounds";

describe("notification speech helpers", () => {
  it("reads common payment amounts in Vietnamese", () => {
    expect(amountToVietnameseWords(1_000_000)).toBe("một triệu đồng");
    expect(amountToVietnameseWords(1_250_000)).toBe("một triệu hai trăm năm mươi nghìn đồng");
    expect(amountToVietnameseWords(50_000_000)).toBe("năm mươi triệu đồng");
  });

  it("handles zero and large grouped amounts", () => {
    expect(amountToVietnameseWords(0)).toBe("không đồng");
    expect(amountToVietnameseWords(1_000_000_000)).toBe("một tỷ đồng");
  });
});
