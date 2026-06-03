import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { NotificationsService } from './notifications.service';
import { SearchService } from './search.service';
import { CalendarService } from './calendar.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, NotificationsService, SearchService, CalendarService],
})
export class DashboardModule {}
