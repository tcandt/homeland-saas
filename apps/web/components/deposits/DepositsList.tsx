import React from "react";
import { MoreHorizontal, User, Building2, Calendar, ShieldCheck, UserPlus } from "lucide-react";
import { Table } from "../ui/Table";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

const deposits = [
  { id: "PC-8472", name: "Nguyễn Văn A", room: "P101 - LK01", date: "21/06/2026", amount: "10.000.000 đ", type: "Cọc bảo đảm", status: "Đang giữ" },
  { id: "PC-8471", name: "Trần Thị B", room: "P102 - LK01", date: "20/06/2026", amount: "5.000.000 đ", type: "Cọc giữ chỗ", status: "Đang giữ" },
  { id: "PC-8470", name: "Lê Văn C", room: "P201 - LK02", date: "15/06/2026", amount: "12.000.000 đ", type: "Cọc bảo đảm", status: "Đã hoàn trả" },
  { id: "PC-8469", name: "Phạm D", room: "P301 - LK02", date: "10/06/2026", amount: "2.000.000 đ", type: "Cọc giữ chỗ", status: "Đã hủy (Mất cọc)" },
  { id: "PC-8468", name: "Hoàng E", room: "P405 - LK01", date: "05/06/2026", amount: "8.000.000 đ", type: "Cọc bảo đảm", status: "Đang giữ" },
];

function getBadgeVariant(status: string) {
  if (status === "Đang giữ") return "primary";
  if (status === "Đã hoàn trả") return "success";
  if (status === "Đã hủy (Mất cọc)") return "error";
  return "neutral";
}

const columns = [
  {
    header: "Mã Phiếu",
    accessor: (row: any) => <span className="text-[13px] font-bold text-text group-hover:text-[#3b82f6] transition-colors">{row.id}</span>,
    className: "w-[120px]"
  },
  {
    header: "Người đặt cọc",
    accessor: (row: any) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6]/20 to-[#8b5cf6]/20 flex items-center justify-center shrink-0 border border-[#3b82f6]/10">
          <User size={14} className="text-[#3b82f6]" />
        </div>
        <span className="text-[13px] font-bold text-text">{row.name}</span>
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
    header: "Ngày lập",
    accessor: (row: any) => (
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
        <div className="p-1.5 rounded-md bg-muted/10"><Calendar size={14} className="text-muted" /></div>
        {row.date}
      </div>
    )
  },
  {
    header: "Loại cọc",
    accessor: (row: any) => (
      <span className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 w-fit ${row.type === 'Cọc bảo đảm' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#8b5cf6]/10 text-[#8b5cf6]'}`}>
        {row.type === 'Cọc bảo đảm' ? <ShieldCheck size={14} /> : <UserPlus size={14} />}
        {row.type}
      </span>
    )
  },
  {
    header: "Số tiền",
    accessor: (row: any) => <span className="text-[14px] font-black text-text">{row.amount}</span>,
    className: "text-right"
  },
  {
    header: "Trạng thái",
    accessor: (row: any) => <Badge variant={getBadgeVariant(row.status)}>{row.status}</Badge>,
    className: "text-right w-[140px]"
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

export default function DepositsList() {
  return (
    <div className="flex flex-col">
      {/* Desktop Premium Data Grid */}
      <div className="hidden md:block">
        <Table columns={columns} data={deposits} />
      </div>

      {/* Mobile List */}
      <div className="flex md:hidden flex-col gap-3">
        {deposits.map((item, i) => (
          <Card key={i} className="flex flex-col p-4 gap-3 relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${item.type === 'Cọc bảo đảm' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#8b5cf6]/10 text-[#8b5cf6]'}`}>
                  {item.type === 'Cọc bảo đảm' ? <ShieldCheck size={16} /> : <UserPlus size={16} />}
                </div>
                <div>
                  <div className="text-[13px] font-bold text-text truncate max-w-[150px]">{item.name}</div>
                  <div className="text-[11px] font-medium text-muted mt-0.5">{item.id} • {item.date}</div>
                </div>
              </div>
              <Badge variant={getBadgeVariant(item.status)}>{item.status}</Badge>
            </div>
            
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted mt-1">
              <Building2 size={14} /> <span>{item.room}</span>
            </div>

            <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50">
              <div className="text-[14px] font-black text-text">{item.amount}</div>
              <Button variant="outline" size="sm" className="text-[11px] font-bold">Chi tiết</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
