"use client";

import React, { useState } from "react";
import { Plus, Filter, ChevronDown } from "lucide-react";
import { Button } from "../ui/Button";
import { SearchInput } from "../ui/SearchInput";
import { Modal } from "../ui/Modal";

export default function ContractsHeader() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

      <div className={`flex items-center gap-2 w-full md:w-auto relative ${isFilterOpen ? 'z-[10005]' : 'z-20'}`}>
        {/* Search */}
        <SearchInput 
          placeholder="Tìm mã HĐ, khách..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-[200px]"
        />

        {/* Filter */}
        <Button 
          variant="outline"
          size="icon"
          onClick={() => setIsFilterOpen(true)}
        >
          <Filter size={16} />
        </Button>

        {/* Add Action */}
        <Button variant="primary">
          <Plus size={16} className="mr-2" /> <span className="hidden md:inline">Thêm hợp đồng</span>
        </Button>

        {/* Filter Modal */}
        <Modal
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          title="Lọc hợp đồng"
          zIndex={10030}
          footer={
            <Button 
              variant="primary" 
              className="w-full"
              onClick={() => setIsFilterOpen(false)}
            >
              Áp dụng bộ lọc
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-[10px]">
            <FilterOption label="Tòa nhà" value="Tất cả" />
            <FilterOption label="Trạng thái" value="Tất cả" />
            <FilterOption label="Loại HĐ" value="Tất cả" />
            <FilterOption label="Kỳ thanh toán" value="Tất cả" />
            <FilterOption label="Sắp xếp" value="Mới nhất" />
            <FilterOption label="Trễ hạn" value="Tất cả" />
          </div>
        </Modal>
      </div>
    </div>
  );
}

function FilterOption({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-[10px] md:p-[12px] bg-black/5 dark:bg-white/5 rounded-[10px] cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-center">
      <span className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider mb-[2px]">{label}</span>
      <div className="flex items-center gap-[4px]">
        <span className="text-[13px] md:text-[14px] font-bold text-[#6366f1]">{value}</span>
        <ChevronDown size={14} className="text-[#6366f1]" />
      </div>
    </div>
  );
}
