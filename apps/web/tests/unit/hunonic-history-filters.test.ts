import { describe, expect, it, vi } from "vitest";
import {
  getHunonicHistoryFilterOptions,
  toHunonicHistoryParams,
  updateHunonicHistoryFilter,
} from "../../lib/hunonic/history-filters";

describe("Hunonic history filters", () => {
  it("passes the selected room and only supported filter values to the history API", () => {
    expect(toHunonicHistoryParams({
      search: "  P101  ",
      building: "LK01-32",
      room: "P101",
      year: "2026",
      month: "8",
      page: 3,
    })).toEqual({
      search: "P101",
      buildingCode: "LK01-32",
      roomCode: "P101",
      year: "2026",
      month: "8",
      page: 3,
      limit: 20,
    });
  });

  it("resets the history page whenever a filter changes", () => {
    const setRoom = vi.fn();
    const setPage = vi.fn();

    updateHunonicHistoryFilter(setRoom, setPage, "P101");

    expect(setRoom).toHaveBeenCalledWith("P101");
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it("derives options from response metadata and never fabricates missing options", () => {
    expect(getHunonicHistoryFilterOptions()).toEqual({
      rooms: [],
      buildings: [],
      years: [],
      months: [],
    });

    expect(getHunonicHistoryFilterOptions(
      {
        rooms: [
          { buildingCode: "LK01-32", roomCode: "P101", displayName: "P101" },
          { buildingCode: "LK01-31", roomCode: "P201" },
        ],
        availableYears: [2026, 2025],
      },
      [{ period: "2026-08" }, { period: "2025-01" }, { period: "invalid" }],
    )).toEqual({
      rooms: [
        { buildingCode: "LK01-32", roomCode: "P101", displayName: "P101" },
        { buildingCode: "LK01-31", roomCode: "P201" },
      ],
      buildings: ["LK01-31", "LK01-32"],
      years: ["2026", "2025"],
      months: [1, 8],
    });
  });
});
