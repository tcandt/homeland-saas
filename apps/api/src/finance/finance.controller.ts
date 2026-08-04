import { Controller, Get, Param, Query, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { FinanceReportingService } from './finance-reporting.service';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';

@Controller('finance')
export class FinanceController {
  constructor(private readonly reportingService: FinanceReportingService) {}

  @Get('ledger')
  @RequirePermissions('finance.read')
  async getLedger(@Request() req) {
    return this.reportingService.getLedger(req.user.tenantId, req.query);
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

  @Get('building/:code')
  @RequirePermissions('finance.read')
  async getBuildingFinance(@Param('code') code: string, @Request() req) {
    return this.reportingService.getBuildingFinance(req.user.tenantId, code);
  }

  @Get('export')
  @RequirePermissions('finance.read')
  async exportReport(@Request() req, @Res() res: Response) {
    const rows = await this.reportingService.getLedger(req.user.tenantId, req.query);
    const csvRows = rows.map((line: any) => {
      const entry = line.journalEntry || {};
      const account = line.account || {};
      const values = [
        line.createdAt?.toISOString?.() || "",
        entry.code || "",
        line.description || entry.description || "",
        account.code || "",
        account.name || "",
        line.type || "",
        String(line.amount || 0),
        entry.sourceType || "",
        entry.status || "",
      ];

      return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [
      "Date,JournalCode,Description,AccountCode,AccountName,Type,Amount,SourceType,Status",
      ...csvRows,
    ].join("\n");
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=finance_report.csv');
    return res.status(200).send(csvContent);
  }
}
