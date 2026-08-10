import { Body, Controller, Get, Param, Patch, Post, Query, Request, Res } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Response } from 'express';
import { FinanceReportingService } from './finance-reporting.service';
import { JournalEntryService } from './journal-entry.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';

@Controller('finance')
export class FinanceController {
  constructor(
    private readonly reportingService: FinanceReportingService,
    private readonly journalEntryService: JournalEntryService,
  ) {}

  @Get('ledger')
  @RequirePermissions('finance.read')
  async getLedger(@Request() req) {
    return this.reportingService.getLedger(req.user.tenantId, req.query);
  }

  @Patch('journal-entries/:id/reverse')
  @RequirePermissions('finance.update')
  async reverseJournalEntry(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.journalEntryService.reverseJournalEntry(req.user.tenantId, id, req.user?.id, body?.reason);
  }

  @Get('cashflow')
  @RequirePermissions('finance.read')
  async getCashFlow(@Request() req) {
    return this.reportingService.getCashFlow(req.user.tenantId);
  }

  @Get('profit-loss')
  @RequirePermissions('finance.read')
  async getProfitLoss(@Request() req) {
    return this.reportingService.getProfitLoss(req.user.tenantId);
  }

  @Get('debt-summary')
  @RequirePermissions('finance.read')
  async getDebtSummary(@Request() req) {
    return this.reportingService.getDebtSummary(req.user.tenantId);
  }

  @Get('building/:code')
  @RequirePermissions('finance.read')
  async getBuildingFinance(@Param('code') code: string, @Request() req) {
    return this.reportingService.getBuildingFinance(req.user.tenantId, code);
  }

  @Get('buildings/profit-summary')
  @RequirePermissions('finance.read')
  async getBuildingProfitSummary(@Request() req, @Query() query: any) {
    return this.reportingService.getBuildingProfitSummary(req.user.tenantId, query);
  }

  @Get('owners')
  @RequirePermissions('finance.read')
  async getOwners(@Request() req) {
    return this.reportingService.getOwners(req.user.tenantId);
  }

  @Get('owners/profit-summary')
  @RequirePermissions('finance.ownerProfit.read')
  async getOwnerProfitSummary(@Request() req) {
    return this.reportingService.getOwnerProfitSummary(req.user.tenantId);
  }

  @Get('owners/:id/profit-detail')
  @RequirePermissions('finance.ownerProfit.read')
  async getOwnerProfitDetail(@Param('id') id: string, @Request() req, @Query() query: any) {
    return this.reportingService.getOwnerProfitDetail(req.user.tenantId, id, query);
  }

  @Get('banks/cashflow')
  @RequirePermissions('finance.read')
  async getBankCashFlow(@Request() req, @Query() query: any) {
    return this.reportingService.getBankCashFlow(req.user.tenantId, query);
  }

  @Get('sepay/reconciliation')
  @RequirePermissions('finance.read')
  async getSePayReconciliation(@Request() req, @Query() query: any) {
    return this.reportingService.getSePayReconciliation(req.user.tenantId, query);
  }

  @Get('expenses')
  @RequirePermissions('finance.read')
  async getExpenses(@Request() req) {
    return this.reportingService.getExpenses(req.user.tenantId, req.query);
  }

  @Post('expenses')
  @RequirePermissions('finance.create')
  async createExpense(@Request() req, @Body() body: any) {
    return this.reportingService.createExpense(req.user.tenantId, req.user?.id, body);
  }

  @Patch('expenses/:id')
  @RequirePermissions('finance.update')
  async updateExpense(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.reportingService.updateExpense(req.user.tenantId, req.user?.id, id, body);
  }

  @Patch('expenses/:id/approve')
  @RequirePermissions('finance.approve')
  async approveExpense(@Param('id') id: string, @Request() req) {
    return this.reportingService.approveExpense(req.user.tenantId, req.user?.id, id, false);
  }

  @Patch('expenses/:id/pay')
  @RequirePermissions('finance.pay')
  async payExpense(@Param('id') id: string, @Request() req) {
    return this.reportingService.approveExpense(req.user.tenantId, req.user?.id, id, true);
  }

  @Patch('expenses/:id/cancel')
  @RequirePermissions('finance.update')
  async cancelExpense(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.reportingService.cancelExpense(req.user.tenantId, req.user?.id, id, body?.reason);
  }

  @Patch('expenses/:id/settlement')
  @RequirePermissions('finance.settle')
  async updateExpenseSettlement(@Param('id') id: string, @Request() req, @Body() body: any) {
    return this.reportingService.updateExpenseSettlement(req.user.tenantId, req.user?.id, id, body?.settlementStatus);
  }

  @Get('export.xlsx')
  @RequirePermissions('finance.export')
  async exportExcelReport(@Request() req, @Res() res: Response) {
    const rows = await this.reportingService.getLedger(req.user.tenantId, req.query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HomeLand';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Finance Ledger');

    worksheet.columns = [
      { header: 'Ngay', key: 'date', width: 22 },
      { header: 'Ma but toan', key: 'journalCode', width: 18 },
      { header: 'Dien giai', key: 'description', width: 42 },
      { header: 'Ma tai khoan', key: 'accountCode', width: 16 },
      { header: 'Tai khoan', key: 'accountName', width: 26 },
      { header: 'Loai', key: 'type', width: 12 },
      { header: 'So tien', key: 'amount', width: 18 },
      { header: 'Nguon', key: 'sourceType', width: 18 },
      { header: 'Trang thai', key: 'status', width: 14 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 24;

    rows.forEach((line: any) => {
      const entry = line.journalEntry || {};
      const account = line.account || {};
      worksheet.addRow({
        date: line.createdAt ? new Date(line.createdAt).toLocaleString('vi-VN') : '',
        journalCode: entry.code || '',
        description: line.description || entry.description || '',
        accountCode: account.code || '',
        accountName: account.name || '',
        type: line.type || '',
        amount: Number(line.amount || 0),
        sourceType: entry.sourceType || '',
        status: entry.status || '',
      });
    });

    worksheet.getColumn('amount').numFmt = '#,##0';
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=finance_report.xlsx');
    return res.status(200).send(Buffer.from(buffer));
  }

  @Get('export.pdf')
  @RequirePermissions('finance.export')
  async exportPdfReport(@Request() req, @Res() res: Response) {
    const rows = await this.reportingService.getLedger(req.user.tenantId, req.query);
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    const pageWidth = 842;
    const pageHeight = 595;
    const usableWidth = pageWidth - margin * 2;
    const lineHeight = 14;

    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const drawHeader = () => {
      page.drawText('Finance Ledger Report', {
        x: margin,
        y,
        size: 18,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 26;
      page.drawText('Date | Journal | Description | Account | Type | Amount | Status', {
        x: margin,
        y,
        size: 9,
        font: fontBold,
        color: rgb(0.25, 0.25, 0.25),
      });
      y -= 10;
      page.drawLine({
        start: { x: margin, y },
        end: { x: margin + usableWidth, y },
        thickness: 1,
        color: rgb(0.75, 0.75, 0.75),
      });
      y -= 14;
    };

    const ensureSpace = () => {
      if (y > margin + 20) return;
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    };

    const crop = (value: string, limit: number) => {
      if (value.length <= limit) return value;
      return `${value.slice(0, limit - 3)}...`;
    };

    drawHeader();

    rows.forEach((line: any) => {
      const entry = line.journalEntry || {};
      const account = line.account || {};
      const rowText = [
        crop(line.createdAt ? new Date(line.createdAt).toLocaleDateString('vi-VN') : '-', 12),
        crop(entry.code || '-', 14),
        crop(line.description || entry.description || '-', 28),
        crop(`${account.code || '-'} ${account.name || ''}`.trim(), 24),
        crop(line.type || '-', 8),
        crop(Number(line.amount || 0).toLocaleString('vi-VN'), 16),
        crop(entry.status || '-', 10),
      ].join(' | ');

      ensureSpace();
      page.drawText(rowText, {
        x: margin,
        y,
        size: 9,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= lineHeight;
    });

    const buffer = await pdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=finance_report.pdf');
    return res.status(200).send(Buffer.from(buffer));
  }

  @Get('export')
  @RequirePermissions('finance.export')
  async exportReport(@Request() req, @Res() res: Response) {
    const rows = await this.reportingService.getLedger(req.user.tenantId, req.query);
    const csvRows = rows.map((line: any) => {
      const entry = line.journalEntry || {};
      const account = line.account || {};
      const values = [
        line.createdAt?.toISOString?.() || '',
        entry.code || '',
        line.description || entry.description || '',
        account.code || '',
        account.name || '',
        line.type || '',
        String(line.amount || 0),
        entry.sourceType || '',
        entry.status || '',
      ];

      return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [
      'Date,JournalCode,Description,AccountCode,AccountName,Type,Amount,SourceType,Status',
      ...csvRows,
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=finance_report.csv');
    return res.status(200).send(csvContent);
  }
}
