"use client";

import React, { memo, useMemo } from "react";
import type { Room } from "../building.types";
import { toRoomOperationalItem } from "../views/visualizer/buildingOperationalAdapter";
import type { RoomSecondaryWarning } from "../views/visualizer/building-view.types";
import type { CockpitFloorSpec, CockpitRoomSpec } from "./building-cockpit.types";
import { getStatusLabel, getStatusTone } from "./building-cockpit-metrics";

export interface FloorRoomTableProps {
  floor: CockpitFloorSpec;
  selectedRoomCode?: string | null;
  highlightedRoomCode?: string | null;
  onSelectRoom: (room: CockpitRoomSpec) => void;
  onHoverRoom?: (roomCode: string | null) => void;
  className?: string;
}

const EMPTY_VALUE = "—";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeRoomCode(value: string | null | undefined) {
  return (value || "").trim().replace(/\s+/g, "-").toUpperCase();
}

function matchesRoom(roomCode: string | null | undefined, room: CockpitRoomSpec) {
  const normalized = normalizeRoomCode(roomCode);
  return Boolean(normalized) && [room.code, room.urlCode, room.id].some((value) => normalizeRoomCode(value) === normalized);
}

function getTenantNames(sourceRoom: Room | undefined) {
  if (!sourceRoom) return [];
  const residents = sourceRoom.rentalType === "shared"
    ? sourceRoom.sharedTenants || []
    : [sourceRoom.tenant, ...(sourceRoom.roommates || [])].filter(Boolean);

  return Array.from(new Set(residents
    .map((resident) => resident?.fullName?.trim() || resident?.name?.trim())
    .filter((name): name is string => Boolean(name))));
}

function getTenantLabel(sourceRoom: Room | undefined) {
  const names = getTenantNames(sourceRoom);
  if (!names.length) return EMPTY_VALUE;
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

function getContractEndDate(room: CockpitRoomSpec) {
  const directEndDate = room.sourceRoom?.contract?.endDate || room.contract?.endDate;
  if (directEndDate) return directEndDate;

  const sharedEndDates = (room.sourceRoom?.sharedTenants || [])
    .map((tenant) => tenant.endDate)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  return sharedEndDates[0];
}

function formatDate(value: string | undefined) {
  if (!value) return EMPTY_VALUE;
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat("vi-VN").format(parsed);
}

function getWarnings(sourceRoom: Room | undefined) {
  return sourceRoom ? toRoomOperationalItem(sourceRoom).warnings : [];
}

function AlertCell({ warnings }: { warnings: RoomSecondaryWarning[] }) {
  if (!warnings.length) return <span className="text-[12px] font-semibold text-slate-400">{EMPTY_VALUE}</span>;
  const warning = warnings[0];
  const label = warnings.length > 1 ? `${warning.label} +${warnings.length - 1}` : warning.label;

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-bold leading-4",
        warning.type === "danger" ? "bg-rose-50 text-rose-700" : "bg-orange-50 text-orange-700",
      )}
      title={warnings.map((item) => item.label).join(" · ")}
    >
      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", warning.type === "danger" ? "bg-rose-500" : "bg-orange-500")} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function FloorRoomTable({
  floor,
  selectedRoomCode = null,
  highlightedRoomCode = null,
  onSelectRoom,
  onHoverRoom,
  className,
}: FloorRoomTableProps) {
  const rows = useMemo(() => floor.rooms.map((room) => ({
    room,
    tenantLabel: getTenantLabel(room.sourceRoom),
    contractEndLabel: formatDate(getContractEndDate(room)),
    warnings: getWarnings(room.sourceRoom),
  })), [floor.rooms]);

  return (
    <div className={cx("w-full overflow-x-auto rounded-[12px] border border-border/70 bg-card shadow-[0_8px_20px_rgb(var(--shadow-color)/0.035)]", className)}>
      <table className="w-full min-w-[520px] border-collapse text-left">
        <caption className="sr-only">Danh sách phòng {floor.label}</caption>
        <thead>
          <tr className="border-b border-border/70 bg-surface/55 text-[12px] font-black text-muted">
            <th scope="col" className="px-3 py-2.5">Phòng</th>
            <th scope="col" className="px-3 py-2.5">Loại phòng</th>
            <th scope="col" className="px-3 py-2.5">Tình trạng</th>
            <th scope="col" className="px-3 py-2.5">Khách thuê</th>
            <th scope="col" className="px-3 py-2.5">HĐ hết hạn</th>
            <th scope="col" className="px-3 py-2.5">Cảnh báo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ room, tenantLabel, contractEndLabel, warnings }) => {
            const selected = matchesRoom(selectedRoomCode, room);
            const highlighted = matchesRoom(highlightedRoomCode, room);
            const status = room.sourceRoom?.status || room.status;
            const tone = getStatusTone(status);
            const hasOperationalData = Boolean(room.sourceRoom);
            return (
              <tr
                key={room.id}
                data-room-code={room.urlCode}
                aria-selected={selected}
                onClick={() => onSelectRoom(room)}
                onMouseEnter={() => onHoverRoom?.(room.urlCode)}
                onMouseLeave={() => onHoverRoom?.(null)}
                className={cx(
                  "cursor-pointer border-b border-border/45 text-[12px] text-slate-600 transition-[background-color,box-shadow] last:border-b-0 motion-reduce:transition-none",
                  selected ? "bg-primary/[0.075] shadow-[inset_3px_0_0_var(--primary)]" : highlighted ? "bg-primary/[0.035]" : "hover:bg-surface/45",
                )}
              >
                <th scope="row" className="px-3 py-2.5">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onFocus={() => onHoverRoom?.(room.urlCode)}
                    onBlur={() => onHoverRoom?.(null)}
                    className="rounded-md text-[12px] font-black text-slate-950 underline-offset-4 hover:text-[#5b35f5] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5] focus-visible:ring-offset-2"
                  >
                    {room.code}
                  </button>
                </th>
                <td className="max-w-[200px] px-3 py-2.5 font-semibold text-slate-600"><span className="block truncate" title={room.type}>{room.type}</span></td>
                <td className="px-3 py-2.5">
                  <span
                    className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[12px] font-bold", !hasOperationalData && "bg-slate-100 text-slate-500")}
                    style={hasOperationalData ? { background: tone.bg, color: tone.text } : undefined}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: hasOperationalData ? tone.dot : "#94a3b8" }} />
                    {hasOperationalData ? getStatusLabel(status) : "Chưa đồng bộ"}
                  </span>
                </td>
                <td className="max-w-[180px] px-3 py-2.5 font-semibold text-slate-700"><span className="block truncate" title={tenantLabel === EMPTY_VALUE ? undefined : tenantLabel}>{tenantLabel}</span></td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-slate-700">{contractEndLabel}</td>
                <td className="max-w-[190px] px-3 py-2.5"><AlertCell warnings={warnings} /></td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-[12px] font-semibold text-slate-500">Chưa có dữ liệu phòng</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default memo(FloorRoomTable);
