import { Body, Controller, Get, Post, Put, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { SchedulesService } from './schedules.service';
import { CheckDto, AttendanceQueryDto } from './dto/attendance.dto';
import { UpsertScheduleDto } from './dto/schedule.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser, isPrivileged } from '../../common/decorators/current-user.decorator';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly schedules: SchedulesService,
  ) {}

  /** Resolve the target employee for a self-service check; non-privileged users are forced to self. */
  private resolveSelf(dto: CheckDto, user: RequestUser): CheckDto {
    if (isPrivileged(user, 'attendance:update')) return dto;
    if (!user.employeeId) throw new ForbiddenException('Akun Anda tidak tertaut ke data karyawan');
    return { ...dto, employeeId: user.employeeId };
  }

  @Post('check-in')
  @RequirePermissions('attendance:create')
  @ApiOperation({ summary: 'Face check-in (verifies match, liveness, derives status)' })
  checkIn(@Body() dto: CheckDto, @CurrentUser() user: RequestUser) {
    return this.attendance.checkIn(this.resolveSelf(dto, user), { actorId: user.id });
  }

  @Post('check-out')
  @RequirePermissions('attendance:create')
  @ApiOperation({ summary: 'Face check-out for the current day' })
  checkOut(@Body() dto: CheckDto, @CurrentUser() user: RequestUser) {
    return this.attendance.checkOut(this.resolveSelf(dto, user), { actorId: user.id });
  }

  @Get('me/summary')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Personal month-to-date attendance summary' })
  mySummary(@CurrentUser() user: RequestUser) {
    if (!user.employeeId) throw new ForbiddenException('Akun Anda tidak tertaut ke data karyawan');
    return this.attendance.myMonthSummary(user.employeeId);
  }

  @Get()
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'List attendance records (employees see only their own)' })
  list(@Query() query: AttendanceQueryDto, @CurrentUser() user: RequestUser) {
    const scope = isPrivileged(user, 'attendance:update') ? null : user.employeeId ?? '__none__';
    return this.attendance.list(query, scope);
  }

  @Get('summary')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Company status breakdown (privileged only)' })
  summary(@Query('date') date: string | undefined, @CurrentUser() user: RequestUser) {
    if (!isPrivileged(user, 'attendance:update')) throw new ForbiddenException('Tidak diizinkan');
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
