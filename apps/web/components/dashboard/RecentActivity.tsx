import React from "react";
import { MessageSquare } from "lucide-react";

export default function RecentActivity() {
  const activities = [
    {
      time: "09:30",
      avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop",
      title: (<span>Manager xác nhận thanh toán hóa đơn <span className="text-[#3b82f6] cursor-pointer hover:underline">INV-000201</span></span>),
      desc: "Phòng 201 - LK01.31",
      amount: "+9.500.000 đ",
      amountColor: "text-[#22c55e]"
    },
    {
      time: "09:05",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
      title: (<span>Sales tạo cọc mới cho khách <span className="text-[#3b82f6] cursor-pointer hover:underline">Trần Minh Đức</span></span>),
      desc: "Phòng 301 - LK08.24",
      amount: "+5.000.000 đ",
      amountColor: "text-[#22c55e]"
    },
    {
      time: "08:40",
      avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop",
      title: (<span>Admin cập nhật hợp đồng <span className="text-[#3b82f6] cursor-pointer hover:underline">HD-000121</span></span>),
      desc: "Phòng 102 - LK01.32",
      amount: "",
      amountColor: ""
    },
    {
      time: "08:10",
      icon: <div className="w-[32px] h-[32px] rounded-full bg-[#3b82f6] text-white flex items-center justify-center shrink-0"><MessageSquare size={16}/></div>,
      title: "Hệ thống gửi Zalo nhắc nợ khách hàng",
      desc: "Phòng 202 - LK01.31",
      amount: "",
      amountColor: ""
    },
    {
      time: "07:50",
      avatar: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop",
      title: (<span>Khách thanh toán hóa đơn <span className="text-[#3b82f6] cursor-pointer hover:underline">INV-000198</span></span>),
      desc: "Phòng 401 - LK08.25",
      amount: "+8.200.000 đ",
      amountColor: "text-[#22c55e]"
    },
  ];

  return (
    <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[24px]">
        <h3 className="font-black text-[14px] text-text uppercase m-0">Hoạt động gần đây</h3>
        <a href="#" className="text-[#4f46e5] text-[13px] font-bold hover:underline">Xem tất cả</a>
      </div>

      <div className="flex flex-col gap-[20px] flex-1">
        {activities.map((act, i) => (
          <div key={i} className="flex items-start gap-[12px]">
            <div className="text-[11px] font-bold text-muted/70 w-[35px] mt-[6px]">{act.time}</div>
            
            {act.avatar ? (
              <img src={act.avatar} alt="Avatar" className="w-[32px] h-[32px] rounded-full object-cover shrink-0 border border-border/50" />
            ) : (
              act.icon
            )}

            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-text leading-tight mb-1 line-clamp-2">{act.title}</div>
              <div className="text-[12px] text-muted font-medium">{act.desc}</div>
            </div>

            {act.amount && (
              <div className={`font-black text-[12px] shrink-0 ${act.amountColor} mt-[6px]`}>
                {act.amount}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
