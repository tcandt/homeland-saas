import { describe, expect, it, vi } from "vitest";
import { amountToVietnameseWords } from "./notification-sounds";

describe("notification speech helpers", () => {
  it("creates and resumes audio only during a user gesture", async () => {
    vi.resetModules();
    const resume = vi.fn().mockResolvedValue(undefined);
    const construct = vi.fn();
    const activation = { isActive: false };
    class AudioContext {
      state = "suspended";
      constructor() { construct(); }
      resume = resume;
    }
    vi.stubGlobal("window", { AudioContext });
    vi.stubGlobal("navigator", { userActivation: activation });
    try {
      const { unlockNotificationAudio } = await import("./notification-sounds");
      expect(await unlockNotificationAudio()).toBe(false);
      expect(construct).not.toHaveBeenCalled();
      activation.isActive = true;
      await unlockNotificationAudio();
      expect(construct).toHaveBeenCalledOnce();
      expect(resume).toHaveBeenCalledOnce();
      activation.isActive = false;
      await unlockNotificationAudio();
      expect(resume).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
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
