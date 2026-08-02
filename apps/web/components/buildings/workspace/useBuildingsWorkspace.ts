"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Building, Floor, Room } from "../building.types";
import { adaptBuildingForLK01_31, adaptBuildingGeneral } from "./lk01-31-data";

export type ViewMode = "overview" | "floor-3d" | "floor-2d" | "rooms";

export function useBuildingsWorkspace(buildings: Building[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Adapt the database building list to follow the strict product mapping
  const adaptedBuildings = useMemo(() => {
    return buildings.map(b => {
      const bCode = b.code || "";
      const codeClean = bCode.replace('.', '-').toUpperCase();
      if (codeClean === "LK01-31") {
        return adaptBuildingForLK01_31(b);
      }
      if (codeClean === "LK01-32") {
        return adaptBuildingGeneral(b, "LK01-32", "LK01-32");
      }
      if (codeClean === "LK08-24") {
        return adaptBuildingGeneral(b, "LK08-24", "LK08-24");
      }
      if (codeClean === "LK08-25") {
        return adaptBuildingGeneral(b, "LK08-25", "LK08-25");
      }
      return b;
    });
  }, [buildings]);

  // 1. Parse active building
  const activeBuilding = useMemo(() => {
    const buildingParam = searchParams.get("building");
    if (buildingParam) {
      return adaptedBuildings.find(b => b.id === buildingParam || b.code === buildingParam) || adaptedBuildings[0] || null;
    }
    return adaptedBuildings[0] || null;
  }, [adaptedBuildings, searchParams]);

  // 2. Parse active view mode
  const activeView = useMemo((): ViewMode => {
    const viewParam = searchParams.get("view");
    if (viewParam === "floor-2d" || viewParam === "floor-3d") return "floor-2d";
    if (viewParam === "rooms") return "overview";
    return "overview";
  }, [searchParams]);

  // 3. Parse active floor & room
  const activeFloor = useMemo(() => {
    const floorParam = searchParams.get("floor");
    if (!activeBuilding) return null;

    const matchedFloor = floorParam
      ? activeBuilding.floors.find(f => f.id === floorParam) || null
      : null;

    if (matchedFloor) return matchedFloor;
    if (activeView === "floor-2d") return activeBuilding.floors[0] || null;
    return null;
  }, [activeBuilding, activeView, searchParams]);

  const activeRoom = useMemo(() => {
    const roomParam = searchParams.get("room");
    if (!roomParam || !activeFloor) return null;
    return activeFloor.rooms.find(r => r.id === roomParam) || null;
  }, [activeFloor, searchParams]);

  // Keep shared/deep links canonical now that the workspace exposes only two
  // modes. Invalid or missing floor ids resolve to the first real floor instead
  // of leaving an empty visualizer.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const requestedView = params.get("view");
    let changed = false;

    if (requestedView === "floor-3d") {
      params.set("view", "floor-2d");
      changed = true;
    } else if (requestedView === "rooms") {
      params.set("view", "overview");
      changed = true;
    }

    if (activeView === "floor-2d" && activeFloor && params.get("floor") !== activeFloor.id) {
      params.set("floor", activeFloor.id);
      params.delete("room");
      changed = true;
    }

    if (changed) router.replace(`${pathname}?${params.toString()}`);
  }, [activeFloor, activeView, pathname, router, searchParams]);

  // 4. Switch Building
  const selectBuilding = useCallback((buildingId: string) => {
    const params = new URLSearchParams();
    params.set("building", buildingId);
    params.set("view", "overview"); // reset view to overview
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname]);

  // 5. Switch View Mode
  const selectViewMode = useCallback((view: ViewMode) => {
    const canonicalView: ViewMode = view === "floor-2d" || view === "floor-3d" ? "floor-2d" : "overview";
    if (canonicalView === activeView && searchParams.get("view") === canonicalView) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("view", canonicalView);
    
    // Auto-select floor if moving to floor view and none selected
    if (canonicalView === "floor-2d" && !params.get("floor") && activeBuilding && activeBuilding.floors.length > 0) {
      params.set("floor", activeBuilding.floors[0].id);
    }

    router.push(`${pathname}?${params.toString()}`);
  }, [activeBuilding, activeView, pathname, router, searchParams]);

  // 6. Switch Floor
  const selectFloor = useCallback((floorId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "floor-2d");
    params.set("floor", floorId);
    params.delete("room"); 
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  // 7. Switch Room
  const selectRoom = useCallback((roomId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("room", roomId);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  // Atomically select a room from the building overview so the URL never
  // contains a room that is detached from its floor context.
  const selectFloorRoom = useCallback((floorId: string, roomId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("floor", floorId);
    params.set("room", roomId);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  // 8. Close Room Drawer
  const closeRoomDrawer = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("room");
    router.replace(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  // 9. Go Back to Overview
  const goBackToOverview = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "overview");
    params.delete("floor");
    params.delete("room");
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  return {
    adaptedBuildings,
    activeBuilding,
    activeView,
    activeFloor,
    activeRoom,
    selectBuilding,
    selectViewMode,
    selectFloor,
    selectRoom,
    selectFloorRoom,
    closeRoomDrawer,
    goBackToOverview,
  };
}
