import { Body, Controller, Get, Post, Put, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { SchedulesService } from './schedules.service';
import { CheckDto, AttendanceQueryDto } from './dto/attendance.dto';
import { UpsertScheduleDto } from './dto/schedule.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly schedules: SchedulesService,
  ) {}

  @Post('check-in')
  @RequirePermissions('attendance:create')
  @ApiOperation({ summary: 'Face check-in (verifies match, liveness, derives status)' })
  checkIn(@Body() dto: CheckDto, @CurrentUser() user: RequestUser) {
    return this.attendance.checkIn(dto, { actorId: user.id });
  }

  @Post('check-out')
  @RequirePermissions('attendance:create')
  @ApiOperation({ summary: 'Face check-out for the current day' })
  checkOut(@Body() dto: CheckDto, @CurrentUser() user: RequestUser) {
    return this.attendance.checkOut(dto, { actorId: user.id });
  }

  @Get()
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'List attendance records (filterable by date/range/employee/status)' })
  list(@Query() query: AttendanceQueryDto) {
    return this.attendance.list(query);
  }

  @Get('summary')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Status breakdown for a given day' })
  summary(@Query('date') date?: string) {
    return this.attendance.summary(date);
  }

  // ---- Work schedules ----

  @Get('schedules')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'List work schedules' })
  listSchedules() {
    return this.schedules.list();
  }

  @Post('schedules')
  @RequirePermissions('attendance:update')
  @ApiOperation({ summary: 'Create a work schedule' })
  createSchedule(@Body() dto: UpsertScheduleDto, @CurrentUser() user: RequestUser) {
    return this.schedules.create(dto, { actorId: user.id });
  }

  @Put('schedules/:id')
  @RequirePermissions('attendance:update')
  @ApiOperation({ summary: 'Update a work schedule' })
  updateSchedule(@Param('id') id: string, @Body() dto: UpsertScheduleDto, @CurrentUser() user: RequestUser) {
    return this.schedules.update(id, dto, { actorId: user.id });
  }
}
