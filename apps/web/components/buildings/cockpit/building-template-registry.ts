export type BuildingTemplateId = "LK01_STANDARD" | "LK08_STANDARD";
export type BuildingLayoutStatus = "configured" | "pending";

export interface BuildingTemplateDescriptor {
  code: string;
  aliases: string[];
  templateId: BuildingTemplateId;
  layoutStatus: BuildingLayoutStatus;
  roomPrefix: string | null;
}

export const buildingTemplateRegistry: readonly BuildingTemplateDescriptor[] = [
  { code: "LK01-31", aliases: ["LK01.31"], templateId: "LK01_STANDARD", layoutStatus: "configured", roomPrefix: "31" },
  { code: "LK01-32", aliases: ["LK01.32"], templateId: "LK01_STANDARD", layoutStatus: "configured", roomPrefix: "32" },
  { code: "LK08-24", aliases: ["LK08.24"], templateId: "LK08_STANDARD", layoutStatus: "configured", roomPrefix: "P24" },
  { code: "LK08-25", aliases: ["LK08.25"], templateId: "LK08_STANDARD", layoutStatus: "configured", roomPrefix: "P25" },
] as const;

export function normalizeBuildingCode(value = "") {
  return value.trim().toUpperCase().replace(/\./g, "-").replace(/\s+/g, "");
}

export function resolveBuildingTemplate(value = "") {
  const normalized = normalizeBuildingCode(value);
  return buildingTemplateRegistry.find((item) => item.code === normalized || item.aliases.some((alias) => normalizeBuildingCode(alias) === normalized)) || null;
}

export function isSupportedBuildingCode(value = "") {
  return resolveBuildingTemplate(value) !== null;
}
