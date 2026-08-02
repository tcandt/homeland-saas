'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import DocumentExplorer from '../../components/documents/DocumentExplorer';

export default function DocumentsPage() {
  return (
    <AppShell>
      <div data-testid="documents-root" className="flex flex-col min-h-full gap-4">
        <div className="flex flex-col gap-1 border-b border-border/50 pb-4">
          <h1 className="text-[20px] md:text-[28px] font-black text-text tracking-tight">Tài liệu & Ký số</h1>
          <p className="text-[12px] md:text-[13px] font-medium text-muted">Quản lý, sinh và ký tài liệu trực tiếp từ dữ liệu thật</p>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <DocumentExplorer />
        </div>
      </div>
    </AppShell>
  );
}
