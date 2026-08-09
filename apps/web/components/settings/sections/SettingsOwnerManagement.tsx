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
  ownerABuildings: string[];
  ownerBBuildings: string[];
};

const fallback: OwnerSettings = {
  ownerAName: "Tính",
  ownerBName: "Thể",
  ownerAAccountEmail: "adminA@homeland.local",
  ownerBAccountEmail: "adminB@homeland.local",
  ownerABuildings: ["LK01-31", "LK08-25"],
  ownerBBuildings: ["LK01-32", "LK08-24"],
};

function OwnerCard({
  title,
  name,
  email,
  buildings,
  onNameChange,
}: {
  title: string;
  name: string;
  email: string;
  buildings: string[];
  onNameChange: (value: string) => void;
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
          <Input value={name} onChange={(event) => onNameChange(event.target.value)} />
        </div>
        <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
          <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
            <LockKeyhole size={14} /> Account quản trị riêng
          </div>
          <div className="mt-[4px] text-[13px] font-black text-text">{email}</div>
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
  const { draft, setDraft, isSaving, save } = useSettingsSection<OwnerSettings>("owners", "TENANT", fallback);

  return (
    <Card className="p-[20px]">
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">Owner management</div>
          <h3 className="text-[20px] font-black text-text">Chủ sở hữu và phân tòa</h3>
          <p className="max-w-[780px] text-[13px] leading-relaxed text-muted">
            Cấu hình tên hiển thị của hai chủ sở hữu và account quản trị riêng để theo dõi lịch sử đăng nhập, thay đổi, chỉnh sửa. Admin vận hành không được chỉnh sửa token tích hợp nhạy cảm.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px]">
          <OwnerCard
            title="Owner A"
            name={draft.ownerAName}
            email={draft.ownerAAccountEmail}
            buildings={draft.ownerABuildings}
            onNameChange={(value) => setDraft((prev) => ({ ...prev, ownerAName: value }))}
          />
          <OwnerCard
            title="Owner B"
            name={draft.ownerBName}
            email={draft.ownerBAccountEmail}
            buildings={draft.ownerBBuildings}
            onNameChange={(value) => setDraft((prev) => ({ ...prev, ownerBName: value }))}
          />
        </div>

        <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-[14px] py-[12px] text-[12px] font-semibold leading-relaxed text-blue-900">
          Mapping hiện tại: LK01-31 và LK08-25 thuộc chủ Tính; LK01-32 và LK08-24 thuộc chủ Thể. Account owner A/B có toàn quyền vận hành, còn account admin thường chỉ vận hành và không chỉnh sửa token cài đặt.
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => save(draft)} isLoading={isSaving} className="h-[42px] px-[18px]">
            Lưu cấu hình chủ sở hữu
          </Button>
        </div>
      </div>
    </Card>
  );
}
