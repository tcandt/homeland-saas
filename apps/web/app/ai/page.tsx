'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import AiCommandCenter from '../../components/ai/AiCommandCenter';

export default function AiPage() {
  return (
    <AppShell>
      <div className="h-full w-full overflow-hidden" data-testid="ai-page-root">
        <AiCommandCenter />
      </div>
    </AppShell>
  );
}
