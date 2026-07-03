"use client";
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { createPortal } from "react-dom";
import { Check, X, ChevronDown } from "lucide-react";

const roles = ["Admin", "Manager", "Sales", "Accountant", "Maintenance"];

const modules = [
  {
    name: "Dashboard", permissions: [
      { key: "view", label: "Xem" }, { key: "export", label: "Xuất báo cáo" }
    ]
  },
  {
    name: "Buildings", permissions: [
      { key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "delete", label: "Xóa" }
    ]
  },
  {
    name: "Rooms", permissions: [
      { key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "assign", label: "Gán" }, { key: "maintenance", label: "Bảo trì" }
    ]
  },
  {
    name: "Tenants", permissions: [
      { key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "delete", label: "Xóa" }, { key: "export", label: "Xuất" }
    ]
  },
  {
    name: "Contracts", permissions: [
      { key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "renew", label: "Gia hạn" }, { key: "terminate", label: "Chấm dứt" }, { key: "export", label: "Xuất PDF" }
    ]
  },
  {
    name: "Deposits", permissions: [
      { key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "refund", label: "Hoàn cọc" }, { key: "approve", label: "Duyệt" }
    ]
  },
  {
    name: "Invoices", permissions: [
      { key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "approve", label: "Duyệt" }, { key: "collect", label: "Thu tiền" }, { key: "export", label: "Xuất" }
    ]
  },
  {
    name: "Finance", permissions: [
      { key: "view", label: "Xem" }, { key: "journal", label: "Bút toán" }, { key: "approve", label: "Duyệt" }, { key: "reports", label: "Báo cáo" }, { key: "export", label: "Xuất" }
    ]
  },
  {
    name: "Sales CRM", permissions: [
      { key: "view", label: "Xem" }, { key: "create", label: "Tạo" }, { key: "edit", label: "Sửa" }, { key: "delete", label: "Xóa" }, { key: "export", label: "Xuất" }
    ]
  },
  {
    name: "Settings", permissions: [
      { key: "view", label: "Xem" }, { key: "edit", label: "Sửa" }, { key: "backup", label: "Backup" }, { key: "restore", label: "Restore" }, { key: "users", label: "Quản lý Users" }
    ]
  },
];

// Default permissions per role per module/permission key
const defaultMatrix: Record<string, Record<string, Record<string, boolean>>> = {
  Admin: Object.fromEntries(modules.map(m => [m.name, Object.fromEntries(m.permissions.map(p => [p.key, true]))])),
  Manager: Object.fromEntries(modules.map(m => [m.name, Object.fromEntries(m.permissions.map(p => [p.key, !["delete", "backup", "restore", "users"].includes(p.key)]))])),
  Sales: Object.fromEntries(modules.map(m => [m.name, Object.fromEntries(m.permissions.map(p => [p.key, ["view", "create"].includes(p.key)]))])),
  Accountant: Object.fromEntries(modules.map(m => [m.name, Object.fromEntries(m.permissions.map(p => [p.key, ["view", "collect", "approve", "export", "journal", "reports"].includes(p.key)]))])),
  Maintenance: Object.fromEntries(modules.map(m => [m.name, Object.fromEntries(m.permissions.map(p => [p.key, ["view", "maintenance"].includes(p.key)]))])),
};

export default function SettingsTeam() {
  const [selectedRole, setSelectedRole] = useState("Manager");
  const [matrix, setMatrix] = useState(defaultMatrix);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggle = (mod: string, perm: string) => {
    setMatrix(prev => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [mod]: {
          ...prev[selectedRole][mod],
          [perm]: !prev[selectedRole][mod]?.[perm]
        }
      }
    }));
  };

  const teamMembers = [
    { name: "Văn Thể Phan", email: "vanthephan@homeland.vn", role: "Admin", status: "Hoạt động" },
    { name: "Minh Trang", email: "minhtrang@homeland.vn", role: "Manager", status: "Hoạt động" },
    { name: "Tuấn Đạt", email: "tuandat@homeland.vn", role: "Sales", status: "Hoạt động" },
    { name: "Hoàng Long", email: "hoanglong@homeland.vn", role: "Accountant", status: "Hoạt động" },
    { name: "Bảo Châu", email: "baochau@homeland.vn", role: "Maintenance", status: "Nghỉ phép" },
  ];

  return (
    <div className="flex flex-col gap-[20px]">
      {/* Team Members */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
        <div className="flex items-center justify-between mb-[16px]">
          <h3 className="font-black text-[15px] text-text">Thành viên nhóm ({teamMembers.length})</h3>
          <Button onClick={() => setIsAddMemberOpen(true)} className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 transition-colors">
            + Thêm thành viên
          </Button>
        </div>
        <div className="flex flex-col gap-[8px]">
          {teamMembers.map((m, i) => (
            <div key={i} className="flex items-center gap-[12px] p-[12px] rounded-[10px] bg-background border border-border hover:border-primary/30 transition-colors">
              <div className="w-[36px] h-[36px] rounded-full bg-primary/10 flex items-center justify-center font-bold text-[14px] text-primary shrink-0">
                {m.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] text-text">{m.name}</div>
                <div className="text-[11px] font-medium text-muted truncate">{m.email}</div>
              </div>
              <div className="w-[120px]">
                <Select 
                  defaultValue={m.role} 
                  options={roles.map(r => ({ label: r, value: r }))}
                />
              </div>
              <span className={`text-[10px] font-bold px-[8px] py-[3px] rounded-full ${m.status === "Hoạt động" ? "text-success bg-success/10" : "text-muted bg-border"}`}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
        <div className="flex items-center justify-between mb-[16px]">
          <h3 className="font-black text-[15px] text-text">Permission Matrix</h3>
          <div className="flex items-center gap-[8px]">
            {roles.map(r => (
              <Button key={r}
                onClick={() => setSelectedRole(r)}
                className={`h-[32px] px-[12px] rounded-[8px] text-[12px] font-bold transition-colors ${selectedRole === r ? "bg-primary text-white" : "bg-background border border-border text-text hover:bg-black/5 dark:hover:bg-card/5"}`}>
                {r}
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
              {modules.map((mod, mi) => (
                <tr key={mi} className="border-t border-border hover:bg-black/[0.02] dark:hover:bg-card/[0.02] transition-colors">
                  <td className="py-[10px] px-[12px] font-bold text-text sticky left-0 bg-card z-10">
                    {mod.name}
                  </td>
                  <td className="py-[10px] px-[12px]" colSpan={8}>
                    <div className="flex flex-wrap gap-[6px]">
                      {mod.permissions.map(p => {
                        const granted = matrix[selectedRole]?.[mod.name]?.[p.key] ?? false;
                        return (
                          <Button
                            key={p.key}
                            onClick={() => toggle(mod.name, p.key)}
                            className={`flex items-center gap-[4px] h-[26px] px-[10px] rounded-full text-[11px] font-bold transition-all border
                              ${granted
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-background text-muted border-border hover:border-danger/40 hover:text-danger"
                              }`}
                          >
                            {granted ? <Check size={10} /> : <X size={10} />}
                            {p.label}
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
          <Button className="h-[40px] px-[20px] rounded-[10px] bg-primary text-white font-bold text-[13px] hover:bg-primary/90 transition-colors">
            Lưu phân quyền
          </Button>
        </div>
      </div>

      {mounted && isAddMemberOpen && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[99998] animate-in fade-in duration-200"
            onClick={() => setIsAddMemberOpen(false)}
          />

          {/* Modal Popup */}
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-[20px] pointer-events-none">
            <div className="w-full max-w-[450px] bg-card rounded-[16px] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 pointer-events-auto">
              {/* Header */}
              <div className="h-[60px] border-b border-border flex items-center justify-between px-[20px]">
                <h2 className="font-black text-[16px] text-text">Thêm thành viên</h2>
                <Button onClick={() => setIsAddMemberOpen(false)} className="w-[32px] h-[32px] rounded-full hover:bg-black/5 dark:hover:bg-card/5 flex items-center justify-center transition-colors">
                  <X size={16} className="text-muted" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-[20px] flex flex-col gap-[16px]">
                <div>
                  <label className="block text-[12px] font-bold text-text mb-[6px]">Tên thành viên</label>
                  <Input type="text" className="w-full h-[40px] px-[12px] rounded-[10px] bg-background border border-border text-[13px] text-text focus:outline-none focus:border-primary transition-colors" placeholder="VD: Nguyễn Văn A" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-text mb-[6px]">Email</label>
                  <Input type="email" className="w-full h-[40px] px-[12px] rounded-[10px] bg-background border border-border text-[13px] text-text focus:outline-none focus:border-primary transition-colors" placeholder="VD: email@example.com" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-text mb-[6px]">Vai trò</label>
                  <Select 
                    defaultValue={roles[0]} 
                    options={roles.map(r => ({ label: r, value: r }))}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-[20px] pt-0 flex gap-[12px]">
                <Button onClick={() => setIsAddMemberOpen(false)} className="flex-1 h-[40px] rounded-[10px] bg-card border border-border font-bold text-[13px] text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors">
                  Hủy
                </Button>
                <Button onClick={() => setIsAddMemberOpen(false)} className="flex-1 h-[40px] rounded-[10px] bg-primary font-bold text-[13px] text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Lưu thành viên
                </Button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
