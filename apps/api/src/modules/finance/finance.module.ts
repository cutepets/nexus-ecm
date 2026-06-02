import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [InvoicesController, ExpensesController, ReportsController],
  providers: [InvoicesService, ExpensesService, ReportsService],
})
export class FinanceModule {}
