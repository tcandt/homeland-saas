import React from 'react';
import { CheckCircle2, FileWarning } from 'lucide-react';
import type { UI_Deposit } from '../../lib/adapters/deposit.adapter';

export function DepositDocumentsStatus({ documents }: { documents?: UI_Deposit['documents'] }) {
  const missing: string[] = [];
  if (documents?.hasContractFile === false) missing.push('Thiếu file HĐ');
  if (documents?.identityImageCount === 0) missing.push('Thiếu file CCCD');
  else if (documents?.identityImageCount === 1) missing.push('Thiếu 1 mặt CCCD');
  const checked = documents?.hasContractFile != null && documents?.identityImageCount != null;

  if (missing.length === 0 && checked) {
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={14} aria-hidden="true" />Đủ hồ sơ</span>;
  }
  return (
    <div className="flex items-start gap-1.5 text-xs leading-5 text-amber-700 dark:text-amber-400">
      <FileWarning size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        {missing.map((label) => <div key={label}>{label}</div>)}
        {!checked && <div className="text-muted">Chưa đủ dữ liệu hồ sơ</div>}
      </div>
    </div>
  );
}
