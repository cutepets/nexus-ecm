import {
  BadRequestException,
  ForbiddenException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto, PermanentDeleteEmployeeDto, TerminateEmployeeDto } from './dto/employee.dto';
import { CreateJobHistoryDto, CreateSalaryHistoryDto } from './dto/history.dto';
import { CreateDocumentDto, PresignCreateEmployeeUploadDto, PresignUploadDto } from './dto/document.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { branchIdsForPeriod, CurrentUser, permissionScope, RequestUser } from '../../common/decorators/current-user.decorator';
import { EmployeesExcelService } from './employees-excel.service';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService, private readonly excel: EmployeesExcelService) {}

  @Get('options/branches')
  @RequirePermissions('employee:read')
  listBranches(@CurrentUser() user: RequestUser) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    return this.employees.listBranchesForEmployeeAccess({
      scope: permissionScope(user, 'employee:read'),
      employeeId: user.employeeId,
      branchIds: branchIdsForPeriod(user, start, end),
      from: start,
      to: end,
    });
  }

  @Get()
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List employees (paginated, filterable)' })
  list(@Query() query: EmployeeQueryDto, @CurrentUser() user: RequestUser) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    const payrollScope = permissionScope(user, 'payroll:read');
    const employeeScope = permissionScope(user, 'employee:read');
    const includeCompensation = payrollScope === 'ALL' || payrollScope === 'BRANCH' || (payrollScope === 'SELF' && employeeScope === 'SELF');
    return this.employees.list(query, includeCompensation, {
      scope: employeeScope,
      employeeId: user.employeeId,
      branchIds: branchIdsForPeriod(user, start, end),
      from: start,
      to: end,
    });
  }

  @Get('username-suggestion')
  @RequirePermissions('employee:create')
  suggestUsername(@Query('fullName') fullName: string | undefined) {
    if (!fullName?.trim()) throw new BadRequestException('Nhập họ và tên để gợi ý tên đăng nhập.');
    return this.employees.suggestUsername(fullName.trim());
  }

  @Get('excel/template')
  @RequirePermissions('employee:read')
  async excelTemplate(@Res() res: Response) {
    const buffer = await this.excel.template();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="nhan-vien-mau.xlsx"');
    res.send(buffer);
  }

  @Get('excel/export')
  @RequirePermissions('employee:read')
  async excelExport(@Res() res: Response, @CurrentUser() user: RequestUser) {
    const buffer = await this.excel.export(user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="nhan-vien.xlsx"');
    res.send(buffer);
  }

  @Post('excel/import/preview')
  @RequirePermissions('employee:read')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  excelPreview(@UploadedFile() file: { buffer: Buffer } | undefined, @CurrentUser() user: RequestUser) {
    if (!file?.buffer) throw new BadRequestException('Chọn file Excel để xem trước.');
    return this.excel.preview(file.buffer, user);
  }

  @Post('excel/import/apply')
  @RequirePermissions('employee:read')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  excelApply(@UploadedFile() file: { buffer: Buffer } | undefined, @CurrentUser() user: RequestUser) {
    if (!file?.buffer) throw new BadRequestException('Chọn file Excel để nhập.');
    return this.excel.apply(file.buffer, user);
  }

  @Get(':id/deletion-eligibility')
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Check whether an employee can be permanently deleted' })
  deletionEligibility(@Param('id') id: string) {
    return this.employees.getDeletionEligibility(id);
  }

  @Get(':id')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get one employee with history & documents' })
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    const payrollScope = permissionScope(user, 'payroll:read');
    const includeCompensation = payrollScope === 'ALL' || payrollScope === 'BRANCH' || (payrollScope === 'SELF' && id === user.employeeId);
    return this.employees.getById(id, includeCompensation, {
      scope: permissionScope(user, 'employee:read'),
      employeeId: user.employeeId,
      branchIds: branchIdsForPeriod(user, start, end),
      from: start,
      to: end,
    });
  }

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Create an employee' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: RequestUser) {
    const scope = permissionScope(user, 'employee:create');
    if (scope === 'SELF') throw new ForbiddenException('Phạm vi quyền không cho phép tạo hồ sơ cho nhân viên khác');
    if (scope === 'BRANCH') {
      const { from, to } = this.currentMonth();
      const branchIds = branchIdsForPeriod(user, from, to);
      if ([dto.primaryBranchId, ...(dto.branchIds ?? [])].some((branchId) => !branchIds.includes(branchId))) {
        throw new ForbiddenException('Chỉ được tạo hồ sơ trong chi nhánh được phân quyền');
      }
    }
    return this.employees.create(
      dto,
      { actorId: user.id },
      ['ALL', 'BRANCH'].includes(permissionScope(user, 'payroll:update')),
      permissionScope(user, 'branch:create') !== 'NONE' && permissionScope(user, 'attendance-policy:update') !== 'NONE',
    );
  }

  @Post('uploads/create')
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Get a presigned upload URL for a new employee identity-card image' })
  presignCreateUpload(@Body() dto: PresignCreateEmployeeUploadDto) {
    return this.employees.presignCreateUpload(dto);
  }

  @Put(':id')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Update an employee' })
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: RequestUser) {
    const scope = permissionScope(user, 'employee:update');
    if (scope === 'SELF' && id !== user.employeeId) throw new ForbiddenException('Chỉ được cập nhật hồ sơ của chính mình');
    if (scope === 'SELF' && (dto.primaryBranchId !== undefined || dto.branchIds !== undefined)) throw new ForbiddenException('Không thể thay đổi chi nhánh trong phạm vi cá nhân');
    if (scope === 'BRANCH') {
      const { from, to } = this.currentMonth();
      const branchIds = branchIdsForPeriod(user, from, to);
      await this.employees.getById(id, false, { scope, employeeId: user.employeeId, branchIds, from, to });
      if ([dto.primaryBranchId, ...(dto.branchIds ?? [])].filter(Boolean).some((branchId) => !branchIds.includes(branchId!))) {
        throw new ForbiddenException('Chỉ được chuyển nhân viên trong các chi nhánh được phân quyền');
      }
    }
    return this.employees.update(
      id,
      dto,
      { actorId: user.id },
      ['ALL', 'BRANCH'].includes(permissionScope(user, 'payroll:update')),
      permissionScope(user, 'branch:create') !== 'NONE' && permissionScope(user, 'attendance-policy:update') !== 'NONE',
    );
  }

  @Delete(':id')
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Deprecated: permanent deletion requires POST /employees/:id/permanent-delete' })
  remove() {
    return { message: 'Use POST /employees/:id/permanent-delete with the current admin password.' };
  }

  @Post(':id/permanent-delete')
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Permanently delete an employee, account, and all employee-owned history (ADMIN only)' })
  permanentlyDelete(
    @Param('id') id: string,
    @Body() dto: PermanentDeleteEmployeeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.employees.permanentlyDelete(id, dto.currentPassword, {
      actorId: user.id,
      actorRoles: user.roles,
    });
  }

  @Post(':id/terminate')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Terminate an employee while retaining all history' })
  terminate(
    @Param('id') id: string,
    @Body() dto: TerminateEmployeeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.employees.terminate(id, dto, { actorId: user.id });
  }

  @Post(':id/restore')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Restore a soft-deleted employee' })
  restore(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.employees.restore(id, { actorId: user.id });
  }

  // ---- Job & salary history ----

  @Post(':id/job-history')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Add a job-history entry' })
  addJobHistory(@Param('id') id: string, @Body() dto: CreateJobHistoryDto, @CurrentUser() user: RequestUser) {
    return this.employees.addJobHistory(id, dto, { actorId: user.id });
  }

  @Post(':id/salary-history')
  @RequirePermissions('payroll:update')
  @ApiOperation({ summary: 'Add a salary-history entry' })
  addSalaryHistory(@Param('id') id: string, @Body() dto: CreateSalaryHistoryDto, @CurrentUser() user: RequestUser) {
    return this.employees.addSalaryHistory(id, dto, { actorId: user.id });
  }

  // ---- Documents (presigned upload flow) ----

  @Post(':id/uploads')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Get a presigned URL to upload a photo/document' })
  presign(@Param('id') id: string, @Body() dto: PresignUploadDto) {
    return this.employees.presignUpload(id, dto);
  }

  @Post(':id/documents')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Confirm an uploaded document' })
  addDocument(@Param('id') id: string, @Body() dto: CreateDocumentDto, @CurrentUser() user: RequestUser) {
    return this.employees.addDocument(id, dto, { actorId: user.id });
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Delete an employee document' })
  removeDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.employees.removeDocument(id, docId, { actorId: user.id });
  }

  private currentMonth() {
    const from = new Date();
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }
}
