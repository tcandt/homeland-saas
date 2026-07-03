import React, { useMemo } from 'react';
import { X, FileText, ArrowLeftRight, Copy, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useFinanceStore } from '@/lib/stores/finance.store';
import { useLedgerQuery } from '@/lib/queries/finance.queries';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export default function FinancialCommandDrawer() {
  const selectedJournalId = useFinanceStore(s => s.selectedJournalId);
  const setSelectedJournal = useFinanceStore(s => s.setSelectedJournal);
  const { data: rows } = useLedgerQuery();

  const journalLines = useMemo(() => {
    if (!selectedJournalId || !rows) return [];
    return rows.filter(r => r.journalId === selectedJournalId);
  }, [selectedJournalId, rows]);

  if (!selectedJournalId || journalLines.length === 0) return null;

  const headerRow = journalLines[0];
  const totalDebit = journalLines.reduce((acc, row) => acc + row.debit, 0);
  const totalCredit = journalLines.reduce((acc, row) => acc + row.credit, 0);
  const isBalanced = totalDebit === totalCredit;

  const handleExportPDF = () => {
    toast.error('PDF export will be available in Reporting Sprint', {
      icon: '🚧',
    });
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
        onClick={() => setSelectedJournal(null)}
      />
      <div data-testid="finance-drawer" className="fixed right-0 top-0 bottom-0 w-full md:w-[500px] max-w-[100vw] bg-background shadow-2xl z-[110] flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="h-[64px] border-b border-border flex items-center justify-between px-[24px] shrink-0 bg-card">
          <div className="flex items-center gap-[12px]">
            <h2 className="font-bold text-[18px] text-text">Bút toán: {headerRow.journalCode}</h2>
            <Badge data-testid="finance-status-badge" variant={
              headerRow.status === 'POSTED' ? 'success' : 
              headerRow.status === 'DRAFT' ? 'warning' : 'neutral'
            }>
              {headerRow.status}
            </Badge>
          </div>
          <Button 
            data-testid="finance-drawer-close"
            aria-label="Đóng"
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedJournal(null)}
            className="rounded-full"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-[24px] flex flex-col gap-[24px]">
          
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-[16px] p-[16px] bg-card border border-border rounded-[12px]">
            <div>
              <div className="text-[12px] font-medium text-muted mb-1">Nguồn (Source)</div>
              <div className="font-bold text-[14px] text-text">{headerRow.sourceType}</div>
            </div>
            <div>
              <div className="text-[12px] font-medium text-muted mb-1">Ngày hạch toán</div>
              <div className="font-bold text-[14px] text-text">{dayjs(headerRow.date).format('DD/MM/YYYY HH:mm')}</div>
            </div>
            <div className="col-span-2">
              <div className="text-[12px] font-medium text-muted mb-1">Diễn giải</div>
              <div className="font-medium text-[14px] text-text">{headerRow.description}</div>
            </div>
          </div>

          {/* Balance Warning */}
          {!isBalanced && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-[12px] p-[16px] flex items-start gap-[12px]">
              <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
              <div>
                <div className="text-rose-500 font-bold text-[14px] mb-1">Bút toán chưa cân bằng</div>
                <div className="text-rose-500/80 text-[13px]">
                  Tổng Nợ ({totalDebit.toLocaleString()}) lệch với Tổng Có ({totalCredit.toLocaleString()}).
                  Vui lòng cập nhật trước khi POST.
                </div>
              </div>
            </div>
          )}
          
          {isBalanced && headerRow.status === 'POSTED' && (
            <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-[12px] p-[12px] flex items-center gap-[8px]">
              <CheckCircle className="text-[#10b981]" size={16} />
              <div className="text-[#10b981] font-bold text-[13px]">Bút toán đã cân bằng và ghi sổ.</div>
            </div>
          )}

          {/* Lines */}
          <div>
            <h3 className="font-bold text-[14px] text-text mb-[12px] uppercase tracking-wide">Chi tiết hạch toán</h3>
            <div className="border border-border rounded-[12px] overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_100px] bg-card border-b border-border p-[12px]">
                <div className="text-[12px] font-bold text-muted">Tài khoản</div>
                <div className="text-[12px] font-bold text-muted text-right">Nợ (Debit)</div>
                <div className="text-[12px] font-bold text-muted text-right">Có (Credit)</div>
              </div>
              
              {journalLines.map((line) => (
                <div key={line.id} className="grid grid-cols-[1fr_100px_100px] border-b border-border/50 p-[12px] items-center">
                  <div>
                    <div className="font-bold text-[13px] text-text">{line.accountCode} - {line.accountName}</div>
                    <div className="text-[11px] text-muted">{line.costCenterName || 'No Cost Center'}</div>
                  </div>
                  <div className="text-[13px] font-medium text-[#10b981] text-right">
                    {line.debit > 0 ? line.debit.toLocaleString() : ''}
                  </div>
                  <div className="text-[13px] font-medium text-rose-500 text-right">
                    {line.credit > 0 ? line.credit.toLocaleString() : ''}
                  </div>
                </div>
              ))}
              
              <div className="grid grid-cols-[1fr_100px_100px] bg-black/5 dark:bg-white/5 p-[12px] items-center">
                <div className="font-black text-[13px] text-text text-right uppercase">Tổng cộng</div>
                <div className="font-black text-[14px] text-text text-right">{totalDebit.toLocaleString()}</div>
                <div className="font-black text-[14px] text-text text-right">{totalCredit.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Audit Timeline */}
          <div>
            <h3 className="font-bold text-[14px] text-text mb-[12px] uppercase tracking-wide">Lịch sử</h3>
            <div className="flex gap-[12px]">
              <div className="w-[32px] h-[32px] rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <Clock size={14} className="text-blue-500" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-text">Tạo tự động từ {headerRow.sourceType}</div>
                <div className="text-[11px] text-muted mt-0.5">{dayjs(headerRow.date).format('DD/MM/YYYY HH:mm:ss')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-[24px] border-t border-border bg-card flex items-center justify-end gap-[12px] shrink-0">
          <Button variant="outline">
            <Copy size={16} className="mr-2" /> Copy
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText size={16} className="mr-2" /> Export PDF
          </Button>
          <Button variant="outline" className="text-danger border-danger/20 hover:bg-danger/10 hover:border-danger/30">
            <ArrowLeftRight size={16} className="mr-2" /> Đảo bút toán (Reverse)
          </Button>
        </div>

      </div>
    </>
  );
}
