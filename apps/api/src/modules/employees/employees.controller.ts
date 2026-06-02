import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto } from './dto/employee.dto';
import { CreateJobHistoryDto, CreateSalaryHistoryDto } from './dto/history.dto';
import { CreateDocumentDto, PresignUploadDto } from './dto/document.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List employees (paginated, filterable)' })
  list(@Query() query: EmployeeQueryDto) {
    return this.employees.list(query);
  }

  @Get(':id')
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'Get one employee with history & documents' })
  getOne(@Param('id') id: string) {
    return this.employees.getById(id);
  }

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Create an employee' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: RequestUser) {
    return this.employees.create(dto, { actorId: user.id });
  }

  @Put(':id')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Update an employee' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: RequestUser) {
    return this.employees.update(id, dto, { actorId: user.id });
  }

  @Delete(':id')
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Soft-delete an employee' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.employees.remove(id, { actorId: user.id });
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
  @RequirePermissions('employee:update')
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
