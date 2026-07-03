"use client";
import React, { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Search, CheckCircle2, AlertCircle, AlertTriangle, Settings2, Link as LinkIcon, RefreshCcw, Wrench, PlugZap, CloudOff } from "lucide-react";

const integrationGroups = [
  {
    id: "payment",
    label: "Payment",
    desc: "Cổng thanh toán và QR thu tiền",
    items: [
      { name: "Momo", provider: "M-Service", env: "Production", autoSync: true, status: "connected", lastSync: "01/06/2026 08:30" },
      { name: "VietQR", provider: "Napas", env: "Production", autoSync: true, status: "connected", lastSync: "01/06/2026 09:15" },
      { name: "VNPay", provider: "VNPAY", env: "Sandbox", autoSync: false, status: "disconnected", lastSync: null },
      { name: "Stripe", provider: "Stripe Inc.", env: "Sandbox", autoSync: false, status: "error", lastSync: "25/05/2026 14:00" },
    ]
  },
  {
    id: "messaging",
    label: "Messaging",
    desc: "Kênh giao tiếp và gửi thông báo",
    items: [
      { name: "Zalo OA", provider: "Zalo Group", env: "Production", autoSync: true, status: "disconnected", lastSync: null },
      { name: "Telegram Bot", provider: "Telegram", env: "Production", autoSync: true, status: "disconnected", lastSync: null },
      { name: "Email SMTP", provider: "SendGrid", env: "Production", autoSync: false, status: "connected", lastSync: "10/05/2026 11:20" },
      { name: "SMS Gateway", provider: "eSMS", env: "Production", autoSync: false, status: "disconnected", lastSync: null },
    ]
  },
  {
    id: "cloud",
    label: "Cloud Storage",
    desc: "Lưu trữ tài liệu và hợp đồng",
    items: [
      { name: "Google Drive", provider: "Google", env: "Production", autoSync: true, status: "connected", lastSync: "15/05/2026 16:45" },
      { name: "Dropbox", provider: "Dropbox Inc.", env: "Production", autoSync: true, status: "disconnected", lastSync: null },
    ]
  },
  {
    id: "accounting",
    label: "Accounting",
    desc: "Đồng bộ phần mềm kế toán",
    items: [
      { name: "MISA", provider: "MISA JSC", env: "Production", autoSync: false, status: "disconnected", lastSync: null },
      { name: "FAST", provider: "FAST Accounting", env: "Production", autoSync: false, status: "needs_config", lastSync: null },
    ]
  },
];

const tabs = ["Tất cả", "Payment", "Messaging", "Cloud", "Accounting"];

export default function SettingsIntegrations() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Tất cả");

  const getLogoStr = (name: string) => {
    if (name.includes("Momo")) return "M";
    if (name.includes("VietQR")) return "QR";
    if (name.includes("VNPay")) return "VN";
    if (name.includes("Stripe")) return "S";
    if (name.includes("Zalo")) return "Z";
    if (name.includes("Telegram")) return "T";
    if (name.includes("Email")) return "@";
    if (name.includes("SMS")) return "💬";
    if (name.includes("Google")) return "G";
    if (name.includes("Dropbox")) return "D";
    if (name.includes("MISA")) return "M";
    if (name.includes("FAST")) return "F";
    return name.substring(0, 1);
  };

  return (
    <div className="flex flex-col gap-[20px] p-0">
      
      {/* Header gọn gàng */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-[16px] h-auto md:h-[64px] border-b border-border pb-[16px] md:pb-0">
        <div>
          <h2 className="text-[22px] font-bold text-text leading-none tracking-tight">Integration Center</h2>
          <p className="text-[13px] font-medium text-muted mt-[6px]">Quản lý kết nối thanh toán, thông báo, lưu trữ và kế toán.</p>
        </div>
        <div className="relative w-full md:w-[260px] shrink-0">
          <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tích hợp..." 
            className="w-full h-[36px] pl-[34px] pr-[12px] bg-background border border-border rounded-[8px] text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Status Summary (4 cards nhỏ) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <PlugZap size={14} className="text-success" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Đã kết nối</span>
          </div>
          <div className="text-[20px] font-black text-text">4</div>
        </div>
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <CloudOff size={14} />
            <span className="text-[12px] font-bold uppercase tracking-wide">Chưa kết nối</span>
          </div>
          <div className="text-[20px] font-black text-text">7</div>
        </div>
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <AlertCircle size={14} className="text-danger" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Lỗi kết nối</span>
          </div>
          <div className="text-[20px] font-black text-text">1</div>
        </div>
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <AlertTriangle size={14} className="text-warning" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Cần cấu hình</span>
          </div>
          <div className="text-[20px] font-black text-text">1</div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-[8px] overflow-x-auto pb-[4px]">
        {tabs.map((t) => (
          <Button 
            key={t}
            onClick={() => setActiveTab(t)}
            className={`h-[36px] px-[16px] rounded-full text-[13px] font-bold whitespace-nowrap transition-colors
              ${activeTab === t 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "bg-background border border-border text-muted hover:bg-black/5 dark:hover:bg-card/5 hover:text-text"}`}
          >
            {t}
          </Button>
        ))}
      </div>

      {/* Integration Groups */}
      <div className="flex flex-col gap-[32px] pt-[8px]">
        {integrationGroups.map((group) => {
          // Filter logic
          if (activeTab !== "Tất cả" && activeTab !== group.label && activeTab !== "Cloud Storage" && activeTab !== "Messaging") {
            if (activeTab === "Cloud" && group.id !== "cloud") return null;
            if (activeTab !== "Cloud" && activeTab !== group.label) return null;
          }

          const filteredItems = group.items.filter(item => 
            item.name.toLowerCase().includes(search.toLowerCase()) || 
            item.provider.toLowerCase().includes(search.toLowerCase())
          );
          
          if (filteredItems.length === 0) return null;

          return (
            <div key={group.id} className="flex flex-col gap-[16px]">
              {/* Group Header */}
              <div className="flex flex-col">
                <h3 className="text-[16px] font-bold text-text">{group.label}</h3>
                <p className="text-[13px] font-medium text-muted mt-[2px]">{group.desc}</p>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[16px]">
                {filteredItems.map((item) => {
                  const isConnected = item.status === "connected";
                  const isError = item.status === "error";
                  const isConfig = item.status === "needs_config";

                  return (
                    <div key={item.name} className={`relative flex flex-col h-[148px] bg-background border rounded-[16px] p-[16px] transition-all hover:border-primary hover:shadow-sm
                      ${isConnected ? "border-success/30" : isError ? "border-danger/30" : "border-border"}
                    `}>
                      
                      {/* Top Row: Logo, Name, Badge */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-[12px]">
                          <div className="w-[40px] h-[40px] rounded-[10px] bg-card border border-border flex items-center justify-center font-bold text-[15px] text-text shadow-sm">
                            {getLogoStr(item.name)}
                          </div>
                          <div>
                            <div className="text-[15px] font-bold text-text">{item.name}</div>
                            <div className="text-[12px] font-medium text-muted">{item.provider}</div>
                          </div>
                        </div>
                        {/* Status Badge */}
                        {isConnected && <span className="flex items-center gap-[4px] px-[8px] py-[3px] rounded-[6px] bg-success/10 text-success text-[11px] font-bold border border-success/20"><CheckCircle2 size={12}/> Connected</span>}
                        {isError && <span className="flex items-center gap-[4px] px-[8px] py-[3px] rounded-[6px] bg-danger/10 text-danger text-[11px] font-bold border border-danger/20"><AlertCircle size={12}/> Error</span>}
                        {isConfig && <span className="flex items-center gap-[4px] px-[8px] py-[3px] rounded-[6px] bg-warning/10 text-warning text-[11px] font-bold border border-warning/20"><Wrench size={12}/> Needs Config</span>}
                        {!isConnected && !isError && !isConfig && <span className="flex items-center gap-[4px] px-[8px] py-[3px] rounded-[6px] bg-card text-muted text-[11px] font-bold border border-border">Not connected</span>}
                      </div>

                      {/* Middle Row: Meta info */}
                      <div className="mt-[12px] flex items-center gap-[16px] text-[12px] font-medium text-muted">
                        <div className="flex flex-col gap-[2px]">
                          <span>Env: <strong className="text-text">{item.env}</strong></span>
                          <span>Sync: <strong className="text-text">{item.autoSync ? "Auto" : "Manual"}</strong></span>
                        </div>
                        <div className="flex flex-col gap-[2px] border-l border-border pl-[16px]">
                          <span>Last sync:</span>
                          <strong className="text-text">{item.lastSync || "Never"}</strong>
                        </div>
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="mt-auto pt-[12px] flex items-center gap-[8px] border-t border-border/50">
                        {isConnected ? (
                          <>
                            <Button className="h-[28px] px-[12px] rounded-[6px] bg-background border border-border text-[12px] font-bold text-text hover:bg-black/5 transition-colors flex items-center gap-[6px]">
                              <Settings2 size={12}/> Configure
                            </Button>
                            <Button className="h-[28px] px-[12px] rounded-[6px] text-[12px] font-bold text-muted hover:text-text hover:bg-black/5 transition-colors flex items-center gap-[6px]">
                              <RefreshCcw size={12}/> Test
                            </Button>
                            <Button className="h-[28px] ml-auto px-[12px] rounded-[6px] text-[12px] font-bold text-danger hover:bg-danger/10 transition-colors">
                              Disconnect
                            </Button>
                          </>
                        ) : isError ? (
                          <>
                            <Button className="h-[28px] px-[12px] rounded-[6px] bg-danger text-white text-[12px] font-bold hover:bg-danger/90 transition-colors flex items-center gap-[6px]">
                              <Wrench size={12}/> Fix Connection
                            </Button>
                            <Button className="h-[28px] ml-auto px-[12px] rounded-[6px] text-[12px] font-bold text-muted hover:bg-black/5 transition-colors">
                              Dismiss
                            </Button>
                          </>
                        ) : (
                          <Button className="h-[28px] px-[12px] rounded-[6px] bg-primary text-white text-[12px] font-bold hover:bg-primary/90 shadow-sm transition-colors flex items-center gap-[6px]">
                            <LinkIcon size={12}/> Connect
                          </Button>
                        )}
                      </div>
                      
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
