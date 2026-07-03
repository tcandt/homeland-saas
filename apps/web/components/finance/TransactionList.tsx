import React from "react";
import { ArrowUpRight, ArrowDownRight, MoreHorizontal, Search, Download } from "lucide-react";

const transactions = [
  { id: "TXN-8472", date: "21/06/2026", description: "Thu tiền phòng P201 - LK01", category: "Tiền thuê", type: "income", amount: "6.500.000 đ", status: "Hoàn thành" },
  { id: "TXN-8471", date: "20/06/2026", description: "Thanh toán tiền điện nước tháng 5", category: "Tiện ích", type: "income", amount: "1.250.000 đ", status: "Hoàn thành" },
  { id: "TXN-8470", date: "19/06/2026", description: "Chi phí sửa chữa máy lạnh P105", category: "Sửa chữa", type: "expense", amount: "450.000 đ", status: "Hoàn thành" },
  { id: "TXN-8469", date: "18/06/2026", description: "Tiền cọc phòng P302 - Khách mới", category: "Tiền cọc", type: "income", amount: "10.000.000 đ", status: "Đang xử lý" },
  { id: "TXN-8468", date: "15/06/2026", description: "Thanh toán phí rác thải, internet", category: "Dịch vụ", type: "expense", amount: "800.000 đ", status: "Hoàn thành" },
  { id: "TXN-8467", date: "12/06/2026", description: "Thu hồi nợ cũ P401 tháng 4", category: "Thu nợ", type: "income", amount: "2.000.000 đ", status: "Thất bại" },
];

export default function TransactionList() {
  return (
    <div className="flex flex-col">
      <div className="md:bg-card md:border md:border-border/50 md:rounded-2xl md:shadow-sm md:overflow-hidden flex flex-col md:p-6 mb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-[16px] font-black text-text">Giao dịch gần đây</h3>
          <p className="text-[12px] font-medium text-muted mt-1">Lịch sử thu chi trong hệ thống</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex flex-1 md:flex-none items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-border rounded-[10px]">
            <Search size={14} className="text-muted" />
            <input 
              type="text" 
              placeholder="Tìm giao dịch..." 
              className="bg-transparent border-0 outline-none text-[12px] font-medium text-text w-full md:w-[150px] placeholder:text-muted"
            />
          </div>
          <button className="flex items-center justify-center w-[34px] h-[34px] border border-border rounded-[10px] bg-card hover:bg-black/5 transition-colors">
            <FilterIcon />
          </button>
        </div>
      </div>

      {/* Desktop Premium Data Grid */}
      <div className="hidden md:block overflow-x-auto mt-4 -mx-6 mb-[-24px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-muted/30">
            <tr>
              <th className="py-4 px-5 pl-6 text-[11px] font-bold text-muted uppercase tracking-wider w-[120px]">Mã GD</th>
              <th className="py-4 px-5 text-[11px] font-bold text-muted uppercase tracking-wider w-[120px]">Ngày</th>
              <th className="py-4 px-5 text-[11px] font-bold text-muted uppercase tracking-wider">Nội dung</th>
              <th className="py-4 px-5 text-[11px] font-bold text-muted uppercase tracking-wider w-[120px]">Danh mục</th>
              <th className="py-4 px-5 text-[11px] font-bold text-muted uppercase tracking-wider text-right w-[140px]">Số tiền</th>
              <th className="py-4 px-5 pr-6 text-[11px] font-bold text-muted uppercase tracking-wider text-right w-[120px]">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 bg-card">
            {transactions.map((txn, i) => (
              <tr key={i} className="group hover:bg-muted/10 transition-colors cursor-pointer">
                <td className="py-4 px-5 pl-6 text-[13px] font-bold text-text">{txn.id}</td>
                <td className="py-4 px-5 text-[13px] font-medium text-muted">{txn.date}</td>
                <td className="py-4 px-5 text-[13px] font-bold text-text group-hover:text-[#4f46e5] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${txn.type === 'income' ? 'bg-[#22c55e]/10 border-[#22c55e]/20 text-[#22c55e]' : 'bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]'}`}>
                      {txn.type === 'income' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    </div>
                    <span>{txn.description}</span>
                  </div>
                </td>
                <td className="py-4 px-5">
                  <span className="px-2.5 py-1 bg-muted/10 text-text rounded-[6px] text-[11px] font-bold">{txn.category}</span>
                </td>
                <td className="py-4 px-5 text-right">
                  <div className={`flex items-center justify-end gap-1 text-[14px] font-black ${txn.type === 'income' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {txn.type === 'income' ? '+' : '-'}{txn.amount}
                  </div>
                </td>
                <td className="py-4 px-5 pr-6 text-right">
                  <StatusBadge status={txn.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {/* Mobile List */}
      <div className="flex md:hidden flex-col gap-3">
        {transactions.map((txn, i) => (
          <div key={i} className="flex flex-col gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-[14px] border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${txn.type === 'income' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
                  {txn.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                </div>
                <div>
                  <div className="text-[13px] font-bold text-text truncate max-w-[180px]">{txn.description}</div>
                  <div className="text-[11px] font-medium text-muted mt-0.5">{txn.date} • {txn.id}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-[14px] font-black ${txn.type === 'income' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {txn.type === 'income' ? '+' : '-'}{txn.amount}
                </div>
                <div className="mt-1 flex justify-end">
                  <StatusBadge status={txn.status} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 text-center">
        <button className="text-[13px] font-bold text-[#4f46e5] hover:underline">Xem tất cả giao dịch</button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Hoàn thành") {
    return <span className="inline-block px-2 py-1 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 rounded-[6px] text-[10px] font-bold whitespace-nowrap">{status}</span>;
  }
  if (status === "Đang xử lý") {
    return <span className="inline-block px-2 py-1 bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20 rounded-[6px] text-[10px] font-bold whitespace-nowrap">{status}</span>;
  }
  return <span className="inline-block px-2 py-1 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 rounded-[6px] text-[10px] font-bold whitespace-nowrap">{status}</span>;
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
  );
}
