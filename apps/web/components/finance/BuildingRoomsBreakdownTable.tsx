"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Home,
  Search,
  Sparkles,
} from "lucide-react";
import { formatVnd } from "@/lib/utils/format";

interface BuildingRoomsBreakdownTableProps {
  onSelectBuilding: (buildingCode: string) => void;
}

export default function BuildingRoomsBreakdownTable({
  onSelectBuilding,
}: BuildingRoomsBreakdownTableProps) {
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const buildings = [
    {
      code: "LK01.32",
      name: "Tòa LK01 - 32 phòng",
      owner: "Phan Văn Thế",
      ownerCode: "OWNER-B",
      occupancy: 29,
      totalRooms: 7,
      rentedRooms: 2,
      rent: 8533334,
      electricity: 549271,
      water: 200000,
      totalRevenue: 9282605,
      expense: 0,
      netProfit: 9282605,
      deposit: 7000000,
      status: "ACTIVE",
    },
    {
      code: "LK01.31",
      name: "Tòa LK01 - 31 phòng",
      owner: "Nguyễn Đức Tính",
      ownerCode: "OWNER-A",
      occupancy: 14,
      totalRooms: 7,
      rentedRooms: 1,
      rent: 4266667,
      electricity: 765353,
      water: 100000,
      totalRevenue: 5132020,
      expense: 0,
      netProfit: 5132020,
      deposit: 8000000,
      status: "ACTIVE",
    },
    {
      code: "LK08.24",
      name: "Tòa LK08 - 24 phòng",
      owner: "Phan Văn Thế",
      ownerCode: "OWNER-B",
      occupancy: 10,
      totalRooms: 10,
      rentedRooms: 1,
      rent: 4266667,
      electricity: 0,
      water: 100000,
      totalRevenue: 4366667,
      expense: 0,
      netProfit: 4366667,
      deposit: 0,
      status: "ACTIVE",
    },
    {
      code: "LK08.25",
      name: "Tòa LK08 - 25 phòng",
      owner: "Nguyễn Đức Tính",
      ownerCode: "OWNER-A",
      occupancy: 0,
      totalRooms: 10,
      rentedRooms: 0,
      rent: 0,
      electricity: 0,
      water: 0,
      totalRevenue: 0,
      expense: 0,
      netProfit: 0,
      deposit: 0,
      status: "EMPTY",
    },
  ];

  const filtered = buildings.filter((b) => {
    if (selectedOwnerFilter !== "all" && b.ownerCode !== selectedOwnerFilter) {
      return false;
    }
    if (
      searchQuery &&
      !b.code.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !b.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-4">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Building2 size={16} />
          </span>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
              Bảng Hiệu Quả Doanh Thu & Lợi Nhuận Theo Tòa Nhà
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Số liệu bóc tách độc lập từng tòa nhà, phân định rõ theo từng chủ sở hữu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Owner Filter */}
          <select
            value={selectedOwnerFilter}
            onChange={(e) => setSelectedOwnerFilter(e.target.value)}
            className="h-8 rounded-lg border border-border/70 bg-surface/50 px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
          >
            <option value="all">Tất cả chủ sở hữu</option>
            <option value="OWNER-A">Chủ A: Nguyễn Đức Tính</option>
            <option value="OWNER-B">Chủ B: Phan Văn Thế</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã tòa..."
              className="h-8 w-32 rounded-lg border border-border/70 bg-surface/40 pl-7 pr-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground outline-none focus:border-primary sm:w-44"
            />
          </div>
        </div>
      </div>

      {/* Modern High-Density Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="border-b border-border/60 bg-surface/50 text-[10px] font-black uppercase text-muted-foreground">
            <tr>
              <th className="px-3.5 py-2.5">Tòa nhà</th>
              <th className="px-3.5 py-2.5">Chủ sở hữu</th>
              <th className="px-3.5 py-2.5 text-center">Tỷ lệ lấp đầy</th>
              <th className="px-3.5 py-2.5 text-right">Thuê phòng</th>
              <th className="px-3.5 py-2.5 text-right">Điện</th>
              <th className="px-3.5 py-2.5 text-right">Nước & DV</th>
              <th className="px-3.5 py-2.5 text-right font-black">Tổng doanh thu</th>
              <th className="px-3.5 py-2.5 text-right">Chi phí trừ</th>
              <th className="px-3.5 py-2.5 text-right text-emerald-600 font-black">
                Lãi ròng P&L
              </th>
              <th className="px-3.5 py-2.5 text-right text-sky-600">Tiền cọc giữ</th>
              <th className="px-3.5 py-2.5 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-medium">
            {filtered.map((b) => (
              <tr
                key={b.code}
                className="hover:bg-surface/50 transition-colors group cursor-pointer"
                onClick={() => onSelectBuilding(b.code)}
              >
                {/* Tòa nhà */}
                <td className="px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-foreground group-hover:text-primary transition-colors">
                      {b.code}
                    </span>
                    {b.status === "EMPTY" && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                        Chưa có khách
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground block">{b.name}</span>
                </td>

                {/* Chủ sở hữu */}
                <td className="px-3.5 py-3">
                  <span className="font-bold text-foreground block">{b.owner}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {b.ownerCode}
                  </span>
                </td>

                {/* Lấp đầy */}
                <td className="px-3.5 py-3 text-center">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="font-mono font-bold text-foreground">
                      {b.occupancy}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ({b.rentedRooms}/{b.totalRooms} phòng)
                    </span>
                  </div>
                  <div className="mx-auto mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-border/50">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${b.occupancy}%` }}
                    />
                  </div>
                </td>

                {/* Thuê phòng */}
                <td className="px-3.5 py-3 text-right font-mono text-foreground">
                  {formatVnd(b.rent)}
                </td>

                {/* Điện */}
                <td className="px-3.5 py-3 text-right font-mono text-amber-600 dark:text-amber-400">
                  {formatVnd(b.electricity)}
                </td>

                {/* Nước */}
                <td className="px-3.5 py-3 text-right font-mono text-sky-600 dark:text-sky-400">
                  {formatVnd(b.water)}
                </td>

                {/* Tổng thu */}
                <td className="px-3.5 py-3 text-right font-mono font-bold text-foreground">
                  {formatVnd(b.totalRevenue)}
                </td>

                {/* Chi phí */}
                <td className="px-3.5 py-3 text-right font-mono text-rose-500">
                  {b.expense > 0 ? `-${formatVnd(b.expense)}` : "0 đ"}
                </td>

                {/* Lãi ròng */}
                <td className="px-3.5 py-3 text-right font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatVnd(b.netProfit)}
                </td>

                {/* Tiền cọc */}
                <td className="px-3.5 py-3 text-right font-mono font-bold text-sky-600 dark:text-sky-400">
                  {formatVnd(b.deposit)}
                </td>

                {/* Action */}
                <td className="px-3.5 py-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBuilding(b.code);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs transition hover:border-primary hover:text-primary"
                  >
                    <Eye size={12} />
                    <span>Xem phòng</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Table Footer Summary Row */}
          <tfoot>
            <tr className="border-t-2 border-border/80 bg-muted/20 font-bold">
              <td colSpan={3} className="px-3.5 py-3 text-left font-black uppercase text-xs tracking-wider text-foreground">
                Tổng cộng toàn hệ thống (4 tòa nhà)
              </td>
              <td className="px-3.5 py-3 text-right font-mono text-xs font-black text-foreground">
                {formatVnd(17066668)}
              </td>
              <td className="px-3.5 py-3 text-right font-mono text-xs font-black text-amber-600 dark:text-amber-400">
                {formatVnd(1314624)}
              </td>
              <td className="px-3.5 py-3 text-right font-mono text-xs font-black text-sky-600 dark:text-sky-400">
                {formatVnd(400000)}
              </td>
              <td className="px-3.5 py-3 text-right font-mono text-xs font-black text-primary">
                {formatVnd(18781292)}
              </td>
              <td className="px-3.5 py-3 text-right font-mono text-xs font-black text-rose-500">
                0 đ
              </td>
              <td className="px-3.5 py-3 text-right font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                {formatVnd(18781292)}
              </td>
              <td className="px-3.5 py-3 text-right font-mono text-xs font-black text-sky-600 dark:text-sky-400">
                {formatVnd(15000000)}
              </td>
              <td className="px-3.5 py-3 text-center text-xs text-muted-foreground font-normal">
                4 tòa hợp nhất
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
