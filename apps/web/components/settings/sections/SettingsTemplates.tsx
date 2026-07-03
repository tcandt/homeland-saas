"use client";
import React from "react";
import { Button } from "@/components/ui/Button";
import { Plus, Eye, Trash2 } from "lucide-react";
const templates = [
  { name: "Hợp đồng thuê nhà tiêu chuẩn", type: "contract", last: "01/06/2026", uses: 42 },
  { name: "Phụ lục hợp đồng", type: "contract", last: "15/05/2026", uses: 8 },
  { name: "Hóa đơn điện tử", type: "invoice", last: "01/06/2026", uses: 156 },
  { name: "Phiếu thu", type: "receipt", last: "10/05/2026", uses: 89 },
  { name: "Phiếu hoàn cọc", type: "refund", last: "20/05/2026", uses: 12 },
];
const typeColors: any = { contract: "text-primary bg-primary/10", invoice: "text-success bg-success/10", receipt: "text-warning bg-warning/10", refund: "text-primary bg-primary/10" };
const typeLabels: any = { contract: "Hợp đồng", invoice: "Hóa đơn", receipt: "Phiếu thu", refund: "Hoàn cọc" };
export default function SettingsTemplates() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[15px] text-text">Mẫu biểu (Templates)</h3>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 flex items-center gap-[6px] transition-colors">
            <Plus size={14} /> Thêm mẫu
          </Button>
        </div>
        <div className="flex flex-col gap-[8px]">
          {templates.map((t, i) => (
            <div key={i} className="flex items-center gap-[14px] p-[14px] rounded-[10px] bg-background border border-border hover:border-primary/30 transition-colors group">
              <div className="w-[36px] h-[36px] rounded-[10px] bg-border flex items-center justify-center text-[16px] shrink-0">📄</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] text-text group-hover:text-primary transition-colors truncate">{t.name}</div>
                <div className="text-[11px] font-medium text-muted mt-[2px]">Cập nhật: {t.last} · {t.uses} lần dùng</div>
              </div>
              <span className={`text-[10px] font-bold px-[8px] py-[3px] rounded-full shrink-0 ${typeColors[t.type]}`}>{typeLabels[t.type]}</span>
              <div className="flex items-center gap-[6px] shrink-0">
                <Button className="h-[30px] w-[30px] rounded-[8px] bg-background border border-border flex items-center justify-center text-muted hover:text-primary hover:border-primary/40 transition-colors">
                  <Eye size={13} />
                </Button>
                <Button className="h-[30px] w-[30px] rounded-[8px] bg-background border border-border flex items-center justify-center text-muted hover:text-danger hover:border-danger/40 transition-colors">
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Logo & Chữ ký</h3>
        <div className="grid grid-cols-2 gap-[14px]">
          {["Logo công ty", "Chữ ký điện tử"].map(label => (
            <div key={label} className="flex flex-col gap-[8px]">
              <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
              <div className="h-[100px] rounded-[12px] border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-[6px] cursor-pointer hover:border-primary transition-colors group">
                <span className="text-[24px]">{label === "Logo công ty" ? "🏢" : "✍️"}</span>
                <span className="text-[12px] font-bold text-muted group-hover:text-primary transition-colors">Tải lên {label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
