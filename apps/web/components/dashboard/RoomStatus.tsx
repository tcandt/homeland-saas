import React from "react";

export default function RoomStatus() {
  const statuses = [
    { label: "Đang thuê", count: 31, displayPercent: "77.5%", drawPercent: 77.5, color: "bg-[#3b82f6]", stroke: "#3b82f6" },
    { label: "Trống", count: 5, displayPercent: "12.5%", drawPercent: 12.5, color: "bg-[#22c55e]", stroke: "#22c55e" },
    { label: "Đã cọc", count: 3, displayPercent: "7.5%", drawPercent: 7.5, color: "bg-[#8b5cf6]", stroke: "#8b5cf6" },
    { label: "Cần dọn", count: 2, displayPercent: "5.0%", drawPercent: 5.0, color: "bg-[#f97316]", stroke: "#f97316" },
    { label: "Bảo trì", count: 1, displayPercent: "2.5%", drawPercent: 2.5, color: "bg-[#ef4444]", stroke: "#ef4444" },
  ];

  const totalDraw = 105; // Normalize because the mockup's percentages sum to 105%
  let currentOffset = 0;
  const segments = statuses.map(s => {
    // Normalize percentage so they sum to 100
    const normalizedPercent = (s.drawPercent / totalDraw) * 100;
    const dashoffset = -currentOffset;
    currentOffset += normalizedPercent;
    
    // Add gap manually by slightly reducing the dash length
    const dashGap = 1.5; // 1.5% gap
    const dashLength = Math.max(0, normalizedPercent - dashGap);
    const finalDashArray = `${dashLength} 100`;

    return {
      ...s,
      dashoffset,
      finalDashArray
    };
  });

  return (
    <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[24px]">
        <h3 className="font-black text-[14px] text-text uppercase m-0">Tình trạng phòng</h3>
        <a href="#" className="text-[#4f46e5] text-[13px] font-bold hover:underline">Xem chi tiết</a>
      </div>

      <div className="flex items-center justify-between flex-1 gap-[20px]">
        {/* Donut Chart */}
        <div className="relative w-[140px] h-[140px] shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
            {/* Background track */}
            <circle cx="18" cy="18" r="15.9154943" fill="none" stroke="#f1f5f9" strokeWidth="4" />
            
            {segments.map((s, i) => (
              <circle 
                key={i}
                cx="18" 
                cy="18" 
                r="15.9154943" 
                fill="none" 
                stroke={s.stroke} 
                strokeWidth="5" 
                strokeDasharray={s.finalDashArray}
                strokeDashoffset={s.dashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[24px] font-black leading-none mb-1">40</div>
            <div className="text-[10px] font-bold text-muted uppercase">Tổng phòng</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-[12px] flex-1">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-[8px]">
                <div className={`w-[8px] h-[8px] rounded-full ${s.color}`}></div>
                <span className="text-[13px] font-bold text-text">{s.label}</span>
              </div>
              <div className="flex items-center gap-[6px]">
                <span className="text-[13px] font-black text-text">{s.count}</span>
                <span className="text-[12px] font-medium text-muted w-[45px] text-right">({s.displayPercent})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
