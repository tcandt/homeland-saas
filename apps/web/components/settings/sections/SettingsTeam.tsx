"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";

const roles = ["Admin", "Manager", "Sales", "Accountant", "Maintenance"];

const modules = [
  { name: "Dashboard", permissions: [{ key: "view", label: "Xem" }, { key: "export", label: "Xuất báo cáo" }] },
  { name: "Buildings", permissions: [{ key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "delete", label: "Xóa" }] },
  { name: "Rooms", permissions: [{ key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "assign", label: "Gán" }, { key: "maintenance", label: "Bảo trì" }] },
  { name: "Tenants", permissions: [{ key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "delete", label: "Xóa" }, { key: "export", label: "Xuất" }] },
  { name: "Contracts", permissions: [{ key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "renew", label: "Gia hạn" }, { key: "terminate", label: "Chấm dứt" }, { key: "export", label: "Xuất PDF" }] },
  { name: "Deposits", permissions: [{ key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "refund", label: "Hoàn cọc" }, { key: "approve", label: "Duyệt" }] },
  { name: "Invoices", permissions: [{ key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "approve", label: "Duyệt" }, { key: "collect", label: "Thu tiền" }, { key: "export", label: "Xuất" }] },
  { name: "Finance", permissions: [{ key: "view", label: "Xem" }, { key: "journal", label: "Bút toán" }, { key: "approve", label: "Duyệt" }, { key: "reports", label: "Báo cáo" }, { key: "export", label: "Xuất" }] },
  { name: "Sales CRM", permissions: [{ key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "delete", label: "Xóa" }, { key: "export", label: "Xuất" }] },
  { name: "Settings", permissions: [{ key: "view", label: "Xem" }, { key: "edit", label: "Sửa" }, { key: "backup", label: "Backup" }, { key: "restore", label: "Restore" }, { key: "users", label: "Quản lý Users" }] },
];

const emptyMatrix: Record<string, Record<string, Record<string, boolean>>> = Object.fromEntries(
  roles.map((role) => [
    role,
    Object.fromEntries(
      modules.map((module) => [
        module.name,
        Object.fromEntries(module.permissions.map((permission) => [permission.key, false])),
      ]),
    ),
  ]),
);

type TeamSettings = {
  matrix: typeof emptyMatrix;
  invitation: { fullName: string; email: string; role: string };
};

const fallback: TeamSettings = {
  matrix: emptyMatrix,
  invitation: { fullName: "", email: "", role: "Admin" },
};

export default function SettingsTeam() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<TeamSettings>("team", "TENANT", fallback);
  const [selectedRole, setSelectedRole] = useState("Admin");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const matrix = draft.matrix || emptyMatrix;
  const invitation = draft.invitation || fallback.invitation;
  const teamMembers: any[] = [];

  const toggle = (mod: string, perm: string) => {
    setDraft((prev) => ({
      ...prev,
      matrix: {
        ...prev.matrix,
        [selectedRole]: {
          ...prev.matrix[selectedRole],
          [mod]: {
            ...prev.matrix[selectedRole][mod],
            [perm]: !prev.matrix[selectedRole][mod]?.[perm],
          },
        },
      },
    }));
  };

  const closeInvite = () => setIsAddMemberOpen(false);

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between gap-[12px]">
          <h3 className="font-black text-[15px] text-text">Thành viên nhóm ({teamMembers.length})</h3>
          <Button type="button" onClick={() => setIsAddMemberOpen(true)} className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 transition-colors">
            <Plus size={14} />
            Thêm thành viên
          </Button>
        </div>
        {teamMembers.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border bg-background p-[20px] text-center text-muted font-medium">
            Chưa có thành viên nào được cấu hình.
          </div>
        ) : null}
      </div>

      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
        <div className="flex items-center justify-between gap-[12px] mb-[16px]">
          <h3 className="font-black text-[15px] text-text">Permission Matrix</h3>
          <div className="flex items-center gap-[8px] flex-wrap justify-end">
            {roles.map((role) => (
              <Button
                type="button"
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`h-[32px] px-[12px] rounded-[8px] text-[12px] font-bold transition-colors ${selectedRole === role ? "bg-primary text-white" : "bg-background border border-border text-text hover:bg-black/5 dark:hover:bg-card/5"}`}
              >
                {role}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-background">
                <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px] w-[140px] sticky left-0 bg-background z-10">Module</th>
                <th className="text-left py-[10px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]" colSpan={8}>Quyền truy cập</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.name} className="border-t border-border hover:bg-black/[0.02] dark:hover:bg-card/[0.02] transition-colors">
                  <td className="py-[10px] px-[12px] font-bold text-text sticky left-0 bg-card z-10">{module.name}</td>
                  <td className="py-[10px] px-[12px]" colSpan={8}>
                    <div className="flex flex-wrap gap-[6px]">
                      {module.permissions.map((permission) => {
                        const granted = matrix[selectedRole]?.[module.name]?.[permission.key] ?? false;
                        return (
                          <Button
                            type="button"
                            key={permission.key}
                            onClick={() => toggle(module.name, permission.key)}
                            className={`flex items-center gap-[4px] h-[26px] px-[10px] rounded-full text-[11px] font-bold transition-all border ${granted ? "bg-success/10 text-success border-success/30" : "bg-background text-muted border-border hover:border-danger/40 hover:text-danger"}`}
                          >
                            {granted ? <Check size={10} /> : <X size={10} />}
                            {permission.label}
                          </Button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-[16px]">
          <Button type="button" onClick={() => save({ matrix, invitation })} className="h-[40px] px-[20px] rounded-[10px] bg-primary text-white font-bold text-[13px] hover:bg-primary/90 transition-colors" isLoading={isSaving}>
            Lưu phân quyền
          </Button>
        </div>
      </div>

      {mounted && isAddMemberOpen && createPortal(
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[99998] animate-in fade-in duration-200" onClick={closeInvite} />
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-[20px] pointer-events-none">
            <div className="w-full max-w-[450px] bg-card rounded-[16px] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 pointer-events-auto overflow-hidden">
              <div className="h-[60px] border-b border-border flex items-center justify-between gap-[12px] px-[20px]">
                <h2 className="font-black text-[16px] text-text">Thêm thành viên</h2>
                <Button type="button" variant="ghost" size="icon" onClick={closeInvite} className="rounded-full shrink-0 text-muted hover:text-text">
                  <X size={18} />
                </Button>
              </div>
              <div className="p-[20px] flex flex-col gap-[16px]">
                <div>
                  <label className="block text-[12px] font-bold text-text mb-[6px]">Tên thành viên</label>
                  <Input value={invitation.fullName} onChange={(event) => setDraft((prev) => ({ ...prev, invitation: { ...prev.invitation, fullName: event.target.value } }))} type="text" className="w-full h-[40px] px-[12px] rounded-[10px] bg-background border border-border text-[13px] text-text focus:outline-none focus:border-primary transition-colors" placeholder="Nhập tên thành viên" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-text mb-[6px]">Email</label>
                  <Input value={invitation.email} onChange={(event) => setDraft((prev) => ({ ...prev, invitation: { ...prev.invitation, email: event.target.value } }))} type="email" className="w-full h-[40px] px-[12px] rounded-[10px] bg-background border border-border text-[13px] text-text focus:outline-none focus:border-primary transition-colors" placeholder="Nhập email" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-text mb-[6px]">Vai trò</label>
                  <Select value={invitation.role || "Admin"} onChange={(event) => setDraft((prev) => ({ ...prev, invitation: { ...prev.invitation, role: event.target.value } }))} options={roles.map((role) => ({ label: role, value: role }))} />
                </div>
              </div>
              <div className="p-[20px] pt-0 flex gap-[12px]">
                <Button type="button" onClick={closeInvite} className="flex-1 h-[40px] rounded-[10px] bg-card border border-border font-bold text-[13px] text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors">
                  Hủy
                </Button>
                <Button type="button" onClick={closeInvite} className="flex-1 h-[40px] rounded-[10px] bg-primary font-bold text-[13px] text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Lưu thành viên
                </Button>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
