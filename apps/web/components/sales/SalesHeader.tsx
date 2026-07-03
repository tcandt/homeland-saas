import React from "react";
import { Plus, Search, Filter } from "lucide-react";

export default function SalesHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">


      <div className="flex items-center gap-2 w-full min-w-0">
        <div className="flex flex-1 items-center gap-2 px-3 py-2 bg-card border border-border rounded-[10px] shadow-sm min-w-0">
          <Search size={16} className="text-muted shrink-0" />
          <input 
            type="text" 
            placeholder="Tìm theo tên, SĐT..." 
            className="bg-transparent border-0 outline-none text-[13px] font-medium text-text w-full min-w-0 placeholder:text-muted"
          />
        </div>

        <button className="w-[38px] h-[38px] flex items-center justify-center bg-card border border-border rounded-[10px] text-text shadow-sm shrink-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <Filter size={16} />
        </button>

        <button className="flex items-center gap-2 px-4 py-[9px] bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-[10px] text-[13px] font-bold transition-colors shadow-sm shrink-0">
          <Plus size={16} /> <span className="hidden md:inline">Thêm Khách mới</span>
        </button>
      </div>
    </div>
  );
}
