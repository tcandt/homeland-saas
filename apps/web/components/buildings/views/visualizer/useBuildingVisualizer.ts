"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function useBuildingVisualizer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Hover sync states
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const [hoveredFloorId, setHoveredFloorId] = useState<string | null>(null);

  // Active Floor & Room parsed directly from URL parameters
  const activeFloorId = useMemo(() => {
    return searchParams.get("floor");
  }, [searchParams]);

  const activeRoomId = useMemo(() => {
    return searchParams.get("room");
  }, [searchParams]);

  // Navigate to standard floor view parameter
  const selectFloor = useCallback((floorId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("floor", floorId);
    params.delete("room"); // clear room selection when floor changes
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  // Navigate to detailed room drawer parameter
  const selectRoom = useCallback((roomId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("room", roomId);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  // Close the right details drawer overlay
  const closeRoomDrawer = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("room");
    // Use router.replace to avoid cluttering history when closing drawers
    router.replace(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  // Back to building general overview mode
  const goBackToOverview = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("floor");
    params.delete("room");
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  return {
    activeFloorId,
    activeRoomId,
    hoveredRoomId,
    setHoveredRoomId,
    hoveredFloorId,
    setHoveredFloorId,
    selectFloor,
    selectRoom,
    closeRoomDrawer,
    goBackToOverview,
  };
}
