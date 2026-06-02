import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseDto,
  CreateReimbursementDto,
  ExpenseStatusDto,
  ReimbursementDecisionDto,
} from './dto/expense.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('finance')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get('expense-categories')
  @RequirePermissions('finance:read')
  categories() {
    return this.expenses.listCategories();
  }

  @Post('receipts')
  @RequirePermissions('finance:create')
  @ApiOperation({ summary: 'Presign a receipt upload' })
  presign(@Body('fileName') fileName: string) {
    return this.expenses.presignReceipt(fileName);
  }

  // ---- Expenses ----

  @Get('expenses')
  @RequirePermissions('finance:read')
  list(@Query('status') status?: string) {
    return this.expenses.list(status);
  }

  @Post('expenses')
  @RequirePermissions('finance:create')
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: RequestUser) {
    return this.expenses.createExpense(dto, undefined, { actorId: user.id });
  }

  @Put('expenses/:id/status')
  @RequirePermissions('finance:update')
  setStatus(@Param('id') id: string, @Body() dto: ExpenseStatusDto, @CurrentUser() user: RequestUser) {
    return this.expenses.setExpenseStatus(id, dto, { actorId: user.id });
  }

  @Delete('expenses/:id')
  @RequirePermissions('finance:delete')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.expenses.removeExpense(id, { actorId: user.id });
  }

  // ---- Reimbursements ----

  @Get('reimbursements')
  @RequirePermissions('finance:read')
  listReimbursements(@Query('status') status?: string) {
    return this.expenses.listReimbursements(status);
  }

  @Post('reimbursements')
  @RequirePermissions('finance:create')
  createReimbursement(@Body() dto: CreateReimbursementDto, @CurrentUser() user: RequestUser) {
    return this.expenses.createReimbursement(dto, { actorId: user.id });
  }

  @Put('reimbursements/:id/status')
  @RequirePermissions('finance:update')
  decideReimbursement(@Param('id') id: string, @Body() dto: ReimbursementDecisionDto, @CurrentUser() user: RequestUser) {
    return this.expenses.decideReimbursement(id, dto, undefined, { actorId: user.id });
  }
}
