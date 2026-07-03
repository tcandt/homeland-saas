"use client";
import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

const accounts = [
  { code: "511", name: "Doanh thu tiền thuê", type: "revenue", balance: "850,000,000" },
  { code: "512", name: "Doanh thu dịch vụ", type: "revenue", balance: "45,000,000" },
  { code: "631", name: "Chi phí vận hành", type: "expense", balance: "120,000,000" },
  { code: "642", name: "Chi phí quản lý", type: "expense", balance: "35,000,000" },
  { code: "131", name: "Phải thu khách hàng", type: "asset", balance: "28,500,000" },
  { code: "112", name: "Tiền gửi ngân hàng", type: "asset", balance: "320,000,000" },
  { code: "331", name: "Phải trả nhà cung cấp", type: "liability", balance: "15,000,000" },
  { code: "411", name: "Vốn chủ sở hữu", type: "equity", balance: "500,000,000" },
];

const typeConfig: any = {
  revenue: { label: "Doanh thu", color: "text-success bg-success/10" },
  expense: { label: "Chi phí", color: "text-danger bg-danger/10" },
  asset: { label: "Tài sản", color: "text-primary bg-primary/10" },
  liability: { label: "Nợ phải trả", color: "text-warning bg-warning/10" },
  equity: { label: "Vốn CSH", color: "text-primary bg-primary/10" },
};

export default function SettingsAccounting() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-[15px] text-text">Chart of Accounts</h3>
            <p className="text-[12px] font-medium text-muted mt-[2px]">Chuẩn bị tích hợp MISA, FAST và xuất báo cáo kế toán</p>
          </div>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 flex items-center gap-[6px] transition-colors">
            <Plus size={14} /> Thêm tài khoản
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-background">
                {["Mã TK", "Tên tài khoản", "Loại", "Số dư", "Xuất sang MISA", ""].map(h => (
                  <th key={h} className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-black/[0.02] dark:hover:bg-card/[0.02] transition-colors">
                  <td className="py-[10px] px-[12px] font-mono font-bold text-text">{acc.code}</td>
                  <td className="py-[10px] px-[12px] font-medium text-text">{acc.name}</td>
                  <td className="py-[10px] px-[12px]">
                    <span className={`text-[10px] font-bold px-[8px] py-[3px] rounded-full ${typeConfig[acc.type].color}`}>
                      {typeConfig[acc.type].label}
                    </span>
                  </td>
                  <td className="py-[10px] px-[12px] font-bold text-text">{acc.balance} ₫</td>
                  <td className="py-[10px] px-[12px]">
                    <Input placeholder="TK MISA mapping..." className="w-[130px] h-[30px] px-[8px] bg-background border border-border rounded-[8px] text-[11px] focus:outline-none focus:border-primary" />
                  </td>
                  <td className="py-[10px] px-[12px]">
                    <Button className="text-[11px] font-bold text-primary hover:underline">Sửa</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-[14px]">
          <div className="flex gap-[8px]">
            <Button className="h-[36px] px-[14px] rounded-[10px] bg-background border border-border text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors">Xuất MISA XML</Button>
            <Button className="h-[36px] px-[14px] rounded-[10px] bg-background border border-border text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors">Xuất FAST Excel</Button>
          </div>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 transition-colors">Lưu cấu hình kế toán</Button>
        </div>
      </div>
    </div>
  );
}
