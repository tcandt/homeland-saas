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
    // Generate a mock CSV string
    const csvContent = "Date,Description,Amount,Type\n2026-06-30,Salary,5000,Credit\n2026-06-30,Rent,-1000,Debit";
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=finance_report.csv');
    return res.status(200).send(csvContent);
  }
}
