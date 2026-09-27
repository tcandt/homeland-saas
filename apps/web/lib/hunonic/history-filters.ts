import type { HunonicHistoryParams } from "../api/hunonic.api";

export type HunonicHistoryFilters = {
  search: string;
  building: string;
  room: string;
  year: string;
  month: string;
  page: number;
};

type HunonicHistoryRoomOption = {
  buildingCode?: string | null;
  roomCode?: string | null;
  displayName?: string | null;
};

export function toHunonicHistoryParams(filters: HunonicHistoryFilters, limit = 20): HunonicHistoryParams {
  return {
    search: filters.search.trim() || undefined,
    buildingCode: filters.building !== "all" ? filters.building : undefined,
    roomCode: filters.room !== "all" ? filters.room : undefined,
    year: filters.year !== "all" ? filters.year : undefined,
    month: filters.month !== "all" ? filters.month : undefined,
    page: filters.page,
    limit,
  };
}

export function updateHunonicHistoryFilter<T>(
  setValue: (value: T) => void,
  setPage: (page: number) => void,
  value: T,
) {
  setValue(value);
  setPage(1);
}

export function getHunonicHistoryFilterOptions(
  filters?: { rooms?: unknown; availableYears?: unknown },
  monthlyRows?: unknown,
) {
  const rooms = Array.isArray(filters?.rooms)
    ? filters.rooms.filter((room): room is HunonicHistoryRoomOption => {
      const candidate = room as HunonicHistoryRoomOption | null;
      return Boolean(
        candidate
        && typeof candidate === "object"
        && typeof candidate.buildingCode === "string"
        && candidate.buildingCode.trim()
        && typeof candidate.roomCode === "string"
        && candidate.roomCode.trim(),
      );
    })
    : [];
  const buildings = Array.from(new Set(rooms.map((room) => room.buildingCode?.trim()).filter(Boolean) as string[])).sort();
  const years = Array.from(new Set(
    (Array.isArray(filters?.availableYears) ? filters.availableYears : [])
      .map((year) => String(year).trim())
      .filter(Boolean),
  )).sort((a, b) => Number(b) - Number(a));
  const months = Array.from(new Set(
    (Array.isArray(monthlyRows) ? monthlyRows : [])
      .map((row: any) => Number(String(row?.period || "").match(/^\d{4}-(\d{2})$/)?.[1]))
      .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12),
  )).sort((a, b) => a - b);

  return { rooms, buildings, years, months };
}
