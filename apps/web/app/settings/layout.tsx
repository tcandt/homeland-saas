import React from "react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  // Bỏ AppShell ở layout để tránh double AppShell khi page cũng có AppShell.
  // Giao diện sẽ được quản lý trực tiếp ở app/settings/page.tsx
  return <>{children}</>;
}
