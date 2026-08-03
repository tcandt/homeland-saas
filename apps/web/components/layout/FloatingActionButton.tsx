"use client";

import React, { useState } from "react";
import { Plus, Receipt, CheckCircle2, Coins, Building2, Bed, FileText, Users, UserPlus, FileSignature, MessageSquare, ShieldAlert, Wrench, CalendarClock, Bell, User, Banknote, PenTool, Download, Trash2, Bookmark, RefreshCcw, Send, Wallet, Megaphone, Calendar, CreditCard, Save, Database, Clock } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function FloatingActionButton() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  
  const isBuildings = pathname.startsWith("/buildings");
  const isRooms = pathname.startsWith("/rooms");
  const isTenants = pathname.startsWith("/tenants");
  const isContracts = pathname.startsWith("/contracts");
  const isDeposits = pathname.startsWith("/deposits");
  const isInvoices = pathname.startsWith("/invoices");
  const isFinance = pathname === "/finance";
  const isTasks = pathname.startsWith("/tasks");
  const isSales = pathname.startsWith("/sales");

  const isSettings = pathname.startsWith("/settings");

  const isCoreOps = isBuildings || isRooms || isTenants || isContracts || isDeposits || isInvoices;
  const hasMenu = isFinance || isCoreOps || isTasks || isSales || isSettings;

  const handleClick = () => {
    if (hasMenu) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <>
      {/* Menu Backdrop */}
      {isOpen && hasMenu && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[9998] animate-in fade-in duration-200" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* Menu Items */}
      {isOpen && (
        <div className="fixed bottom-[160px] right-[16px] md:bottom-[110px] md:right-[40px] flex flex-col items-end gap-3 z-[9999] animate-in slide-in-from-bottom-5 duration-200">
          
          {isFinance && (
            <>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Ghi nhận chi phí</span>
                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center"><Wallet size={14} className="text-rose-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Nhập giao dịch</span>
                <div className="w-8 h-8 rounded-full bg-[#f97316]/10 flex items-center justify-center"><RefreshCcw size={14} className="text-[#f97316]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Xuất báo cáo</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><FileText size={14} className="text-blue-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Đối soát</span>
                <div className="w-8 h-8 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center"><CheckCircle2 size={14} className="text-[#0ea5e9]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo phiếu chi</span>
                <div className="w-8 h-8 rounded-full bg-[#f43f5e]/10 flex items-center justify-center"><Banknote size={14} className="text-[#f43f5e]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo phiếu thu</span>
                <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center"><Coins size={14} className="text-[#8b5cf6]" /></div>
              </button>
            </>
          )}

          {isTasks && (
            <>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Ghi nhận chi phí</span>
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center"><Banknote size={14} className="text-indigo-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Giao việc nhân viên</span>
                <div className="w-8 h-8 rounded-full bg-[#f97316]/10 flex items-center justify-center"><User size={14} className="text-[#f97316]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo việc dọn phòng</span>
                <div className="w-8 h-8 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center"><Bed size={14} className="text-[#0ea5e9]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Gửi thông báo</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><Bell size={14} className="text-blue-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo lịch bảo trì</span>
                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center"><CalendarClock size={14} className="text-rose-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo ticket</span>
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/10 flex items-center justify-center"><Wrench size={14} className="text-[#6366f1]" /></div>
              </button>
            </>
          )}

          {isTenants && (
            <>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Khai báo tạm trú</span>
                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center"><ShieldAlert size={14} className="text-rose-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Nhắc nợ / Gửi Zalo</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><MessageSquare size={14} className="text-blue-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Xuất hợp đồng</span>
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center"><FileText size={14} className="text-indigo-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Thu tiền</span>
                <div className="w-8 h-8 rounded-full bg-[#f97316]/10 flex items-center justify-center"><Coins size={14} className="text-[#f97316]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Gia hạn</span>
                <div className="w-8 h-8 rounded-full bg-[#a855f7]/10 flex items-center justify-center"><FileSignature size={14} className="text-[#a855f7]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Nhận cọc</span>
                <div className="w-8 h-8 rounded-full bg-[#3b82f6]/10 flex items-center justify-center"><CheckCircle2 size={14} className="text-[#3b82f6]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Khách mới</span>
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/10 flex items-center justify-center"><UserPlus size={14} className="text-[#6366f1]" /></div>
              </button>
            </>
          )}

          {isContracts && (
            <>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Chấm dứt</span>
                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center"><Trash2 size={14} className="text-rose-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Gửi ký</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><PenTool size={14} className="text-blue-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Xuất PDF</span>
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center"><Download size={14} className="text-indigo-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Gia hạn</span>
                <div className="w-8 h-8 rounded-full bg-[#f97316]/10 flex items-center justify-center"><CalendarClock size={14} className="text-[#f97316]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo từ đặt cọc</span>
                <div className="w-8 h-8 rounded-full bg-[#a855f7]/10 flex items-center justify-center"><Coins size={14} className="text-[#a855f7]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Thêm hợp đồng</span>
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/10 flex items-center justify-center"><FileText size={14} className="text-[#6366f1]" /></div>
              </button>
            </>
          )}

          {isDeposits && (
            <>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Xuất PDF</span>
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center"><Download size={14} className="text-indigo-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Hoàn cọc</span>
                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center"><RefreshCcw size={14} className="text-rose-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Chuyển hợp đồng</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><FileText size={14} className="text-blue-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Thu cọc</span>
                <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center"><Banknote size={14} className="text-[#8b5cf6]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Giữ chỗ</span>
                <div className="w-8 h-8 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center"><Bookmark size={14} className="text-[#0ea5e9]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo phiếu cọc</span>
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/10 flex items-center justify-center"><Plus size={14} className="text-[#6366f1]" /></div>
              </button>
            </>
          )}

          {isInvoices && (
            <>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo phiếu thu</span>
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center"><Coins size={14} className="text-indigo-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Nhập thanh toán</span>
                <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center"><Banknote size={14} className="text-[#8b5cf6]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Xuất PDF</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><Download size={14} className="text-blue-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Gửi nhắc nợ</span>
                <div className="w-8 h-8 rounded-full bg-[#f97316]/10 flex items-center justify-center"><Send size={14} className="text-[#f97316]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Thu tiền</span>
                <div className="w-8 h-8 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center"><Receipt size={14} className="text-[#0ea5e9]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo hóa đơn</span>
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/10 flex items-center justify-center"><Plus size={14} className="text-[#6366f1]" /></div>
              </button>
            </>
          )}

          {isSales && (
            <>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Chiến dịch Marketing</span>
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center"><Megaphone size={14} className="text-indigo-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo Hợp đồng</span>
                <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center"><FileSignature size={14} className="text-[#8b5cf6]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Tạo Phiếu Cọc</span>
                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center"><CreditCard size={14} className="text-rose-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Đặt lịch Xem phòng</span>
                <div className="w-8 h-8 rounded-full bg-[#f97316]/10 flex items-center justify-center"><Calendar size={14} className="text-[#f97316]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Import Lead</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><Download size={14} className="text-blue-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Thêm Lead Mới</span>
                <div className="w-8 h-8 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center"><Plus size={14} className="text-[#0ea5e9]" /></div>
              </button>
            </>
          )}

          {isSettings && (
            <>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Lưu thay đổi</span>
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/10 flex items-center justify-center"><Save size={14} className="text-[#6366f1]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Xuất cấu hình</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><Download size={14} className="text-blue-500" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Sao lưu</span>
                <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center"><Database size={14} className="text-[#8b5cf6]" /></div>
              </button>
              <button className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform hover:bg-black/5 dark:hover:bg-white/5">
                <span className="text-[13px] font-bold text-text">Nhật ký</span>
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center"><Clock size={14} className="text-indigo-500" /></div>
              </button>
            </>
          )}

          {isCoreOps && !isTenants && !isContracts && !isDeposits && !isInvoices && (
            <>
              <Link href="/buildings" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform">
                <span className="text-[13px] font-bold text-text">Tòa nhà</span>
                <div className="w-8 h-8 rounded-full bg-[#6366f1]/10 flex items-center justify-center"><Building2 size={14} className="text-[#6366f1]" /></div>
              </Link>
              <Link href="/rooms" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform">
                <span className="text-[13px] font-bold text-text">Phòng</span>
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center"><Bed size={14} className="text-orange-500" /></div>
              </Link>
              <Link href="/contracts" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform">
                <span className="text-[13px] font-bold text-text">Hợp đồng</span>
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center"><FileText size={14} className="text-indigo-500" /></div>
              </Link>
              <Link href="/tenants" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-[24px] shadow-lg active:scale-95 transition-transform">
                <span className="text-[13px] font-bold text-text">Khách thuê</span>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center"><Users size={14} className="text-blue-500" /></div>
              </Link>
            </>
          )}

        </div>
      )}

      <button 
        onClick={handleClick}
        aria-label="Thêm mới"
        className={`hidden md:flex fixed w-[48px] h-[48px] ${isBuildings ? 'md:bottom-2 md:right-2 md:h-11 md:w-11' : 'md:bottom-[40px] md:right-[40px] md:w-[60px] md:h-[60px]'} bg-gradient-to-br from-[#8b5cf6] to-[#4f46e5] text-white rounded-full items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 z-[10000] group ${isOpen ? 'rotate-45' : ''}`}
      >
        <Plus className="w-[24px] h-[24px] md:w-[30px] md:h-[30px] transition-transform duration-300" />
      </button>
    </>
  );
}
