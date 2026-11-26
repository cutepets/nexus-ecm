import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CreateTimesheetPeriodDto, ReopenTimesheetPeriodDto, TimesheetQueryDto } from './dto/timesheet.dto';
import { TimesheetsService } from './timesheets.service';

@ApiTags('timesheets')
@ApiBearerAuth()
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}

  @Get()
  @RequirePermissions('attendance:review')
  list() { return this.timesheets.list(); }

  @Post()
  @RequirePermissions('attendance:review')
  create(@Body() dto: CreateTimesheetPeriodDto, @CurrentUser() user: RequestUser) { return this.timesheets.create(dto.startDate, dto.endDate, { actorId: user.id }); }

  @Get(':id/entries')
  @RequirePermissions('attendance:review')
  entries(@Param('id') id: string, @Query() query: TimesheetQueryDto) { return this.timesheets.entries(id, query.employeeId); }

  @Post(':id/recalculate')
  @RequirePermissions('attendance:review')
  @ApiOperation({ summary: 'Rebuild draft/review timesheet entries from immutable attendance sessions' })
  recalculate(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.timesheets.recalculate(id, { actorId: user.id }); }

  @Put(':id/submit-review')
  @RequirePermissions('attendance:review')
  submitReview(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.timesheets.submitReview(id, { actorId: user.id }); }

  @Put(':id/lock')
  @RequirePermissions('attendance:review')
  lock(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.timesheets.lock(id, { actorId: user.id }); }

  @Put(':id/reopen')
  @RequirePermissions('attendance:review')
  reopen(@Param('id') id: string, @Body() dto: ReopenTimesheetPeriodDto, @CurrentUser() user: RequestUser) { return this.timesheets.reopen(id, dto.reason, { actorId: user.id }); }
}
