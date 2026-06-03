import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto, DecisionDto, LeaveQueryDto, PresignLeaveDocDto } from './dto/leave.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, RequestUser, isPrivileged } from '../../common/decorators/current-user.decorator';

@ApiTags('leave')
@ApiBearerAuth()
@Controller('leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('types')
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'List leave types' })
  types() {
    return this.leave.listTypes();
  }

  @Get('balances/:employeeId')
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'Leave balances for an employee (current year)' })
  balances(@Param('employeeId') employeeId: string) {
    return this.leave.balances(employeeId);
  }

  @Post('uploads')
  @RequirePermissions('leave:create')
  @ApiOperation({ summary: 'Presign a supporting-document upload' })
  presign(@Body() dto: PresignLeaveDocDto) {
    return this.leave.presignDoc(dto.fileName);
  }

  @Get('requests')
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'List leave requests (employees see only their own)' })
  list(@Query() query: LeaveQueryDto, @CurrentUser() user: RequestUser) {
    if (!isPrivileged(user, 'leave:approve')) {
      return this.leave.list({ ...query, employeeId: user.employeeId ?? '__none__' });
    }
    return this.leave.list(query);
  }

  @Get('requests/inbox')
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Approval inbox — requests awaiting a decision' })
  inbox() {
    return this.leave.inbox();
  }

  @Get('requests/:id')
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'Leave request detail with approval timeline' })
  getOne(@Param('id') id: string) {
    return this.leave.getById(id);
  }

  @Post('requests')
  @RequirePermissions('leave:create')
  @ApiOperation({ summary: 'Submit a leave request (employees auto-submit for themselves)' })
  create(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: RequestUser) {
    if (!isPrivileged(user, 'leave:approve')) {
      if (!user.employeeId) throw new ForbiddenException('Akun Anda tidak tertaut ke data karyawan');
      return this.leave.create({ ...dto, employeeId: user.employeeId }, { actorId: user.id });
    }
    return this.leave.create(dto, { actorId: user.id });
  }

  @Post('requests/:id/decision')
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Approve or reject the current approval step' })
  decide(@Param('id') id: string, @Body() dto: DecisionDto, @CurrentUser() user: RequestUser) {
    return this.leave.decide(id, dto, user.id, { actorId: user.id });
  }

  @Delete('requests/:id')
  @RequirePermissions('leave:create')
  @ApiOperation({ summary: 'Withdraw a pending leave request' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.leave.remove(id, { actorId: user.id });
  }
}
