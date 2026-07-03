import React from "react";
import { Plus, Filter } from "lucide-react";
import { SearchInput } from "../ui/SearchInput";
import { Button } from "../ui/Button";

export default function DepositsHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

      <div className="flex items-center gap-2 w-full md:w-auto">
        <SearchInput 
          placeholder="Tìm mã phiếu, người cọc..." 
          className="w-full md:w-[200px]"
        />

        <Button variant="outline" size="icon">
          <Filter size={16} />
        </Button>

        <Button variant="primary">
          <Plus size={16} className="mr-2" /> <span className="hidden md:inline">Tạo phiếu cọc</span>
        </Button>
      </div>
    </div>
  );
}
