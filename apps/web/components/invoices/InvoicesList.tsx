import React from "react";
import { MoreHorizontal, User, Building2, Calendar, Receipt, CreditCard } from "lucide-react";
import { Table } from "../ui/Table";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

const invoices = [
  { id: "INV-2606-05", name: "Nguyễn Văn A", room: "P101 - LK01", date: "01/06/2026", amount: "6.500.000 đ", paid: "0 đ", percent: 0, status: "Quá hạn" },
  { id: "INV-2606-04", name: "Trần Thị B", room: "P102 - LK01", date: "05/06/2026", amount: "5.800.000 đ", paid: "5.800.000 đ", percent: 100, status: "Đã thanh toán" },
  { id: "INV-2606-03", name: "Lê Văn C", room: "P201 - LK02", date: "10/06/2026", amount: "7.200.000 đ", paid: "3.000.000 đ", percent: 41, status: "Thanh toán 1 phần" },
  { id: "INV-2606-02", name: "Phạm D", room: "P301 - LK02", date: "15/06/2026", amount: "6.000.000 đ", paid: "0 đ", percent: 0, status: "Chờ thanh toán" },
  { id: "INV-2606-01", name: "Hoàng E", room: "P405 - LK01", date: "20/06/2026", amount: "5.500.000 đ", paid: "5.500.000 đ", percent: 100, status: "Đã thanh toán" },
];

export default function InvoicesList() {
  const columns = [
    {
      header: "Mã Hóa đơn",
      accessor: (row: any) => (
        <span className="font-bold text-[13px] text-text group-hover:text-[#4f46e5] transition-colors">{row.id}</span>
      ),
      className: "w-[120px]"
    },
    {
      header: "Khách hàng",
      accessor: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4f46e5]/20 to-[#8b5cf6]/20 flex items-center justify-center shrink-0 border border-[#4f46e5]/10">
            <User size={14} className="text-[#4f46e5]" />
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
      header: "Tổng tiền",
      accessor: (row: any) => (
        <span className="text-[14px] font-black text-text">{row.amount}</span>
      ),
      className: "text-right w-[150px]"
    },
    {
      header: "Tiến độ thu",
      accessor: (row: any) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-muted">{row.paid}</span>
            <span className="text-text">{row.percent}%</span>
          </div>
          <div className="h-[6px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${row.percent === 100 ? 'bg-[#22c55e]' : 'bg-[#4f46e5]'}`} 
              style={{ width: `${row.percent}%` }}
            ></div>
          </div>
        </div>
      ),
      className: "w-[180px] pl-8"
    },
    {
      header: "Trạng thái",
      accessor: (row: any) => <StatusBadge status={row.status} />,
      className: "text-right w-[140px]"
    },
    {
      header: "",
      accessor: (row: any) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted hover:text-text">
          <MoreHorizontal size={16} />
        </Button>
      ),
      className: "text-center w-[60px]"
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Desktop Premium Data Grid */}
      <div className="hidden md:block overflow-x-auto">
        <Table
          columns={columns}
          data={invoices}
        />
      </div>

      {/* Mobile List */}
      <div className="flex md:hidden flex-col gap-3">
        {invoices.map((item, i) => (
          <Card key={i} className="p-4 gap-3 relative flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-[8px] bg-background border border-border flex items-center justify-center shrink-0`}>
                  <Receipt size={16} className={item.status === 'Quá hạn' ? 'text-[#ef4444]' : 'text-[#4f46e5]'} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-text truncate max-w-[150px]">{item.name}</div>
                  <div className="text-[11px] font-medium text-muted mt-0.5">{item.id} • {item.date}</div>
                </div>
              </div>
              <StatusBadge status={item.status} />
            </div>
            
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted mt-1">
              <Building2 size={14} /> <span>{item.room}</span>
            </div>

            {/* Progress */}
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-muted">Đã thu: {item.paid}</span>
                <span className="text-text">{item.percent}%</span>
              </div>
              <div className="h-[6px] bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${item.percent === 100 ? 'bg-[#22c55e]' : 'bg-[#4f46e5]'}`} 
                  style={{ width: `${item.percent}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <div className="text-[14px] font-black text-text">{item.amount}</div>
              {item.percent === 100 ? (
                <Button variant="outline" size="sm" className="h-7 text-[11px] font-bold">
                  Chi tiết
                </Button>
              ) : (
                <Button variant="primary" size="sm" className="h-7 text-[11px] font-bold">
                  <CreditCard size={12} className="mr-1.5" /> Thu tiền
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Quá hạn") {
    return <span className="inline-block px-2 py-1 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 rounded-[6px] text-[10px] font-bold whitespace-nowrap">{status}</span>;
  }
  if (status === "Thanh toán 1 phần") {
    return <span className="inline-block px-2 py-1 bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 rounded-[6px] text-[10px] font-bold whitespace-nowrap">{status}</span>;
  }
  if (status === "Đã thanh toán") {
    return <span className="inline-block px-2 py-1 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 rounded-[6px] text-[10px] font-bold whitespace-nowrap">{status}</span>;
  }
  return <span className="inline-block px-2 py-1 bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20 rounded-[6px] text-[10px] font-bold whitespace-nowrap">{status}</span>;
}
