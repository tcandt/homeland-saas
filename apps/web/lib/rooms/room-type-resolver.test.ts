import { describe, expect, it } from "vitest";
import { getRoomTypeResolution, normalizeRoomTypeSetting, resolveRoomType } from "./room-type-resolver";

describe("room type resolver", () => {
  it.each(["02", "04", "06"])("maps LK01.31 room %s to 2 bedrooms", (suffix) => {
    expect(resolveRoomType({ buildingCode: "LK01.31", code: `31-${suffix}` })).toBe("2 phòng ngủ");
  });

  it.each(["02", "04"])("maps LK01.32 room %s to 2 bedrooms", (suffix) => {
    expect(resolveRoomType({ buildingCode: "LK01.32", code: `32-${suffix}` })).toBe("2 phòng ngủ");
  });

  it("keeps LK01.32 room 32-06 as a large one-bedroom room", () => {
    expect(resolveRoomType({ buildingCode: "LK01.32", code: "32-06" })).toBe("1 phòng ngủ");
  });

  it("keeps LK01.32 room 32-01 as a standard one-bedroom room", () => {
    expect(resolveRoomType({ buildingName: "LK01.32", code: "32-01" })).toBe("1 phòng ngủ");
  });

  it.each(["31-01", "31-03"])("keeps studio room %s as one bedroom", (code) => {
    expect(resolveRoomType({ buildingCode: "LK01.31", code })).toBe("1 phòng ngủ");
  });

  it("does not apply suffix mapping outside LK01.31 and LK01.32", () => {
    expect(getRoomTypeResolution({ buildingCode: "LK02.31", code: "31-02" })).toEqual({
      value: "1 phòng ngủ",
      source: "default",
    });
  });

  it("does not infer bedrooms from shared-room bed count", () => {
    expect(resolveRoomType({ buildingCode: "LK01.31", code: "31-03", type: undefined })).toBe("1 phòng ngủ");
  });

  it("honors explicit metadata before the building mapping", () => {
    expect(getRoomTypeResolution({ buildingCode: "LK01.31", code: "31-01", roomType: "2 phòng ngủ" })).toEqual({
      value: "2 phòng ngủ",
      source: "metadata",
    });
  });

  it("keeps the existing manual Khác setting valid for the dropdown", () => {
    expect(normalizeRoomTypeSetting("Khác")).toBe("Khác");
  });
});
