import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { NotificationsService } from './notifications.service';
import { SearchService } from './search.service';
import { CalendarService } from './calendar.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller()
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly notifications: NotificationsService,
    private readonly search: SearchService,
    private readonly calendar: CalendarService,
  ) {}

  // ---- Dashboard ----
  @Get('dashboard/summary')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Executive KPI summary' })
  summary() {
    return this.dashboard.summary();
  }

  // ---- Shared calendar ----
  @Get('calendar')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Company calendar: deadlines, leaves, milestones, holidays' })
  calendarEvents(@Query('from') from?: string, @Query('to') to?: string) {
    return this.calendar.events(from, to);
  }

  @Get('dashboard/activity')
  @RequirePermissions('dashboard:read')
  activity() {
    return this.dashboard.recentActivity();
  }

  // ---- Global search ----
  @Get('search')
  @ApiOperation({ summary: 'Global search across core entities' })
  globalSearch(@Query('q') q: string) {
    return this.search.search(q ?? '');
  }

  // ---- Audit log viewer ----
  @Get('audit-logs')
  @RequirePermissions('audit:read')
  auditLogs(
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.dashboard.auditLogs({ entity, action, actorId });
  }

  // ---- Notifications ----
  @Get('notifications')
  @RequirePermissions('notification:read')
  myNotifications(@CurrentUser() user: RequestUser, @Query('unread') unread?: string) {
    return this.notifications.list(user.id, unread === 'true');
  }

  @Get('notifications/unread-count')
  @RequirePermissions('notification:read')
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post('notifications/:id/read')
  @RequirePermissions('notification:read')
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('notifications/read-all')
  @RequirePermissions('notification:read')
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user.id);
  }
}
