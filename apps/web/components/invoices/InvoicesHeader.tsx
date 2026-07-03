import React from "react";
import { Plus, Filter } from "lucide-react";
import { SearchInput } from "../ui/SearchInput";
import { Button } from "../ui/Button";

export default function InvoicesHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-[20px] md:text-[24px] font-black text-text tracking-tight">Quản lý Hóa đơn</h2>
        <p className="text-[13px] font-medium text-muted mt-1">Theo dõi các khoản thu tiền phòng, điện nước hàng tháng</p>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto">
        <SearchInput 
          placeholder="Tìm mã hóa đơn, phòng..." 
          className="w-full md:w-[240px]"
        />

        <Button variant="outline" className="w-[40px] h-[40px] p-0 shrink-0 border-border">
          <Filter size={16} className="text-muted" />
        </Button>

        <Button variant="primary" className="shrink-0 h-[40px] font-bold">
          <Plus size={16} className="mr-2" /> <span className="hidden md:inline">Tạo hóa đơn</span>
        </Button>
      </div>
    </div>
  );
}
