"use client";

import { Building2, Pencil, Plus } from "lucide-react";
import type { Building } from "../building.types";
import { normalizeBuildingCode } from "./building-template-registry";

interface Props {
  buildings: Building[];
  requestedCode: string;
  onSelect: (code: string) => void;
  onAdd?: () => void;
  onEdit?: (id: string) => void;
}

export default function BuildingDirectory({ buildings, requestedCode, onSelect, onAdd, onEdit }: Props) {
  const missing = requestedCode && !buildings.some(item => normalizeBuildingCode(item.code || item.name) === requestedCode);
  return (
    <section data-testid="building-directory" className="w-full min-w-0 space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-text">Tòa nhà</h2>
        {onAdd && <button type="button" onClick={onAdd} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
          <Plus size={16} aria-hidden="true" /> Thêm tòa nhà
        </button>}
      </div>
      {buildings.length === 0 ? (
        <div data-testid="empty-buildings-state" className="flex flex-col items-center gap-3 py-12 text-center">
          <Building2 size={32} className="text-muted" aria-hidden="true" />
          <p className="text-sm font-semibold text-muted">Chưa có tòa nhà nào.</p>
        </div>
      ) : (
        <>
          {missing && <p role="status" className="break-words text-sm text-muted">Không tìm thấy tòa nhà {requestedCode} trong dữ liệu hiện tại.</p>}
          <div className="divide-y divide-border border-y border-border">
            {buildings.map(item => {
              const code = normalizeBuildingCode(item.code || item.name);
              return (
                <div key={item.id} className="flex min-w-0 items-center gap-3 py-4">
                  <Building2 size={22} className="shrink-0 text-muted" aria-hidden="true" />
                  <button type="button" onClick={() => onSelect(code)} className="min-w-0 flex-1 text-left">
                    <span className="block break-words text-sm font-semibold text-text">{item.name}</span>
                    <span className="block break-words text-xs text-muted">{code} · {item.address}</span>
                    <span className="mt-1 block text-xs text-muted">{item.floors.length} tầng · {item.floors.reduce((total, floor) => total + floor.rooms.length, 0)} phòng</span>
                  </button>
                  {onEdit && <button type="button" title="Chỉnh sửa tòa nhà" aria-label={`Chỉnh sửa ${item.name}`} onClick={() => onEdit(item.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:text-text">
                    <Pencil size={16} aria-hidden="true" />
                  </button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
