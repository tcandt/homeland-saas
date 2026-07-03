import React from "react";
import { Clock, AlertTriangle, CheckCircle2, MessageSquare, Paperclip, AlertCircle } from "lucide-react";

const columns = [
  {
    id: "todo",
    title: "Cần làm (To Do)",
    color: "bg-muted",
    tasks: [
      { id: "TSK-01", title: "Sửa vòi nước rỉ", room: "P101 - LK01", priority: "high", due: "Hôm nay", comments: 2, attachments: 1 },
      { id: "TSK-02", title: "Thu tiền phòng T6", room: "Tất cả", priority: "medium", due: "Ngày mai", comments: 0, attachments: 0 },
    ]
  },
  {
    id: "inprogress",
    title: "Đang xử lý (In Progress)",
    color: "bg-[#3b82f6]",
    tasks: [
      { id: "TSK-03", title: "Vệ sinh hành lang Tầng 2", room: "LK01", priority: "low", due: "23/06/2026", comments: 5, attachments: 2 },
    ]
  },
  {
    id: "review",
    title: "Chờ duyệt (Review)",
    color: "bg-[#f97316]",
    tasks: [
      { id: "TSK-04", title: "Bảo trì thang máy", room: "LK02", priority: "high", due: "Hôm qua", comments: 1, attachments: 0, overdue: true },
    ]
  },
  {
    id: "done",
    title: "Hoàn thành (Done)",
    color: "bg-[#22c55e]",
    tasks: [
      { id: "TSK-05", title: "Sửa máy lạnh", room: "P305 - LK01", priority: "high", due: "15/06", comments: 0, attachments: 1 },
      { id: "TSK-06", title: "Thay bóng đèn", room: "P201 - LK02", priority: "low", due: "12/06", comments: 0, attachments: 0 },
    ]
  }
];

export default function TasksBoard() {
  return (
    <div className="flex-1 w-full flex flex-col md:overflow-hidden h-full min-h-[500px]">
      
      {/* Desktop Kanban Board */}
      <div className="hidden md:flex flex-1 gap-6 overflow-x-auto pb-4 pt-2 hide-scrollbar">
        {columns.map((col) => (
          <div key={col.id} className="flex-shrink-0 w-[300px] flex flex-col h-full bg-muted/20 dark:bg-muted/10 rounded-2xl p-4 border border-border/50 shadow-inner">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`}></div>
                <h3 className="text-[13px] font-black text-text uppercase tracking-wide">{col.title}</h3>
              </div>
              <span className="text-[12px] font-bold text-muted bg-card px-2.5 py-0.5 rounded-full border border-border shadow-sm">{col.tasks.length}</span>
            </div>
            
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto hide-scrollbar">
              {col.tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Priority List */}
      <div className="flex md:hidden flex-col gap-4">
        {/* Nhóm ưu tiên / Sắp đến hạn */}
        <div>
          <h3 className="text-[12px] font-black text-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5"><AlertCircle size={14} className="text-[#ef4444]" /> Cần xử lý gấp</h3>
          <div className="flex flex-col gap-3">
            <TaskCard task={columns[0].tasks[0]} />
            <TaskCard task={columns[2].tasks[0]} />
          </div>
        </div>

        {/* Các công việc khác */}
        <div className="mt-2">
          <h3 className="text-[12px] font-black text-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5"><Clock size={14} /> Tất cả công việc</h3>
          <div className="flex flex-col gap-3">
            <TaskCard task={columns[0].tasks[1]} />
            <TaskCard task={columns[1].tasks[0]} />
          </div>
        </div>
      </div>

    </div>
  );
}

function TaskCard({ task }: { task: any }) {
  const getPriorityColor = (p: string) => {
    if (p === 'high') return 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20';
    if (p === 'medium') return 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20';
    return 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20';
  };
  const getPriorityLabel = (p: string) => {
    if (p === 'high') return 'Cao';
    if (p === 'medium') return 'TB';
    return 'Thấp';
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[#4f46e5]/50 hover:ring-1 hover:ring-[#4f46e5]/20 transition-all cursor-pointer group flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-bold text-text leading-snug group-hover:text-[#4f46e5] transition-colors line-clamp-2">{task.title}</h4>
        <span className={`shrink-0 px-2 py-0.5 rounded-[6px] text-[10px] font-bold border ${getPriorityColor(task.priority)}`}>
          {getPriorityLabel(task.priority)}
        </span>
      </div>
      
      <p className="text-[12px] font-medium text-muted">{task.room}</p>
      
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-3">
          {task.comments > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted">
              <MessageSquare size={12} /> {task.comments}
            </div>
          )}
          {task.attachments > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted">
              <Paperclip size={12} /> {task.attachments}
            </div>
          )}
        </div>
        
        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${task.overdue ? 'text-[#ef4444]' : 'text-muted'}`}>
          <Clock size={12} /> {task.due}
        </div>
      </div>
    </div>
  );
}
