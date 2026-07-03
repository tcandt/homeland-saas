import React from "react";
import { Plus, Filter } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/Button";

export default function TasksHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">


      <div className="flex items-center gap-2 w-full md:w-auto">
        <SearchInput 
          placeholder="Tìm công việc..." 
          className="w-full md:w-[200px]"
        />

        <Button variant="outline" size="icon" className="shrink-0">
          <Filter size={16} />
        </Button>

        <Button className="shrink-0 gap-2">
          <Plus size={16} /> <span className="hidden md:inline">Tạo Ticket</span>
        </Button>
      </div>
    </div>
  );
}
