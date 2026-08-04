"use client";

import React from "react";
import Link from "next/link";
import { Building2, ChevronRight, Loader2, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useBuildingsQuery } from "@/lib/queries/buildings.queries";

function getBuildingStats(building: any) {
  const floors = building.floors || [];
  const rooms = floors.flatMap((floor: any) => floor.rooms || []);
  const occupied = rooms.filter((room: any) => room.status === "occupied" || room.status === "expiring_soon").length;
  const available = rooms.filter((room: any) => room.status === "vacant").length;
  const revenue = rooms.reduce((sum: number, room: any) => sum + (room.status === "occupied" || room.status === "expiring_soon" ? Number(room.monthlyPrice || room.price || 0) : 0), 0);
  const occupancyRate = rooms.length > 0 ? Math.round((occupied / rooms.length) * 100) : 0;

  return { floors: floors.length, rooms: rooms.length, occupied, available, revenue, occupancyRate };
}

export default function BuildingGrid() {
  const { data: buildings = [], isLoading, isError } = useBuildingsQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#4f46e5]" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="Không tải được dữ liệu tòa nhà từ API." />;
  }

  if (buildings.length === 0) {
    return <EmptyState title="Chưa có tòa nhà" message="Khi tạo tòa nhà trong DB, danh sách sẽ hiển thị tại đây." />;
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-[16px] text-text">Danh sách tòa nhà</h2>
        <span className="text-[12px] font-bold text-muted">{buildings.length} tòa nhà</span>
      </div>

      <div data-testid="building-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {buildings.map((building: any) => {
          const stats = getBuildingStats(building);
          const code = building.code || building.name || building.id;

          return (
            <Link key={building.id} href={`/buildings/${code}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[16px]">
              <Card className="p-4 flex flex-col gap-4 hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-[52px] h-[52px] rounded-[14px] bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/15">
                      <Building2 size={22} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-[17px] text-text truncate">{code}</h3>
                      <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-muted truncate">
                        <MapPin size={12} /> {building.address || "Chưa cập nhật địa chỉ"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted shrink-0" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Tầng" value={stats.floors.toString()} />
                  <Stat label="Phòng" value={stats.rooms.toString()} />
                  <Stat label="Đang thuê" value={stats.occupied.toString()} />
                </div>

                <div className="rounded-[12px] bg-black/5 dark:bg-white/5 p-3">
                  <div className="mb-2 flex items-center justify-between text-[12px] font-bold">
                    <span className="text-muted">Tỷ lệ lấp đầy</span>
                    <span className="text-text">{stats.occupancyRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-background overflow-hidden border border-border/50">
                    <div className="h-full rounded-full bg-[#4f46e5]" style={{ width: `${stats.occupancyRate}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-muted">
                    <span>{stats.available} phòng trống</span>
                    <span>{stats.revenue.toLocaleString("vi-VN")} đ/tháng</span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-background p-2 text-center">
      <div className="text-[16px] font-black text-text">{value}</div>
      <div className="text-[10px] font-bold uppercase text-muted">{label}</div>
    </div>
  );
}
