import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FaceService } from './face.service';
import { EnrollFaceDto } from './dto/face.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('attendance-face')
@ApiBearerAuth()
@Controller('attendance/face')
export class FaceController {
  constructor(private readonly face: FaceService) {}

  @Post('enroll')
  @RequirePermissions('attendance:face:enroll')
  @ApiOperation({ summary: 'Enroll face embeddings for an employee (with dedup)' })
  enroll(@Body() dto: EnrollFaceDto, @CurrentUser() user: RequestUser) {
    return this.face.enroll(dto, { actorId: user.id });
  }

  @Get(':employeeId/status')
  @RequirePermissions('attendance:read')
  @ApiOperation({ summary: 'Whether an employee has enrolled face profiles' })
  status(@Param('employeeId') employeeId: string) {
    return this.face.status(employeeId);
  }

  @Delete(':employeeId')
  @RequirePermissions('attendance:face:enroll')
  @ApiOperation({ summary: 'Purge all face data for an employee (privacy)' })
  purge(@Param('employeeId') employeeId: string, @CurrentUser() user: RequestUser) {
    return this.face.purge(employeeId, { actorId: user.id });
  }
}
