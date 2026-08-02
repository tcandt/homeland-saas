"use client";

import React, { useState } from "react";
import { Plus, UserPlus, Receipt, FileText, Wrench, Home } from "lucide-react";

export default function RoomsSpeedDial() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-[110px] right-[20px] md:bottom-[40px] md:right-[40px] flex flex-col items-end gap-3 z-[100]">
      {/* Speed Dial Menu Items */}
      <div 
        className={`flex flex-col items-end gap-3 transition-all duration-300 origin-bottom ${
          isOpen ? "opacity-100 scale-100 pointer-events-auto translate-y-0" : "opacity-0 scale-90 pointer-events-none translate-y-4"
        }`}
      >
        <DialButton icon={<FileText size={18} />} label="Tạo hợp đồng" color="text-indigo-600 dark:text-indigo-400" />
        <DialButton icon={<Wrench size={18} />} label="Bảo trì" color="text-indigo-600 dark:text-indigo-400" />
        <DialButton icon={<Receipt size={18} />} label="Lập hóa đơn" color="text-orange-600 dark:text-orange-400" />
        <DialButton icon={<UserPlus size={18} />} label="Nhận khách" color="text-blue-600 dark:text-blue-400" />
        <DialButton icon={<Home size={18} />} label="Thêm phòng mới" color="text-indigo-600 dark:text-indigo-400" />
      </div>

      {/* Main FAB */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-[56px] h-[56px] rounded-full flex items-center justify-center bg-primary text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 hover:scale-105 hover:-translate-y-1 transition-all duration-300 ${
          isOpen ? "rotate-45 bg-rose-500 hover:bg-rose-600 shadow-rose-500/30" : ""
        }`}
      >
        <Plus size={28} />
      </button>

      {/* Overlay backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[-1] bg-black/5 dark:bg-black/20 backdrop-blur-[1px]" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function DialButton({ icon, label, color }: any) {
  return (
    <div className="flex items-center gap-3 cursor-pointer group">
      <div className="bg-card px-3 py-1.5 rounded-[8px] border border-border shadow-sm text-[13px] font-bold text-text opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
        {label}
      </div>
      <button className={`w-[48px] h-[48px] rounded-full bg-card border border-border shadow-sm flex items-center justify-center ${color} hover:bg-black/5 dark:hover:bg-white/5 hover:scale-110 transition-all duration-200`}>
        {icon}
      </button>
    </div>
  );
}
