export type CanonicalRoomType = "1 phòng ngủ" | "2 phòng ngủ" | "Văn phòng";

export type RoomTypeResolutionSource = "metadata" | "building-map" | "default";

export type RoomTypeResolution = {
  value: CanonicalRoomType;
  source: RoomTypeResolutionSource;
};

export type RoomTypeIdentity = {
  roomType?: unknown;
  type?: unknown;
  code?: unknown;
  buildingCode?: unknown;
  buildingName?: unknown;
};

function normalize(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeRoomType(value: unknown): CanonicalRoomType | undefined {
  const normalized = normalize(value);
  if (normalized.includes("2pn") || normalized.includes("2phongngu")) return "2 phòng ngủ";
  if (normalized.includes("1pn") || normalized.includes("1phongngu") || normalized.includes("studio")) {
    return "1 phòng ngủ";
  }
  if (normalized.includes("vanphong") || normalized.includes("office")) return "Văn phòng";
  return undefined;
}

export function normalizeRoomTypeSetting(value: unknown): CanonicalRoomType | "Khác" | undefined {
  return normalizeRoomType(value) || (normalize(value) === "khac" ? "Khác" : undefined);
}

function isLk0131OrLk0132(value: unknown): boolean {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase();
  return /(?:^|[^A-Z0-9])LK\s*0?1\s*[.-]?\s*3[12](?:$|[^A-Z0-9])/.test(normalized);
}

function roomSuffix(code: unknown): string | undefined {
  const matched = String(code || "").match(/(?:^|\D)(0[1-9])\s*$/);
  return matched?.[1];
}

export function getRoomTypeResolution(identity: RoomTypeIdentity): RoomTypeResolution {
  const explicit = normalizeRoomType(identity.roomType) || normalizeRoomType(identity.type);
  if (explicit) return { value: explicit, source: "metadata" };

  const isMappedBuilding =
    isLk0131OrLk0132(identity.buildingCode) || isLk0131OrLk0132(identity.buildingName);
  const suffix = roomSuffix(identity.code);
  if (isMappedBuilding && (suffix === "02" || suffix === "04" || (suffix === "06" && !/LK0?1[.-]?32/i.test(String(identity.buildingCode || identity.buildingName || ""))))) {
    return { value: "2 phòng ngủ", source: "building-map" };
  }

  return { value: "1 phòng ngủ", source: "default" };
}

export function resolveRoomType(identity: RoomTypeIdentity): CanonicalRoomType {
  return getRoomTypeResolution(identity).value;
}

export function toUiRoomType(value: CanonicalRoomType): "1PN" | "2PN" | "Office" {
  if (value === "2 phòng ngủ") return "2PN";
  if (value === "Văn phòng") return "Office";
  return "1PN";
}
