import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { FaceController } from './face.controller';
import { FaceService } from './face.service';
import { SchedulesService } from './schedules.service';
import { ScheduleResolverService } from './schedule-resolver.service';
import { WorkRosterService } from './work-roster.service';
import { WorkRosterAutomationService } from './work-roster-automation.service';

@Module({
  controllers: [AttendanceController, FaceController],
  providers: [AttendanceService, FaceService, SchedulesService, ScheduleResolverService, WorkRosterService, WorkRosterAutomationService],
})
export class AttendanceModule {}
