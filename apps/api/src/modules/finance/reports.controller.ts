import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { FinanceRangeDto } from './dto/expense.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

type ReportType = 'cashflow' | 'pnl' | 'expense';

@ApiTags('finance-reports')
@ApiBearerAuth()
@Controller('finance/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermissions('finance:read')
  @ApiOperation({ summary: 'Finance dashboard summary (income/expense/net/outstanding)' })
  summary(@Query() q: FinanceRangeDto) {
    return this.reports.summary(q.from, q.to);
  }

  @Get('cashflow')
  @RequirePermissions('finance:read')
  cashflow(@Query() q: FinanceRangeDto) {
    return this.reports.cashflow(q.from, q.to);
  }

  @Get('expense-by-category')
  @RequirePermissions('finance:read')
  expenseByCategory(@Query() q: FinanceRangeDto) {
    return this.reports.expenseByCategory(q.from, q.to);
  }

  @Get(':type/export.xlsx')
  @RequirePermissions('report:export')
  @ApiOperation({ summary: 'Export a report as Excel (cashflow|pnl|expense)' })
  async excel(@Param('type') type: ReportType, @Query() q: FinanceRangeDto, @Res() res: Response) {
    const buf = await this.reports.toExcel(type, q.from, q.to);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${type}.xlsx"`,
    });
    res.end(buf);
  }

  @Get(':type/export.pdf')
  @RequirePermissions('report:export')
  @ApiOperation({ summary: 'Export a report as PDF (cashflow|pnl|expense)' })
  async pdf(@Param('type') type: ReportType, @Query() q: FinanceRangeDto, @Res() res: Response) {
    const buf = await this.reports.toPdf(type, q.from, q.to);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${type}.pdf"`,
    });
    res.end(buf);
  }
}
