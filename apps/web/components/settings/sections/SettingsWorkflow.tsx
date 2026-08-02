"use client";

import React from "react";
import { GitBranch, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Card } from "@/components/ui/Card";

export default function SettingsWorkflow() {
  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[15px] text-text flex items-center gap-[8px]">
            <GitBranch size={16} className="text-primary" /> Workflows
          </h3>
          <Button variant="primary" className="gap-2">
            <Plus size={14} /> Tạo workflow mới
          </Button>
        </div>
        <div className="rounded-[12px] border border-dashed border-border bg-background p-[20px] text-center text-muted font-medium">
          Chưa có workflow nào được lưu.
        </div>
      </Card>

      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-[15px] text-text">Workflow chưa cấu hình</h3>
            <p className="text-[12px] font-medium text-muted mt-[2px]">Sẵn sàng khi backend workflow được kết nối</p>
          </div>
          <div className="flex items-center gap-[8px]">
            <Badge variant="neutral" className="gap-1">
              <Zap size={10} /> Chưa kích hoạt
            </Badge>
            <Button variant="outline">Chỉnh sửa</Button>
          </div>
        </div>

        <div className="rounded-[12px] border border-dashed border-border bg-background p-[20px] text-center text-muted font-medium">
          Chưa có bước workflow nào được cấu hình.
        </div>

        <div className="flex justify-end">
          <Switch checked={false} readOnly />
        </div>
      </Card>
    </div>
  );
}
