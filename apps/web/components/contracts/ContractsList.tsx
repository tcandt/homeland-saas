import React from "react";
import { MoreHorizontal, FileText, Calendar, Building2, User } from "lucide-react";
import { Table } from "../ui/Table";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { getContractStatusConfig } from "../../lib/contracts/contract-status";

const contracts = [
  { id: "HD-2026-001", tenant: "Nguyễn Văn A", room: "P101 - LK01.31", startDate: "01/01/2026", endDate: "31/12/2026", price: "6.500.000 đ", status: "Đang hiệu lực" },
  { id: "HD-2026-002", tenant: "Trần Thị B", room: "P102 - LK01.31", startDate: "15/02/2026", endDate: "14/08/2026", price: "5.500.000 đ", status: "Sắp hết hạn" },
  { id: "HD-2026-003", tenant: "Lê Văn C", room: "P201 - LK02", startDate: "01/03/2026", endDate: "01/03/2027", price: "7.000.000 đ", status: "Đang hiệu lực" },
  { id: "HD-2025-089", tenant: "Phạm D", room: "P301 - LK02", startDate: "01/06/2025", endDate: "01/06/2026", price: "6.000.000 đ", status: "Sắp hết hạn" },
  { id: "HD-2025-045", tenant: "Hoàng E", room: "P405 - LK01.31", startDate: "01/04/2025", endDate: "01/04/2026", price: "5.000.000 đ", status: "Đã chấm dứt" },
];



const columns = [
  {
    header: "Mã HĐ",
    accessor: (row: any) => <span className="text-[13px] font-bold text-text group-hover:text-[#4f46e5] transition-colors">{row.id}</span>,
    className: "w-[120px]"
  },
  {
    header: "Khách thuê",
    accessor: (row: any) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4f46e5]/20 to-[#8b5cf6]/20 flex items-center justify-center shrink-0 border border-[#4f46e5]/10">
          <User size={14} className="text-[#4f46e5]" />
        </div>
        <span className="text-[13px] font-bold text-text">{row.tenant}</span>
      </div>
    )
  },
  {
    header: "Phòng / Tòa nhà",
    accessor: (row: any) => (
      <div className="flex items-center gap-2 text-[13px] font-medium text-text">
        <div className="p-1.5 rounded-md bg-muted/10"><Building2 size={14} className="text-muted" /></div>
        {row.room}
      </div>
    )
  },
  {
    header: "Thời hạn",
    accessor: (row: any) => (
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
        <div className="p-1.5 rounded-md bg-muted/10"><Calendar size={14} className="text-muted" /></div>
        {row.startDate} - {row.endDate}
      </div>
    )
  },
  {
    header: "Giá thuê",
    accessor: (row: any) => <span className="text-[14px] font-black text-text">{row.price}</span>,
    className: "text-right"
  },
  {
    header: "Trạng thái",
    accessor: (row: any) => {
      const config = getContractStatusConfig(row.status === "Đang hiệu lực" ? "ACTIVE" : row.status === "Sắp hết hạn" ? "EXPIRING" : row.status === "Đã chấm dứt" ? "TERMINATED" : "DRAFT");
      return <Badge variant={config.color}>{config.label}</Badge>;
    },
    className: "text-right w-[120px]"
  },
  {
    header: "",
    accessor: (row: any) => (
      <Button variant="ghost" size="icon" className="text-muted hover:text-text rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
        <MoreHorizontal size={16} />
      </Button>
    ),
    className: "text-center w-[60px]"
  }
];

export default function ContractsList() {
  return (
    <div className="flex flex-col">
      {/* Desktop Premium Data Grid */}
      <div className="hidden md:block">
        <Table columns={columns} data={contracts} />
      </div>

      {/* Mobile List */}
      <div className="flex md:hidden flex-col gap-3">
        {contracts.map((item, i) => (
          <Card key={i} className="flex flex-col p-4 gap-3 relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[8px] bg-card border border-border flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-[#4f46e5]" />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-text">{item.id}</div>
                  <div className="text-[11px] font-medium text-muted mt-0.5">{item.tenant}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const config = getContractStatusConfig(item.status === "Đang hiệu lực" ? "ACTIVE" : item.status === "Sắp hết hạn" ? "EXPIRING" : item.status === "Đã chấm dứt" ? "TERMINATED" : "DRAFT");
                  return <Badge variant={config.color}>{config.label}</Badge>;
                })()}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
                <Building2 size={14} /> <span className="truncate">{item.room}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted justify-end">
                <Calendar size={14} /> <span className="truncate">{item.endDate}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50">
              <div className="text-[14px] font-black text-text">{item.price}</div>
              <Button variant="outline" size="sm" className="text-[11px] font-bold h-7">Chi tiết</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
