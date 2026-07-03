"use client";
import React from "react";
import { GitBranch, Check, ChevronRight, Plus, Zap, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Card } from "@/components/ui/Card";

const workflowSteps = [
  { id: 1, label: "Nhận cọc", icon: "💰", desc: "Khách hàng đặt cọc thành công", enabled: true, trigger: true },
  { id: 2, label: "Tạo hợp đồng", icon: "📄", desc: "Tự động tạo bản nháp hợp đồng", enabled: true, trigger: false },
  { id: 3, label: "Tạo hóa đơn", icon: "🧾", desc: "Tạo hóa đơn tháng đầu tiên", enabled: true, trigger: false },
  { id: 4, label: "Tạo tạm trú", icon: "🏠", desc: "Tạo phiếu đăng ký tạm trú", enabled: true, trigger: false },
  { id: 5, label: "Thông báo Sales", icon: "📢", desc: "Gửi thông báo cho Sales phụ trách", enabled: true, trigger: false },
  { id: 6, label: "Thông báo Kế toán", icon: "📊", desc: "Gửi thông báo cho kế toán duyệt", enabled: false, trigger: false },
];

const savedWorkflows = [
  { name: "Onboarding Khách thuê mới", steps: 6, status: "active", runs: 42 },
  { name: "Nhắc nợ tự động", steps: 5, status: "active", runs: 128 },
  { name: "Gia hạn hợp đồng", steps: 4, status: "active", runs: 15 },
  { name: "Trả phòng & Hoàn cọc", steps: 7, status: "inactive", runs: 8 },
];

export default function SettingsWorkflow() {
  return (
    <div className="flex flex-col gap-[20px]">
      {/* Saved Workflows */}
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[15px] text-text flex items-center gap-[8px]">
            <GitBranch size={16} className="text-primary" /> Workflows
          </h3>
          <Button variant="primary" className="gap-2">
            <Plus size={14} /> Tạo workflow mới
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-[10px]">
          {savedWorkflows.map((wf, i) => (
            <div key={i} className="flex items-center justify-between p-[14px] rounded-[10px] bg-background border border-border hover:border-primary/40 cursor-pointer transition-colors group">
              <div className="flex flex-col gap-[4px]">
                <div className="font-bold text-[13px] text-text group-hover:text-primary transition-colors">{wf.name}</div>
                <div className="text-[11px] font-medium text-muted">{wf.steps} bước • {wf.runs} lần chạy</div>
              </div>
              <div className="flex items-center gap-[8px]">
                <Badge variant={wf.status === "active" ? "success" : "neutral"}>
                  {wf.status === "active" ? "Hoạt động" : "Tắt"}
                </Badge>
                <ChevronRight size={14} className="text-muted group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Workflow Builder */}
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-[15px] text-text">Onboarding Khách thuê mới</h3>
            <p className="text-[12px] font-medium text-muted mt-[2px]">Workflow tự động khi nhận tiền đặt cọc thành công</p>
          </div>
          <div className="flex items-center gap-[8px]">
            <Badge variant="success" className="gap-1">
              <Zap size={10} /> Đang hoạt động
            </Badge>
            <Button variant="outline">
              Chỉnh sửa
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-0 py-[8px]">
          {workflowSteps.map((step, i) => (
            <React.Fragment key={step.id}>
              <div className={`w-full max-w-[520px] flex items-center gap-[14px] p-[16px] rounded-[14px] border-2 transition-all
                ${step.trigger ? "border-primary bg-primary/5" : step.enabled ? "border-success/30 bg-success/5" : "border-border bg-background opacity-50"}`}>
                <div className={`w-[44px] h-[44px] rounded-[12px] flex items-center justify-center text-[20px] shrink-0 ${step.trigger ? "bg-primary/10" : "bg-background border border-border"}`}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[8px]">
                    <span className="font-black text-[14px] text-text">{step.label}</span>
                    {step.trigger && <Badge variant="primary" className="text-[10px]">TRIGGER</Badge>}
                  </div>
                  <div className="text-[12px] font-medium text-muted mt-[2px]">{step.desc}</div>
                </div>
                <div className="shrink-0">
                  <Switch checked={step.enabled} readOnly />
                </div>
              </div>
              {i < workflowSteps.length - 1 && (
                <div className="flex flex-col items-center gap-[2px] py-[4px]">
                  <div className="w-[2px] h-[16px] bg-border" />
                  <ArrowDown size={14} className="text-muted" />
                </div>
              )}
            </React.Fragment>
          ))}
          <Button variant="outline" className="mt-[16px] border-dashed text-muted hover:border-primary hover:text-primary gap-2">
            <Plus size={14} /> Thêm bước
          </Button>
        </div>
      </Card>
    </div>
  );
}
