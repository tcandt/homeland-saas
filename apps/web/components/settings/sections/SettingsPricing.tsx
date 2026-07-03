"use client";
import React, { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Card } from "@/components/ui/Card";
import { DollarSign, Plus, ChevronDown, Trash2 } from "lucide-react";

const feeTypes = [
  { id: "electricity", label: "Điện", unit: "VNĐ/kWh", icon: "⚡", defaultPrice: "3,800", method: "Per Meter" },
  { id: "water", label: "Nước", unit: "VNĐ/m³", icon: "💧", defaultPrice: "8,500", method: "Per Meter" },
  { id: "internet", label: "Internet", unit: "VNĐ/tháng", icon: "🌐", defaultPrice: "150,000", method: "Fixed" },
  { id: "trash", label: "Rác", unit: "VNĐ/tháng", icon: "🗑️", defaultPrice: "50,000", method: "Per Room" },
  { id: "parking", label: "Giữ xe", unit: "VNĐ/xe/tháng", icon: "🚗", defaultPrice: "200,000", method: "Per Person" },
  { id: "service", label: "Dịch vụ", unit: "VNĐ/tháng", icon: "🔧", defaultPrice: "100,000", method: "Fixed" },
  { id: "surcharge", label: "Phụ thu", unit: "VNĐ", icon: "➕", defaultPrice: "0", method: "Fixed" },
  { id: "late_fee", label: "Phí trễ hạn", unit: "%/ngày", icon: "⏰", defaultPrice: "0.05", method: "Fixed" },
  { id: "penalty", label: "Phí phạt", unit: "VNĐ", icon: "🚫", defaultPrice: "500,000", method: "Fixed" },
];

const methods = ["Fixed", "Tiered", "Per Person", "Per Room", "Per Meter"];

export default function SettingsPricing() {
  const [fees, setFees] = useState(feeTypes);

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-[15px] text-text">Pricing & Fees</h3>
            <p className="text-[12px] font-medium text-muted mt-[2px]">Cấu hình giá điện, nước, dịch vụ và các loại phí</p>
          </div>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 flex items-center gap-[6px] transition-colors">
            <Plus size={14} /> Thêm loại phí
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Loại phí</th>
                <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Đơn giá</th>
                <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Đơn vị</th>
                <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Phương thức</th>
                <th className="text-center py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Áp dụng</th>
                <th className="w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee, i) => (
                <tr key={fee.id} className="border-b border-border/50 hover:bg-black/[0.02] dark:hover:bg-card/[0.02] transition-colors">
                  <td className="py-[12px] px-[12px]">
                    <div className="flex items-center gap-[8px]">
                      <span className="text-[16px]">{fee.icon}</span>
                      <span className="font-bold text-text">{fee.label}</span>
                    </div>
                  </td>
                  <td className="py-[12px] px-[12px]">
                    <Input
                      defaultValue={fee.defaultPrice}
                      className="w-[120px] h-[34px] px-[10px] bg-background border border-border rounded-[8px] text-[13px] font-medium text-text focus:outline-none focus:border-primary transition-all text-right"
                    />
                  </td>
                  <td className="py-[12px] px-[12px] text-muted font-medium">{fee.unit}</td>
                  <td className="py-[12px] px-[12px]">
                    <div className="w-[120px]">
                      <Select 
                        defaultValue={fee.method}
                        options={methods.map(m => ({ label: m, value: m }))}
                      />
                    </div>
                  </td>
                  <td className="py-[12px] px-[12px] text-center">
                    <Switch checked={true} readOnly />
                  </td>
                  <td className="py-[12px] px-[12px]">
                    <Button className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                      <Trash2 size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tiered Pricing Example */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[14px]">
        <h3 className="font-black text-[15px] text-text">Cấu hình bậc thang (Tiered Pricing) - Điện</h3>
        <p className="text-[12px] font-medium text-muted">Áp dụng cho hộ có mức tiêu thụ khác nhau theo tháng</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Bậc</th>
                <th className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Từ (kWh)</th>
                <th className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Đến (kWh)</th>
                <th className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">Đơn giá (VNĐ/kWh)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { tier: "Bậc 1", from: "0", to: "50", price: "1,806" },
                { tier: "Bậc 2", from: "51", to: "100", price: "1,866" },
                { tier: "Bậc 3", from: "101", to: "200", price: "2,167" },
                { tier: "Bậc 4", from: "201", to: "300", price: "2,729" },
                { tier: "Bậc 5", from: "301", to: "400", price: "3,050" },
                { tier: "Bậc 6", from: "401", to: "∞", price: "3,151" },
              ].map((t, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-black/[0.02] dark:hover:bg-card/[0.02]">
                  <td className="py-[10px] px-[12px] font-bold text-text">{t.tier}</td>
                  <td className="py-[10px] px-[12px]"><Input defaultValue={t.from} className="w-[80px] h-[32px] px-[8px] bg-background border border-border rounded-[8px] text-[12px] font-medium text-text focus:outline-none focus:border-primary text-right" /></td>
                  <td className="py-[10px] px-[12px]"><Input defaultValue={t.to} className="w-[80px] h-[32px] px-[8px] bg-background border border-border rounded-[8px] text-[12px] font-medium text-text focus:outline-none focus:border-primary text-right" /></td>
                  <td className="py-[10px] px-[12px]"><Input defaultValue={t.price} className="w-[120px] h-[32px] px-[8px] bg-background border border-border rounded-[8px] text-[12px] font-medium text-text focus:outline-none focus:border-primary text-right" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="h-[44px] px-[24px] rounded-[12px] bg-primary text-white font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-sm">
          Lưu cấu hình giá
        </Button>
      </div>
    </div>
  );
}
