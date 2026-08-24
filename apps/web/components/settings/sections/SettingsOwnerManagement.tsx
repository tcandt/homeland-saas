"use client";

import React from "react";
import { Building2, LockKeyhole, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";

type OwnerSettings = {
  ownerAName: string;
  ownerBName: string;
  ownerAAccountEmail: string;
  ownerBAccountEmail: string;
  ownerAContactEmail: string;
  ownerBContactEmail: string;
  ownerAPhone: string;
  ownerBPhone: string;
  ownerABuildings: string[];
  ownerBBuildings: string[];
};

const ownerFallback: OwnerSettings = {
  ownerAName: "Tính",
  ownerBName: "Thể",
  ownerAAccountEmail: "admin@homeland.vn",
  ownerBAccountEmail: "admin@homeland.vn",
  ownerAContactEmail: "",
  ownerBContactEmail: "",
  ownerAPhone: "",
  ownerBPhone: "",
  ownerBBuildings: ["LK01-32", "LK08-24"],
  ownerABuildings: ["LK01-31", "LK08-25"],
};

function OwnerCard({
  testIdPrefix,
  title,
  name,
  email,
  contactEmail,
  phone,
  buildings,
  onNameChange,
  onEmailChange,
  onContactEmailChange,
  onPhoneChange,
}: {
  testIdPrefix: string;
  title: string;
  name: string;
  email: string;
  contactEmail: string;
  phone: string;
  buildings: string[];
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onContactEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[16px] border border-border bg-background/70 p-[16px]">
      <div className="flex items-start justify-between gap-[12px]">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">{title}</div>
          <div className="mt-[4px] text-[16px] font-black text-text">{name || "Chưa đặt tên"}</div>
        </div>
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] bg-primary/10 text-primary">
          <UsersRound size={18} />
        </div>
      </div>

      <div className="mt-[14px] grid grid-cols-1 gap-[12px]">
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Tên chủ sở hữu</label>
          <Input data-testid={`${testIdPrefix}-name`} value={name || ""} onChange={(event) => onNameChange(event.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Email liên hệ</label>
            <Input value={contactEmail || ""} onChange={(event) => onContactEmailChange(event.target.value)} placeholder="Email nhận đối soát" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Số điện thoại</label>
            <Input value={phone || ""} onChange={(event) => onPhoneChange(event.target.value)} placeholder="Số điện thoại chủ" />
          </div>
        </div>
        <div className="flex flex-col gap-[6px] rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
          <label className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
            <LockKeyhole size={14} /> Account quản trị riêng
          </label>
          <Input
            data-testid={`${testIdPrefix}-account-email`}
            value={email || ""}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="Email account owner"
            className="border-0 bg-transparent px-0 py-0 text-[13px] font-black text-text shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
          <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
            <Building2 size={14} /> Tòa đang quản lý
          </div>
          <div className="mt-[8px] flex flex-wrap gap-[8px]">
            {buildings.map((building) => (
              <span key={building} className="rounded-full bg-primary/10 px-[10px] py-[5px] text-[12px] font-black text-primary">
                {building}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsOwnerManagement() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<OwnerSettings>("owners", "TENANT", ownerFallback);

  return (
    <Card className="p-[20px]" data-testid="settings-owners-root">
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">Owner management</div>
          <h3 className="text-[20px] font-black text-text">Chủ sở hữu và phân tòa</h3>
          <p className="max-w-[780px] text-[13px] leading-relaxed text-muted">
            Khu này chỉ dùng để chốt rõ 2 chủ sở hữu, thông tin liên hệ và account quản trị riêng. Thiết lập ngân hàng SePay được quản lý tại mục tích hợp SePay.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-2" data-testid="settings-owners-cards">
          <OwnerCard
            testIdPrefix="settings-owner-a"
            title="Owner A"
            name={draft.ownerAName}
            email={draft.ownerAAccountEmail}
            contactEmail={draft.ownerAContactEmail}
            phone={draft.ownerAPhone}
            buildings={draft.ownerABuildings || []}
            onNameChange={(value) => setDraft((prev) => ({ ...prev, ownerAName: value }))}
            onEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerAAccountEmail: value }))}
            onContactEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerAContactEmail: value }))}
            onPhoneChange={(value) => setDraft((prev) => ({ ...prev, ownerAPhone: value }))}
          />
          <OwnerCard
            testIdPrefix="settings-owner-b"
            title="Owner B"
            name={draft.ownerBName}
            email={draft.ownerBAccountEmail}
            contactEmail={draft.ownerBContactEmail}
            phone={draft.ownerBPhone}
            buildings={draft.ownerBBuildings || []}
            onNameChange={(value) => setDraft((prev) => ({ ...prev, ownerBName: value }))}
            onEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerBAccountEmail: value }))}
            onContactEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerBContactEmail: value }))}
            onPhoneChange={(value) => setDraft((prev) => ({ ...prev, ownerBPhone: value }))}
          />
        </div>

        <div className="flex justify-end border-t border-border pt-[14px]">
          <Button type="button" onClick={() => save(draft)} isLoading={isSaving}>
            Lưu owner
          </Button>
        </div>
      </div>
    </Card>
  );
}
