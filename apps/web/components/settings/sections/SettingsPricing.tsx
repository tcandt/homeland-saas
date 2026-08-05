"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Card } from "@/components/ui/Card";
import { Plus, Trash2 } from "lucide-react";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";

type FeeItem = {
  id: string;
  label: string;
  unit: string;
  icon: string;
  price: string;
  method: string;
  enabled: boolean;
};

type TierItem = {
  tier: string;
  from: string;
  to: string;
  price: string;
};

type PricingSettings = {
  fees: FeeItem[];
  tiers: TierItem[];
};

const fallback: PricingSettings = {
  fees: [],
  tiers: [],
};

const methods = ["Fixed", "Tiered", "Per Person", "Per Room", "Per Meter"];

export default function SettingsPricing() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<PricingSettings>("pricing", "TENANT", fallback);
  const [activeTab, setActiveTab] = useState<"fees" | "tiers">("fees");

  const updateFee = (index: number, key: keyof FeeItem, value: string | boolean) => {
    setDraft((prev) => ({
      ...prev,
      fees: prev.fees.map((fee, feeIndex) => (feeIndex === index ? { ...fee, [key]: value } : fee)),
    }));
  };

  const updateTier = (index: number, key: keyof TierItem, value: string) => {
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, [key]: value } : tier)),
    }));
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-[15px] text-text">Pricing & Fees</h3>
            <p className="text-[12px] font-medium text-muted mt-[2px]">Cấu hình giá điện, nước, dịch vụ và các loại phí từ dữ liệu lưu thật.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" className={`h-[36px] px-[14px] rounded-[10px] text-[12px] font-bold transition-colors ${activeTab === "fees" ? "bg-primary text-white" : "bg-background border border-border text-text"}`} onClick={() => setActiveTab("fees")}>
              Phí
            </Button>
            <Button type="button" className={`h-[36px] px-[14px] rounded-[10px] text-[12px] font-bold transition-colors ${activeTab === "tiers" ? "bg-primary text-white" : "bg-background border border-border text-text"}`} onClick={() => setActiveTab("tiers")}>
              Bậc thang
            </Button>
          </div>
        </div>

        {activeTab === "fees" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Loại phí</th>
                  <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Đơn giá</th>
                  <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Đơn vị</th>
                  <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Phương thức</th>
                  <th className="text-center py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Áp dụng</th>
                  <th className="w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {draft.fees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-[28px] px-[12px] text-center text-[13px] font-medium text-muted">
                      Chưa có cấu hình phí trong DB.
                    </td>
                  </tr>
                ) : (
                  draft.fees.map((fee, index) => (
                    <tr key={fee.id} className="border-b border-border/50 hover:bg-black/[0.02] dark:hover:bg-card/[0.02] transition-colors">
                      <td className="py-[12px] px-[12px]">
                        <div className="flex items-center gap-[8px]">
                          <span className="text-[16px]">{fee.icon}</span>
                          <span className="font-bold text-text">{fee.label}</span>
                        </div>
                      </td>
                      <td className="py-[12px] px-[12px]">
                        <Input value={fee.price} onChange={(event) => updateFee(index, "price", event.target.value)} className="w-[120px] h-[34px] px-[10px] bg-background border border-border rounded-[8px] text-[13px] font-medium text-text focus:outline-none focus:border-primary transition-all text-right" />
                      </td>
                      <td className="py-[12px] px-[12px] text-muted font-medium">{fee.unit}</td>
                      <td className="py-[12px] px-[12px]">
                        <div className="w-[120px]">
                          <Select value={fee.method} onChange={(event) => updateFee(index, "method", event.target.value)} options={methods.map((method) => ({ label: method, value: method }))} />
                        </div>
                      </td>
                      <td className="py-[12px] px-[12px] text-center">
                        <Switch checked={fee.enabled} onChange={(event) => updateFee(index, "enabled", event.target.checked)} />
                      </td>
                      <td className="py-[12px] px-[12px]">
                        <Button type="button" className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                          <Trash2 size={13} />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Bậc</th>
                  <th className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Từ</th>
                  <th className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Đến</th>
                  <th className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Đơn giá</th>
                </tr>
              </thead>
              <tbody>
                {draft.tiers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-[28px] px-[12px] text-center text-[13px] font-medium text-muted">
                      Chưa có cấu hình bậc thang trong DB.
                    </td>
                  </tr>
                ) : (
                  draft.tiers.map((tier, index) => (
                    <tr key={tier.tier} className="border-b border-border/50 hover:bg-black/[0.02] dark:hover:bg-card/[0.02]">
                      <td className="py-[10px] px-[12px] font-bold text-text">{tier.tier}</td>
                      <td className="py-[10px] px-[12px]"><Input value={tier.from} onChange={(event) => updateTier(index, "from", event.target.value)} className="w-[80px] h-[32px] px-[8px] bg-background border border-border rounded-[8px] text-[12px] font-medium text-text focus:outline-none focus:border-primary text-right" /></td>
                      <td className="py-[10px] px-[12px]"><Input value={tier.to} onChange={(event) => updateTier(index, "to", event.target.value)} className="w-[80px] h-[32px] px-[8px] bg-background border border-border rounded-[8px] text-[12px] font-medium text-text focus:outline-none focus:border-primary text-right" /></td>
                      <td className="py-[10px] px-[12px]"><Input value={tier.price} onChange={(event) => updateTier(index, "price", event.target.value)} className="w-[120px] h-[32px] px-[8px] bg-background border border-border rounded-[8px] text-[12px] font-medium text-text focus:outline-none focus:border-primary text-right" /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <Button type="button" className="w-fit h-[36px] px-[14px] rounded-[10px] bg-background border border-border text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors flex items-center gap-[6px]" disabled>
          <Plus size={14} /> Thêm loại phí
        </Button>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={() => save()} className="h-[44px] px-[24px] rounded-[12px] bg-primary text-white font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-sm" isLoading={isSaving}>
          Lưu cấu hình giá
        </Button>
      </div>
    </div>
  );
}
