"use client";

import { Building2, Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Building } from "../building.types";
import { buildingTemplateRegistry, normalizeBuildingCode } from "./building-template-registry";

interface BuildingSwitcherProps {
  buildings: Building[];
  activeCode: string;
  onSelect: (code: string) => void;
}

export default function BuildingSwitcher({ buildings, activeCode, onSelect }: BuildingSwitcherProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const byCode = new Map(buildings.map((building) => [normalizeBuildingCode(building.code || building.name), building]));
    return buildingTemplateRegistry
      .map((descriptor) => ({ descriptor, building: byCode.get(descriptor.code) }))
      .filter(({ descriptor, building }) => `${descriptor.code} ${building?.name || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  }, [buildings, query]);

  return (
    <div className="relative z-40">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 min-w-[154px] items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 text-[12px] font-black text-text shadow-sm transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
      >
        <span className="flex items-center gap-2"><Building2 size={15} className="text-primary" />{activeCode}</span>
        <ChevronDown size={14} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[280px] overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search size={15} className="text-muted" />
            <span className="sr-only">Tìm tòa nhà</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Tìm theo mã tòa nhà..." className="h-10 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted" />
          </label>
          <div role="listbox" aria-label="Danh sách tòa nhà" className="mt-2 space-y-1">
            {options.map(({ descriptor, building }) => (
              <button
                key={descriptor.code}
                type="button"
                role="option"
                aria-selected={descriptor.code === activeCode}
                onClick={() => { setOpen(false); setQuery(""); onSelect(descriptor.code); }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
              >
                <span>
                  <strong className="block text-sm text-text">{descriptor.code}</strong>
                  <small className="mt-0.5 block text-[11px] font-semibold text-muted">{building?.name || (descriptor.layoutStatus === "pending" ? "Chờ cấu hình mặt bằng" : "Chưa đồng bộ dữ liệu")}</small>
                </span>
                {descriptor.code === activeCode && <Check size={16} className="text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
