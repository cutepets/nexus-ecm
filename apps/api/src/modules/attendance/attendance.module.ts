import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { FaceController } from './face.controller';
import { FaceService } from './face.service';
import { SchedulesService } from './schedules.service';

@Module({
  controllers: [AttendanceController, FaceController],
  providers: [AttendanceService, FaceService, SchedulesService],
})
export class AttendanceModule {}
