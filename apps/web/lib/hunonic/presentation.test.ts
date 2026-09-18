import { describe, expect, it } from "vitest";
import { formatHunonicHistoryValue, resolveHunonicRateMode } from "./presentation";

describe("Hunonic presentation", () => {
  it("renders a provider zero reading rather than treating it as missing", () => {
    expect(formatHunonicHistoryValue(0, (value) => `${value} kWh`)).toBe("0 kWh");
    expect(formatHunonicHistoryValue(null, (value) => `${value} kWh`)).toBe("—");
  });

  it("uses live residential state ahead of stale stored custom state", () => {
    expect(resolveHunonicRateMode("residential", "custom")).toBe("residential");
  });
});
