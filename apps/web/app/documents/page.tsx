'use client';

import React from 'react';
import DocumentExplorer from '../../components/documents/DocumentExplorer';

export default function DocumentsPage() {
  return (
    <div data-testid="documents-root" className="flex flex-col h-full bg-background p-4 overflow-hidden gap-4">
      <h1 className="text-2xl font-black text-text">Document & eSignature Platform</h1>
      <div className="flex-1 min-h-0 flex flex-col">
        <DocumentExplorer />
      </div>
    </div>
  );
}
