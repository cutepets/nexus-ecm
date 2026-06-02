import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PositionsService } from './positions.service';
import { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('positions')
@ApiBearerAuth()
@Controller('positions')
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Get()
  @RequirePermissions('employee:read')
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiOperation({ summary: 'List positions, optionally filtered by department' })
  list(@Query('departmentId') departmentId?: string) {
    return this.positions.list(departmentId);
  }

  @Post()
  @RequirePermissions('employee:create')
  @ApiOperation({ summary: 'Create a position' })
  create(@Body() dto: CreatePositionDto, @CurrentUser() user: RequestUser) {
    return this.positions.create(dto, { actorId: user.id });
  }

  @Put(':id')
  @RequirePermissions('employee:update')
  @ApiOperation({ summary: 'Update a position' })
  update(@Param('id') id: string, @Body() dto: UpdatePositionDto, @CurrentUser() user: RequestUser) {
    return this.positions.update(id, dto, { actorId: user.id });
  }

  @Delete(':id')
  @RequirePermissions('employee:delete')
  @ApiOperation({ summary: 'Delete an empty position' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.positions.remove(id, { actorId: user.id });
  }
}
