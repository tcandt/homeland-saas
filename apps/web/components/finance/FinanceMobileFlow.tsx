"use client";

import React, { useState } from "react";
import { 
  ArrowUpRight, ArrowDownRight, Wallet, AlertCircle, 
  AlertTriangle, Phone, MessageCircle, Bell, Plus,
  FileText, TrendingDown, CheckCircle2, ChevronRight, X, Clock, Receipt, Coins, CreditCard
} from "lucide-react";

// --- MOCK DATA ---
const chartData = [
  { name: "T1", thu: 300, chi: 80, lai: 220 },
  { name: "T2", thu: 310, chi: 85, lai: 225 },
  { name: "T3", thu: 305, chi: 82, lai: 223 },
  { name: "T4", thu: 330, chi: 90, lai: 240 },
  { name: "T5", thu: 325, chi: 88, lai: 237 },
  { name: "T6", thu: 345, chi: 82, lai: 263 },
];

const debtors = [
  { name: "Nguyễn Văn A", amount: 5350000, days: 12, room: "P.101" },
  { name: "Trần Văn B", amount: 3200000, days: 7, room: "P.205" },
  { name: "Lê Văn C", amount: 2700000, days: 0, room: "P.302" }, // 0 = sắp đến hạn
  { name: "Phạm Thị D", amount: 1500000, days: 5, room: "P.401" }, 
  { name: "Hoàng Văn E", amount: 2000000, days: 2, room: "P.102" }, 
];

const urgentActions = [
  { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/10", title: "12 hóa đơn quá hạn", sub: "Tổng giá trị: 18.5 Tr" },
  { icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10", title: "3 khách nợ trên 30 ngày", sub: "Nguy cơ nợ xấu cao" },
  { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", title: "Chi phí điện tăng 22%", sub: "Bất thường so với tháng trước" },
  { icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/10", title: "Chưa đối soát 5 GD", sub: "Ngân hàng MB Bank" },
  { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", title: "Hợp đồng sắp hết hạn", sub: "Phòng P.102 (còn 5 ngày)" },
];

const cashflowBreakdown = [
  { name: "Thuê phòng", thu: 280000000, chi: 0, thuPercent: 81, chiPercent: 0, trend: "+8%" },
  { name: "Điện", thu: 40000000, chi: 35000000, thuPercent: 12, chiPercent: 42, trend: "+22%", anomaly: true },
  { name: "Nước", thu: 10000000, chi: 8000000, thuPercent: 3, chiPercent: 10, trend: "+1%" },
  { name: "Dịch vụ", thu: 10500000, chi: 0, thuPercent: 3, chiPercent: 0, trend: "0%" },
  { name: "Tiền cọc", thu: 10000000, chi: 12000000, thuPercent: 3, chiPercent: 15, trend: "+50%" },
  { name: "Lương nhân viên", thu: 0, chi: 15000000, thuPercent: 0, chiPercent: 18, trend: "0%" },
  { name: "Bảo trì", thu: 0, chi: 12400000, thuPercent: 0, chiPercent: 15, trend: "-5%" },
];

const transactions = [
  { id: "TXN-8472", time: "08:15", date: "23/06", description: "Thu tiền phòng P.101", amount: 5000000, type: "in" },
  { id: "TXN-8471", time: "09:45", date: "23/06", description: "Thanh toán điện nước", amount: 1200000, type: "out" },
  { id: "TXN-8470", time: "10:12", date: "23/06", description: "Hoàn cọc P.205", amount: 5000000, type: "out" },
  { id: "TXN-8469", time: "14:30", date: "22/06", description: "Thu tiền dịch vụ", amount: 450000, type: "in" },
];

// --- UTILS ---
const formatCompact = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " Tr";
  return new Intl.NumberFormat("vi-VN").format(num);
};

export default function FinanceMobileFlow() {
  const [activeChartPoint, setActiveChartPoint] = useState<number | null>(null);
  const [showAllUrgent, setShowAllUrgent] = useState(false);
  const [showAllDebtors, setShowAllDebtors] = useState(false);

  return (
    <div className="flex flex-col gap-[20px] w-full box-border pb-[100px] bg-background">


      
      {/* SECTION 1: Financial Health Snapshot */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-black text-text px-1">Tổng quan Tài chính</h3>
        <div className="grid grid-cols-2 gap-[12px]">
          {/* Thu */}
          <div className="h-[72px] bg-card border border-emerald-500/20 shadow-sm rounded-[12px] p-3 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-[12px] font-semibold text-muted uppercase">Tổng Thu</span>
              <span className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-[4px]">+12%</span>
            </div>
            <span className="text-[24px] font-black text-emerald-500 leading-none">345.5 Tr</span>
          </div>
          {/* Chi */}
          <div className="h-[72px] bg-card border border-rose-500/20 shadow-sm rounded-[12px] p-3 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-[12px] font-semibold text-muted uppercase">Tổng Chi</span>
              <span className="text-[11px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-[4px]">+4%</span>
            </div>
            <span className="text-[24px] font-black text-rose-500 leading-none">82.4 Tr</span>
          </div>
          {/* Lợi nhuận */}
          <div className="h-[72px] bg-card border border-[#4f46e5]/20 shadow-sm rounded-[12px] p-3 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-[12px] font-semibold text-muted uppercase">Lợi Nhuận</span>
              <span className="text-[11px] font-bold text-[#4f46e5] bg-[#4f46e5]/10 px-1.5 py-0.5 rounded-[4px]">+18%</span>
            </div>
            <span className="text-[24px] font-black text-[#4f46e5] leading-none">263.1 Tr</span>
          </div>
          {/* Nợ */}
          <div className="h-[72px] bg-card border border-orange-500/20 shadow-sm rounded-[12px] p-3 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-[12px] font-semibold text-muted uppercase">Công Nợ</span>
              <span className="text-[11px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-[4px]">7 Khách</span>
            </div>
            <span className="text-[24px] font-black text-orange-500 leading-none">45.0 Tr</span>
          </div>
        </div>
      </section>

      {/* SECTION 2: Urgent Financial Actions */}
      <section className="flex flex-col gap-2">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[15px] font-black text-text">Cần xử lý ngay</h3>
          {urgentActions.length > 3 && (
            <span className="text-[11px] font-bold text-[#4f46e5] cursor-pointer" onClick={() => setShowAllUrgent(true)}>Xem thêm</span>
          )}
        </div>
        <div className="bg-card border border-border shadow-sm rounded-[12px] overflow-hidden flex flex-col divide-y divide-border">
          {urgentActions.slice(0, 3).map((action, i) => {
            const IconComponent = action.icon;
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-3 hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer">
                <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0 ${action.bg}`}>
                  <IconComponent size={14} className={action.color} />
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[13px] font-bold text-text">{action.title}</span>
                  <span className="text-[11px] text-muted font-medium">{action.sub}</span>
                </div>
                <ChevronRight size={16} className="text-muted" />
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: Cash Flow Trend */}
      <section className="flex flex-col gap-2">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[15px] font-black text-text">Xu hướng Dòng tiền</h3>
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[11px] font-bold text-muted">Thu</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
              <span className="text-[11px] font-bold text-muted">Chi</span>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-[12px] p-3 h-[180px] flex flex-col relative overflow-hidden group">
          <div className="flex-1 relative mt-1 mx-2">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
              <defs>
                <linearGradient id="colorThu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorChi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              {/* Grid lines */}
              <line x1="0" y1="25" x2="100" y2="25" stroke="currentColor" strokeOpacity="0.05" strokeWidth="0.5" strokeDasharray="2" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeOpacity="0.05" strokeWidth="0.5" strokeDasharray="2" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="currentColor" strokeOpacity="0.05" strokeWidth="0.5" strokeDasharray="2" />
              
              {(() => {
                const max = 400;
                const pointsThu = chartData.map((d, i) => `${(i / (chartData.length - 1)) * 100},${100 - (d.thu / max) * 100}`).join(' ');
                const pointsChi = chartData.map((d, i) => `${(i / (chartData.length - 1)) * 100},${100 - (d.chi / max) * 100}`).join(' ');
                
                const areaThu = `${pointsThu} 100,100 0,100`;
                const areaChi = `${pointsChi} 100,100 0,100`;

                return (
                  <>
                    <polygon points={areaThu} fill="url(#colorThu)" />
                    <polyline points={pointsThu} fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    {chartData.map((d, i) => (
                      <circle key={`thu-${i}`} cx={(i / (chartData.length - 1)) * 100} cy={100 - (d.thu / max) * 100} r="2" fill="#10b981" />
                    ))}
                    
                    <polygon points={areaChi} fill="url(#colorChi)" />
                    <polyline points={pointsChi} fill="none" stroke="#f43f5e" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                    {chartData.map((d, i) => (
                      <circle key={`chi-${i}`} cx={(i / (chartData.length - 1)) * 100} cy={100 - (d.chi / max) * 100} r="2" fill="#f43f5e" />
                    ))}
                  </>
                );
              })()}
            </svg>

            {/* Interactive Data Points & Tooltips */}
            <div className="absolute inset-0 flex justify-between">
              {chartData.map((d, i) => (
                <div 
                  key={i} 
                  className="h-full flex flex-col justify-end relative w-8 -ml-4 items-center cursor-pointer"
                  onClick={() => setActiveChartPoint(activeChartPoint === i ? null : i)}
                >
                  <div className={`w-px h-full transition-colors ${activeChartPoint === i ? 'bg-border/80' : 'bg-border/0'}`}></div>
                  {/* Tooltip */}
                  <div className={`absolute top-0 mt-0 transition-opacity bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold py-1.5 px-2.5 rounded-[6px] whitespace-nowrap z-50 shadow-xl pointer-events-none ${activeChartPoint === i ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="text-emerald-500">Thu: {d.thu} Tr</div>
                    <div className="text-rose-500">Chi: {d.chi} Tr</div>
                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black dark:border-t-white"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between px-1 mt-3 text-[11px] font-bold text-muted z-10 relative">
            {chartData.map((d, i) => (
              <span key={i} className="w-8 text-center -ml-4 first:ml-0 last:-mr-4 first:text-left last:text-right">{d.name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: Accounts Receivable Center */}
      <section className="flex flex-col gap-2">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[15px] font-black text-text">Trung tâm Công nợ (Phải thu)</h3>
          {debtors.length > 3 && (
            <span className="text-[11px] font-bold text-[#4f46e5] cursor-pointer" onClick={() => setShowAllDebtors(true)}>Xem thêm</span>
          )}
        </div>
        
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-[12px] p-4 flex flex-col items-center justify-center text-center shadow-sm mt-1">
          <span className="text-[12px] font-bold text-muted uppercase">Tổng phải thu</span>
          <span className="text-[28px] font-black text-orange-500 leading-tight my-1">45.000.000đ</span>
          <div className="flex gap-2 text-[12px] font-medium text-text mt-1">
            <span className="bg-orange-500/10 px-2 py-0.5 rounded-[4px] text-orange-600">18 hóa đơn</span>
            <span className="bg-orange-500/10 px-2 py-0.5 rounded-[4px] text-orange-600">7 khách đang nợ</span>
          </div>
        </div>

        <div className="bg-card border border-border shadow-sm rounded-[12px] overflow-hidden flex flex-col mt-1">
          <div className="px-3 py-2 bg-black/5 dark:bg-white/5 border-b border-border/50">
            <span className="text-[11px] font-bold text-muted uppercase">Top Khách Nợ (Cần thu ngay)</span>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {debtors.slice(0, 3).map((d, i) => (
              <div key={i} className="flex flex-col p-3 gap-2">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold text-text">{d.name} <span className="text-muted font-medium text-[12px]">({d.room})</span></span>
                    <span className={`text-[11px] font-bold mt-0.5 ${d.days > 0 ? 'text-rose-500' : 'text-amber-500'}`}>
                      {d.days > 0 ? `Quá hạn ${d.days} ngày` : 'Sắp đến hạn'}
                    </span>
                  </div>
                  <span className="text-[14px] font-black text-orange-500">{formatCompact(d.amount)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button className="flex-1 py-1.5 rounded-[6px] border border-border bg-card text-[11px] font-bold text-text flex justify-center items-center gap-1 hover:bg-black/5">
                    <Phone size={12} /> Gọi
                  </button>
                  <button className="flex-1 py-1.5 rounded-[6px] border border-border bg-card text-[11px] font-bold text-blue-500 flex justify-center items-center gap-1 hover:bg-black/5">
                    <MessageCircle size={12} /> Zalo
                  </button>
                  <button className="flex-[2] py-1.5 rounded-[6px] bg-[#4f46e5] text-white text-[11px] font-bold flex justify-center items-center gap-1 hover:bg-[#4338ca]">
                    <Coins size={12} /> Nhắc thu
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: Unified Cashflow Breakdown */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-black text-text px-1">Cơ cấu Thu / Chi</h3>
        <div className="bg-card border border-border shadow-sm rounded-[12px] overflow-hidden flex flex-col divide-y divide-border">
          {cashflowBreakdown.map((item, i) => (
            <div key={i} className="flex flex-col p-3 gap-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span className="text-[14px] font-bold text-text">{item.name}</span>
                  {item.anomaly && <AlertTriangle size={12} className="text-amber-500" />}
                </div>
                <span className={`text-[11px] font-bold ${
                  item.trend.startsWith('+') 
                    ? (item.anomaly || item.name === "Hoàn cọc" ? 'text-rose-500' : 'text-emerald-500') 
                    : (item.trend === '0%' ? 'text-muted' : (item.name === "Bảo trì" ? 'text-emerald-500' : 'text-rose-500'))
                }`}>
                  {item.trend}
                </span>
              </div>
              
              <div className="flex flex-col gap-1.5">
                {item.thu > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-500 w-5">Thu</span>
                    <div className="flex-1 h-1.5 bg-emerald-500/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.thuPercent}%` }} />
                    </div>
                    <span className="text-[12px] font-black text-text w-[60px] text-right">{formatCompact(item.thu)}</span>
                  </div>
                )}
                {item.chi > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-rose-500 w-5">Chi</span>
                    <div className="flex-1 h-1.5 bg-rose-500/10 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${item.chiPercent}%` }} />
                    </div>
                    <span className="text-[12px] font-black text-text w-[60px] text-right">{formatCompact(item.chi)}</span>
                  </div>
                )}
              </div>
              {item.anomaly && (
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-[4px] self-start mt-0.5">
                  ⚠ Chi phí tăng bất thường
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 7: Recent Transactions Ledger */}
      <section className="flex flex-col gap-2">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[15px] font-black text-text">Sổ cái Giao dịch (Gần nhất)</h3>
          <span className="text-[11px] font-bold text-[#4f46e5] cursor-pointer">Xem tất cả</span>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-[12px] overflow-hidden flex flex-col divide-y divide-border">
          {transactions.map((t, i) => (
            <div key={i} className="flex items-center justify-between p-3 hover:bg-black/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center w-[36px]">
                  <span className="text-[11px] font-black text-text leading-none">{t.time}</span>
                  <span className="text-[9px] font-semibold text-muted mt-0.5">{t.date}</span>
                </div>
                <div className="w-px h-[24px] bg-border/50"></div>
              <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-text">{t.description}</span>
                  <span className="text-[10px] text-muted font-medium mt-0.5">{t.id}</span>
                </div>
              </div>
              <span className={`text-[13px] font-black ${t.type === 'in' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {t.type === 'in' ? '+' : '-'}{formatCompact(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* MODALS */}
      {showAllUrgent && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={() => setShowAllUrgent(false)} />
          <div className="relative w-full h-[60vh] bg-background rounded-[16px] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center px-4 py-3 border-b border-border">
              <h2 className="flex-1 text-[16px] font-black text-text">Tất cả cảnh báo ({urgentActions.length})</h2>
              <button onClick={() => setShowAllUrgent(false)} className="p-1.5 rounded-full bg-black/5 active:bg-black/10 transition-colors">
                <X size={20} className="text-text" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {urgentActions.map((action, i) => {
                const IconComponent = action.icon;
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-3 bg-card border border-border shadow-sm rounded-[12px] active:scale-[0.98] transition-transform cursor-pointer">
                    <div className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center shrink-0 ${action.bg}`}>
                      <IconComponent size={18} className={action.color} />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <span className="text-[14px] font-bold text-text">{action.title}</span>
                      <span className="text-[12px] text-muted font-medium">{action.sub}</span>
                    </div>
                    <ChevronRight size={16} className="text-muted opacity-50" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showAllDebtors && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={() => setShowAllDebtors(false)} />
          <div className="relative w-full h-[65vh] bg-background rounded-[16px] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center px-4 py-3 border-b border-border">
              <h2 className="flex-1 text-[16px] font-black text-text">Tất cả công nợ ({debtors.length})</h2>
              <button onClick={() => setShowAllDebtors(false)} className="p-1.5 rounded-full bg-black/5 active:bg-black/10 transition-colors">
                <X size={20} className="text-text" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {debtors.map((d, i) => (
                <div key={i} className="flex flex-col p-4 bg-card border border-border shadow-sm rounded-[12px] gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold text-text">{d.name} <span className="text-muted font-medium text-[12px]">({d.room})</span></span>
                      <span className={`text-[11px] font-bold mt-1 inline-flex w-fit px-2 py-0.5 rounded-[4px] ${d.days > 0 ? 'text-rose-500 bg-rose-500/10' : 'text-amber-500 bg-amber-500/10'}`}>
                        {d.days > 0 ? `Quá hạn ${d.days} ngày` : 'Sắp đến hạn'}
                      </span>
                    </div>
                    <span className="text-[15px] font-black text-orange-500">{formatCompact(d.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button className="flex-1 py-1.5 rounded-[8px] border border-border bg-background text-[11px] font-bold text-text flex justify-center items-center gap-1.5 active:bg-black/5 transition-colors">
                      <Phone size={12} /> Gọi
                    </button>
                    <button className="flex-1 py-1.5 rounded-[8px] border border-border bg-background text-[11px] font-bold text-blue-500 flex justify-center items-center gap-1.5 active:bg-black/5 transition-colors">
                      <MessageCircle size={12} /> Zalo
                    </button>
                    <button className="flex-[2] py-1.5 rounded-[8px] bg-[#4f46e5] text-white text-[11px] font-bold flex justify-center items-center gap-1.5 active:scale-95 transition-transform shadow-sm">
                      <Coins size={12} /> Nhắc thu
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
