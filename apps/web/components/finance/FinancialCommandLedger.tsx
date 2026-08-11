import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLedgerQuery } from '@/lib/queries/finance.queries';
import { useFinanceStore } from '@/lib/stores/finance.store';
import { Loader2, ExternalLink } from 'lucide-react';
import dayjs from 'dayjs';
import { Badge } from '../ui/Badge';

export default function FinancialCommandLedger() {
  const { data: rows, isLoading, error } = useLedgerQuery();
  const setSelectedJournal = useFinanceStore(s => s.setSelectedJournal);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-[16px] h-[500px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !rows) {
    return (
      <div data-testid="finance-error-state" className="bg-card border border-border rounded-[16px] h-[500px] flex items-center justify-center text-rose-500">
        Lỗi tải dữ liệu sổ cái. Vui lòng thử lại.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div data-testid="empty-finance-state" className="bg-card border border-border rounded-[16px] h-[500px] flex items-center justify-center text-muted">
        Chưa có giao dịch nào trong kỳ.
      </div>
    );
  }

  return (
    <div data-testid="finance-ledger" className="bg-card border border-border rounded-[16px] flex flex-col h-[600px] overflow-hidden">
      <div className="p-[16px] border-b border-border flex items-center justify-between">
        <h3 className="font-bold text-text">Sổ Cái & Giao Dịch (Ledger)</h3>
        <span className="text-[13px] text-muted">{rows.length} dòng</span>
      </div>

      <div className="flex-1 overflow-auto" ref={parentRef} tabIndex={0}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-testid={`finance-ledger-row-${row.id}`}
                className="absolute top-0 left-0 w-full flex items-center border-b border-border/50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors px-[16px] cursor-pointer group"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => setSelectedJournal(row.journalId)}
              >
                <div className="hidden md:block w-[120px] shrink-0 font-medium text-[13px] text-text">
                  {row.journalCode}
                </div>
                <div className="hidden md:block w-[100px] shrink-0 text-[13px] text-muted">
                  {dayjs(row.date).format('DD/MM/YY HH:mm')}
                </div>
                <div className="flex-1 min-w-[150px] md:min-w-[200px] text-[13px] text-text font-medium truncate pr-4">
                  <div className="flex md:hidden text-[10px] text-muted mb-0.5">
                    {dayjs(row.date).format('DD/MM/YY')} • {row.journalCode}
                  </div>
                  {row.description}
                  <div className="text-[11px] text-muted truncate">
                    {row.accountCode} - {row.accountName}
                  </div>
                </div>
                <div className="hidden md:block w-[120px] shrink-0 text-right text-[13px] font-medium text-[#8b5cf6]">
                  {row.debit > 0 ? row.debit.toLocaleString() : '-'}
                </div>
                <div className="hidden md:block w-[120px] shrink-0 text-right text-[13px] font-medium text-rose-500">
                  {row.credit > 0 ? row.credit.toLocaleString() : '-'}
                </div>
                {/* Mobile consolidated amount */}
                <div className="block md:hidden shrink-0 text-right text-[13px] font-medium pr-2">
                  {row.debit > 0 && <div className="text-[#8b5cf6]">{row.debit.toLocaleString()}</div>}
                  {row.credit > 0 && <div className="text-rose-500">{row.credit.toLocaleString()}</div>}
                </div>
                
                <div className="hidden md:block w-[100px] shrink-0 text-right pr-[8px]">
                  <Badge variant={
                    row.status === 'POSTED' ? 'success' : 
                    row.status === 'DRAFT' ? 'warning' : 'neutral'
                  }>
                    {row.status}
                  </Badge>
                </div>
                <div className="hidden md:flex w-[32px] shrink-0 items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink size={14} className="text-muted hover:text-text" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
