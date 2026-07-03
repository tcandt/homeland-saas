import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { 
  FileText, Wallet, Receipt, 
  Settings, Users, ChevronRight, PhoneCall,
  LogOut, ShieldCheck, HelpCircle, Gift
} from "lucide-react";

const quickTools = [
  { href: "/contracts", label: "Hợp đồng", icon: FileText, color: "text-[#22c55e]", bg: "bg-[#22c55e]/10" },
  { href: "/invoices", label: "Hóa đơn", icon: Receipt, color: "text-[#ef4444]", bg: "bg-[#ef4444]/10" },
  { href: "/deposits", label: "Đặt cọc", icon: Wallet, color: "text-[#eab308]", bg: "bg-[#eab308]/10" },
  { href: "/tenants", label: "Khách thuê", icon: Users, color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10" },
];

const advancedFeatures = [
  { href: "/sales", label: "Sales CRM", desc: "Quản lý khách tiềm năng", icon: PhoneCall, color: "text-[#ec4899]", bg: "bg-[#ec4899]/10" },
  { href: "/settings", label: "Cài đặt hệ thống", desc: "Tùy chỉnh & Phân quyền", icon: Settings, color: "text-[#64748b]", bg: "bg-[#64748b]/10" },
];

const supportFeatures = [
  { href: "#", label: "Trung tâm trợ giúp", icon: HelpCircle, color: "text-[#06b6d4]", bg: "bg-[#06b6d4]/10" },
  { href: "#", label: "Giới thiệu bạn bè", icon: Gift, color: "text-[#f97316]", bg: "bg-[#f97316]/10", badge: "Quà" },
];

export default function MenuPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-[16px] w-full max-w-4xl mx-auto pb-[100px] bg-background pt-2">
        
        {/* User Profile Card - Compact */}
        <section className="bg-card border border-border rounded-[14px] p-3 shadow-sm flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer mx-1">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-[42px] h-[42px] rounded-full bg-gradient-to-tr from-[#4f46e5] to-[#f97316] flex items-center justify-center text-white text-[15px] font-black shadow-sm shrink-0">
                VP
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-card rounded-full flex items-center justify-center">
                <ShieldCheck size={8} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-[14px] font-black text-text leading-tight">Văn Thể Phan</h2>
              <p className="text-[11px] font-bold text-[#4f46e5] mt-0.5">Admin Hệ thống</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-muted opacity-50" />
        </section>

        {/* Quick Tools Grid - Compact */}
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-black text-muted uppercase tracking-wider px-3">Nghiệp vụ thường xuyên</h3>
          <div className="grid grid-cols-4 gap-2 px-1">
            {quickTools.map((tool, i) => {
              const Icon = tool.icon;
              return (
                <Link key={i} href={tool.href} className="bg-card border border-border rounded-[12px] p-2.5 flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform group">
                  <div className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center ${tool.bg} ${tool.color}`}>
                    <Icon size={18} />
                  </div>
                  <span className="text-[10px] font-bold text-text text-center leading-tight">{tool.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Advanced Features List - Compact */}
        <section className="flex flex-col gap-2 px-1">
          <h3 className="text-[11px] font-black text-muted uppercase tracking-wider px-2">Tính năng mở rộng</h3>
          <div className="bg-card border border-border rounded-[14px] shadow-sm overflow-hidden flex flex-col divide-y divide-border/50">
            {advancedFeatures.map((item, i) => {
              const Icon = item.icon;
              return (
                <Link key={i} href={item.href} className="flex items-center justify-between p-3 hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-[32px] h-[32px] rounded-[8px] flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex flex-col">
                      <div className="text-[13px] font-bold text-text">{item.label}</div>
                      <div className="text-[11px] font-medium text-muted mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Support & Logout - Compact */}
        <section className="flex flex-col gap-2 px-1 mt-1">
          <div className="bg-card border border-border rounded-[14px] shadow-sm overflow-hidden flex flex-col divide-y divide-border/50">
            {supportFeatures.map((item, i) => {
              const Icon = item.icon;
              return (
                <Link key={i} href={item.href} className="flex items-center justify-between p-3 hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-[32px] h-[32px] rounded-[8px] flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="text-[13px] font-bold text-text flex items-center gap-2">
                      {item.label}
                      {item.badge && <span className="bg-[#f97316] text-white text-[9px] font-black px-1.5 py-0.5 rounded-[4px]">{item.badge}</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </Link>
              );
            })}
            
            <button className="flex items-center gap-3 p-3 hover:bg-rose-500/5 active:bg-rose-500/10 transition-colors text-rose-500 text-left w-full">
              <div className="w-[32px] h-[32px] rounded-[8px] bg-rose-500/10 flex items-center justify-center shrink-0">
                <LogOut size={16} />
              </div>
              <span className="text-[13px] font-bold">Đăng xuất</span>
            </button>
          </div>
        </section>

        <div className="text-center mt-2">
          <p className="text-[10px] font-medium text-muted">Phiên bản 8.0.0 (Premium)</p>
        </div>

      </div>
    </AppShell>
  );
}
