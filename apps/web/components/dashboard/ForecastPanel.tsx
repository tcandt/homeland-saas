import React from "react";

export default function ForecastPanel() {
  const forecasts = [
    { name: "LK01.31", percent: 95 },
    { name: "LK01.32", percent: 88 },
    { name: "LK08.24", percent: 100 },
    { name: "LK08.25", percent: 70 },
  ];

  return (
    <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[24px]">
        <h3 className="font-black text-[14px] text-text uppercase m-0">Dự báo 30 ngày tới</h3>
        <a href="#" className="text-[#4f46e5] text-[13px] font-bold hover:underline">Xem chi tiết</a>
      </div>

      <div className="flex flex-col gap-[20px] flex-1">
        {forecasts.map((f, i) => (
          <div key={i} className="flex items-center gap-[16px]">
            {/* Image + Name */}
            <div className="flex items-center gap-[12px] w-[90px] shrink-0">
              <div className="w-[32px] h-[32px] rounded-[6px] bg-black/20 dark:bg-white/20 overflow-hidden shrink-0">
                <img src={`https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=100&h=100&fit=crop`} alt={f.name} className="w-full h-full object-cover" />
              </div>
              <div className="font-bold text-[13px] text-text">{f.name}</div>
            </div>

            {/* Progress Bar */}
            <div className="flex-1 h-[8px] bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#3b82f6] rounded-full transition-all duration-500"
                style={{ width: `${f.percent}%` }}
              ></div>
            </div>

            {/* Percent */}
            <div className="w-[35px] text-right font-black text-[13px] text-text shrink-0">
              {f.percent}%
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[24px] text-center font-bold text-[13px] text-[#3b82f6]">
        Dự báo tỷ lệ lấp đầy trung bình: 88%
      </div>
    </div>
  );
}
