"use client";

import React from "react";
import { Clock, FileWarning, AlertTriangle, FileText, ChevronRight, TrendingDown, DollarSign } from "lucide-react";

export default function OperationsFinanceRightPanel() {
  return (
    <div className="flex flex-col gap-[24px] sticky top-[24px]">
      
      {/* 1. Reconciliation Queue */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="font-black text-[15px] text-text">Hàng đợi Đối soát</h3>
            <span className="text-[12px] text-muted font-medium">Reconciliation Queue</span>
          </div>
          <div className="w-[32px] h-[32px] rounded-[10px] bg-[#f97316]/10 flex items-center justify-center">
            <Clock size={16} className="text-[#f97316]" />
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className="flex items-center justify-between p-[12px] bg-black/5 dark:bg-white/5 rounded-[12px] cursor-pointer hover:bg-black/10 transition-colors">
            <div className="flex items-center gap-[12px]">
              <div className="w-[8px] h-[8px] rounded-full bg-[#f97316]" />
              <span className="font-bold text-[13px] text-text">Giao dịch chưa đối soát</span>
            </div>
            <span className="font-black text-[14px] text-text">7</span>
          </div>
          <div className="flex items-center justify-between p-[12px] bg-rose-500/5 border border-rose-500/20 rounded-[12px] cursor-pointer hover:bg-rose-500/10 transition-colors">
            <div className="flex items-center gap-[12px]">
              <div className="w-[8px] h-[8px] rounded-full bg-rose-500" />
              <span className="font-bold text-[13px] text-rose-500">Chứng từ thiếu</span>
            </div>
            <span className="font-black text-[14px] text-rose-500">3</span>
          </div>
          <div className="flex items-center justify-between p-[12px] bg-black/5 dark:bg-white/5 rounded-[12px] cursor-pointer hover:bg-black/10 transition-colors">
            <div className="flex items-center gap-[12px]">
              <div className="w-[8px] h-[8px] rounded-full bg-[#6366f1]" />
              <span className="font-bold text-[13px] text-text">Khoản chi cần duyệt</span>
            </div>
            <span className="font-black text-[14px] text-text">2</span>
          </div>
        </div>
      </div>

      {/* 2. Report Center */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex flex-col">
            <h3 className="font-black text-[15px] text-text">Trung tâm Báo cáo</h3>
            <span className="text-[12px] text-muted font-medium">Report Center</span>
          </div>
          <FileText size={16} className="text-muted" />
        </div>

        <div className="flex flex-col gap-[8px]">
          {['Báo cáo kết quả hoạt động kinh doanh (P&L)', 'Báo cáo lưu chuyển tiền tệ', 'Báo cáo tổng hợp công nợ', 'Sổ chi tiết các tài khoản'].map((report, i) => (
            <button key={i} className="flex items-center justify-between p-[12px] hover:bg-black/5 dark:hover:bg-white/5 rounded-[10px] group transition-colors">
              <span className="font-bold text-[13px] text-text text-left line-clamp-1">{report}</span>
              <ChevronRight size={14} className="text-muted group-hover:text-text transition-colors" />
            </button>
          ))}
        </div>
        
        <button className="w-full h-[40px] mt-[4px] bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 text-[#8b5cf6] font-bold text-[13px] rounded-[10px] transition-colors flex items-center justify-center gap-[6px]">
          <FileText size={14} /> Đi đến Report Center
        </button>
      </div>

      {/* 3. Financial Alerts */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center gap-[8px] border-b border-border/50 pb-3">
          <AlertTriangle size={16} className="text-rose-500" />
          <h3 className="font-black text-[15px] text-text">Cảnh báo Tài chính</h3>
        </div>

        <div className="flex flex-col gap-[16px]">
          <div className="flex items-start gap-[12px]">
            <div className="w-[32px] h-[32px] rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 mt-1">
              <TrendingDown size={14} className="text-rose-500" />
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="font-bold text-[13px] text-text">LK08.24 sụt giảm lợi nhuận</span>
              <span className="text-[12px] text-muted">Lợi nhuận giảm 10% so với tháng trước do chi phí sửa chữa tăng cao.</span>
            </div>
          </div>
          <div className="flex items-start gap-[12px]">
            <div className="w-[32px] h-[32px] rounded-full bg-[#f97316]/10 flex items-center justify-center shrink-0 mt-1">
              <DollarSign size={14} className="text-[#f97316]" />
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="font-bold text-[13px] text-text">Công nợ phải thu tăng nhanh</span>
              <span className="text-[12px] text-muted">Vượt ngưỡng an toàn 15% tổng doanh thu dự kiến.</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
