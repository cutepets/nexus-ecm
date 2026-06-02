import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermissions('employee:read')
  @ApiOperation({ summary: 'List departments with counts' })
  list() {
    return this.departments.list();
  }

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: RequestUser) {
    return this.departments.create(dto, { actorId: user.id });
  }

  @Put(':id')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Update a department' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto, @CurrentUser() user: RequestUser) {
    return this.departments.update(id, dto, { actorId: user.id });
  }

  @Delete(':id')
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Delete an empty department' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.departments.remove(id, { actorId: user.id });
  }
}
