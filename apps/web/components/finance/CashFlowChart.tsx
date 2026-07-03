import React from "react";

const data = [
  { month: "Tháng 1", thu: 280, chi: 120 },
  { month: "Tháng 2", thu: 300, chi: 110 },
  { month: "Tháng 3", thu: 320, chi: 140 },
  { month: "Tháng 4", thu: 310, chi: 105 },
  { month: "Tháng 5", thu: 330, chi: 150 },
  { month: "Tháng 6", thu: 345.5, chi: 82.4 },
];

export default function CashFlowChart() {
  const maxValue = 400; // max Y axis value

  return (
    <div className="bg-card border border-border rounded-[20px] p-[20px] shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[16px] font-black text-text">Dòng tiền (6 tháng)</h3>
          <p className="text-[12px] font-medium text-muted mt-1">Biến động thu chi theo thời gian (Triệu VNĐ)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#4f46e5]"></div>
            <span className="text-[12px] font-bold text-muted">Tổng Thu</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#ef4444]"></div>
            <span className="text-[12px] font-bold text-muted">Tổng Chi</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[250px] relative mt-4">
        {/* Y-axis grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pb-8">
          {[400, 300, 200, 100, 0].map((val, i) => (
            <div key={i} className="flex items-center w-full">
              <span className="w-8 text-right text-[10px] font-bold text-muted/60 mr-4">{val}</span>
              <div className="flex-1 border-b border-border/50 border-dashed"></div>
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="absolute inset-0 ml-12 pb-8 flex items-end justify-between px-2 md:px-8">
          {data.map((d, i) => {
            const thuHeight = (d.thu / maxValue) * 100;
            const chiHeight = (d.chi / maxValue) * 100;

            return (
              <div key={i} className="flex flex-col items-center group relative w-12 md:w-16">
                <div className="flex items-end gap-1 md:gap-2 w-full h-full justify-center absolute bottom-0">
                  {/* Cột Chi */}
                  <div 
                    className="w-[12px] md:w-[16px] bg-[#ef4444] rounded-t-[4px] opacity-90 transition-all group-hover:opacity-100"
                    style={{ height: `${chiHeight}%` }}
                  ></div>
                  {/* Cột Thu */}
                  <div 
                    className="w-[12px] md:w-[16px] bar-gradient rounded-t-[4px] opacity-90 transition-all group-hover:opacity-100"
                    style={{ height: `${thuHeight}%` }}
                  ></div>
                </div>

                {/* X-axis label */}
                <div className="absolute -bottom-7 text-[11px] font-bold text-muted">{d.month}</div>

                {/* Tooltip on Hover */}
                <div className="absolute bottom-full mb-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black dark:bg-white text-white dark:text-black text-[11px] font-bold py-1.5 px-3 rounded-[8px] whitespace-nowrap pointer-events-none z-10 shadow-lg">
                  Thu: {d.thu}tr <br/> Chi: {d.chi}tr
                  {/* Arrow for tooltip */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black dark:border-t-white"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
