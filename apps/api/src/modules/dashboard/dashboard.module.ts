import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { NotificationsService } from './notifications.service';
import { SearchService } from './search.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, NotificationsService, SearchService],
})
export class DashboardModule {}
