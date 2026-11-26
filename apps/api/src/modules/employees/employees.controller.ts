import {
  BadRequestException,
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
import { CurrentUser, isPrivileged, RequestUser } from '../../common/decorators/current-user.decorator';
import { EmployeesExcelService } from './employees-excel.service';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService, private readonly excel: EmployeesExcelService) {}

  @Get()
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List employees (paginated, filterable)' })
  list(@Query() query: EmployeeQueryDto, @CurrentUser() user: RequestUser) {
    return this.employees.list(query, isPrivileged(user, 'payroll:read'));
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
  async excelExport(@Res() res: Response) {
    const buffer = await this.excel.export();
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
    return this.employees.getById(id, isPrivileged(user, 'payroll:read'));
  }

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Create an employee' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: RequestUser) {
    return this.employees.create(
      dto,
      { actorId: user.id },
      isPrivileged(user, 'payroll:update'),
      isPrivileged(user, 'branch:create') && isPrivileged(user, 'attendance-policy:update'),
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
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: RequestUser) {
    return this.employees.update(
      id,
      dto,
      { actorId: user.id },
      isPrivileged(user, 'payroll:update'),
      isPrivileged(user, 'branch:create') && isPrivileged(user, 'attendance-policy:update'),
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
}
