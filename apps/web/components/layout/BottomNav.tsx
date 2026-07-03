import React from "react";
import { Home, Building, DollarSign, CheckSquare, Grid } from "lucide-react";

export default function BottomNav() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-card border-t border-border flex items-center justify-around pb-[15px] z-40 transition-colors">
      <NavItem icon={<Home size={24} />} label="Dashboard" active />
      <NavItem icon={<Building size={24} />} label="Properties" />
      <NavItem icon={<DollarSign size={24} />} label="Finances" />
      <NavItem icon={<CheckSquare size={24} />} label="Task" />
      <NavItem icon={<Grid size={24} />} label="More" />
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 cursor-pointer w-[64px] ${active ? 'text-[#4f46e5]' : 'text-muted hover:text-text'}`}>
      <div className={active ? 'opacity-100' : 'opacity-80'}>
        {icon}
      </div>
      <span className="text-[10px] font-bold">{label}</span>
    </div>
  );
}
