"use client";

import React from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";

type ContractRulesSettings = {
  defaultTermMonths: string;
  renewalReminderDays: string;
  noticeDays: string;
  penaltyAmount: string;
  depositRule: string;
  signingMethod: string;
  earlyTerminationClause: string;
};

const fallback: ContractRulesSettings = {
  defaultTermMonths: "12",
  renewalReminderDays: "30",
  noticeDays: "60",
  penaltyAmount: "2000000",
  depositRule: "2",
  signingMethod: "manual",
  earlyTerminationClause: "Trong trường hợp bên thuê chấm dứt hợp đồng trước thời hạn, bên thuê phải thông báo trước 60 ngày và chịu phí phạt bằng 2 tháng tiền phòng.",
};

export default function SettingsContractRules() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<ContractRulesSettings>("contract-rules", "TENANT", fallback);

  return (
    <form
      className="flex flex-col gap-[20px]"
      onSubmit={async (event) => {
        event.preventDefault();
        await save();
      }}
    >
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">Contract Rules</h3>
        <div className="grid grid-cols-2 gap-[14px]">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Thời hạn hợp đồng mặc định (tháng)</label>
            <Input value={draft.defaultTermMonths} onChange={(event) => setDraft((prev) => ({ ...prev, defaultTermMonths: event.target.value }))} />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Nhắc gia hạn trước (ngày)</label>
            <Input value={draft.renewalReminderDays} onChange={(event) => setDraft((prev) => ({ ...prev, renewalReminderDays: event.target.value }))} />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Notice Days (báo trước khi kết thúc)</label>
            <Input value={draft.noticeDays} onChange={(event) => setDraft((prev) => ({ ...prev, noticeDays: event.target.value }))} />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Phí phạt vi phạm</label>
            <Input value={draft.penaltyAmount} onChange={(event) => setDraft((prev) => ({ ...prev, penaltyAmount: event.target.value }))} />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Quy tắc đặt cọc mặc định</label>
            <Select
              value={draft.depositRule}
              onChange={(event) => setDraft((prev) => ({ ...prev, depositRule: event.target.value }))}
              options={[
                { label: "2 tháng tiền phòng", value: "2" },
                { label: "1 tháng tiền phòng", value: "1" },
                { label: "3 tháng tiền phòng", value: "3" },
                { label: "Theo thỏa thuận", value: "custom" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Ký kết hợp đồng</label>
            <Select
              value={draft.signingMethod}
              onChange={(event) => setDraft((prev) => ({ ...prev, signingMethod: event.target.value }))}
              options={[
                { label: "Ký tay + Scan", value: "manual" },
                { label: "Chữ ký điện tử", value: "esign" },
                { label: "Bắt buộc 2 bản", value: "2copies" },
              ]}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Điều khoản phạt hủy hợp đồng sớm</label>
            <Textarea rows={3} value={draft.earlyTerminationClause} onChange={(event) => setDraft((prev) => ({ ...prev, earlyTerminationClause: event.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-[16px]">
          <Button type="submit" variant="primary" isLoading={isSaving}>
            Lưu quy tắc
          </Button>
        </div>
      </Card>
    </form>
  );
}
