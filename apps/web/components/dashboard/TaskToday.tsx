import React from "react";

export default function TaskToday() {
  const tasks = [
    { title: "Gọi khách Nguyễn Văn A", desc: "Phòng 201 - LK01.31", time: "09:00", timeColor: "text-[#10b981]" },
    { title: "Xử lý hóa đơn INV-000201", desc: "Phòng 301 - LK08.24", time: "10:30", timeColor: "text-[#f97316]" },
    { title: "Kiểm tra phòng 301", desc: "LK01.32 - Check-out hôm nay", time: "11:00", timeColor: "text-[#3b82f6]" },
    { title: "Duyệt hợp đồng HD-2024-015", desc: "Phòng 402 - LK08.25", time: "14:00", timeColor: "text-[#8b5cf6]" },
  ];

  return (
    <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[24px]">
        <h3 className="font-black text-[14px] text-text uppercase m-0">Việc của tôi hôm nay</h3>
        <a href="#" className="text-[#4f46e5] text-[13px] font-bold hover:underline">Xem tất cả</a>
      </div>

      <div className="flex flex-col justify-between flex-1 gap-[20px]">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-start gap-[16px]">
            <div className="w-[18px] h-[18px] rounded-[4px] border-[2px] border-border/80 flex items-center justify-center shrink-0 mt-[2px] cursor-pointer hover:border-[#4f46e5]">
              {/* Checkbox empty */}
            </div>
            <div className="flex-1">
              <div className="font-bold text-[13px] text-text leading-tight mb-1">{task.title}</div>
              <div className="text-[12px] text-muted font-medium">{task.desc}</div>
            </div>
            <div className={`font-black text-[12px] bg-black/5 dark:bg-white/5 px-2 py-1 rounded-[6px] shrink-0 ${task.timeColor}`}>
              {task.time}
            </div>
          </div>
        ))}
      </div>

      <a href="#" className="mt-[24px] block text-center py-[12px] border border-border/80 rounded-[12px] text-[#4f46e5] text-[13px] font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        Xem tất cả các công việc {`->`}
      </a>
    </div>
  );
}
