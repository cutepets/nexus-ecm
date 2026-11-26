import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuditContext } from '../../core/audit/audit.service';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  ResetUserPasswordDto,
  SetAccountStatusDto,
  SensitiveAccountActionDto,
  SetUserRolesDto,
  LinkEmployeeAccountDto,
  ChangeMyPasswordDto,
  PresignMyAvatarDto,
  UpdateMyProfileDto,
  UpdateUserAccountDto,
  UserAccountQueryDto,
} from './dto/user-account.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Read the current account profile' })
  me(@CurrentUser() user: RequestUser) {
    return this.users.getMyProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current account profile' })
  updateMe(@Body() dto: UpdateMyProfileDto, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.users.updateMyProfile(user.id, dto, this.auditContext(user, request));
  }

  @Post('me/avatar-upload')
  @ApiOperation({ summary: 'Get a presigned URL for the current account avatar' })
  presignMyAvatar(@Body() dto: PresignMyAvatarDto, @CurrentUser() user: RequestUser) {
    return this.users.presignMyAvatar(user.id, dto.fileName);
  }

  @Post('me/change-password')
  @ApiOperation({ summary: 'Change current password and revoke active sessions' })
  changeMyPassword(@Body() dto: ChangeMyPasswordDto, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.users.changeMyPassword(user.id, dto.currentPassword, dto.newPassword, this.auditContext(user, request));
  }

  @Get()
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'List login accounts' })
  list(@Query() query: UserAccountQueryDto) {
    return this.users.listAccounts(query);
  }

  @Get('roles/options')
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'List roles available for account assignment' })
  listRoleOptions() {
    return this.users.listRoleOptions();
  }

  @Get(':id')
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'Read a login account' })
  getOne(@Param('id') id: string) {
    return this.users.getAccount(id);
  }

  @Patch(':id')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'Update account identity and profile' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserAccountDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.users.updateAccount(id, dto, this.auditContext(user, request));
  }

  @Put(':id/status')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'Activate or deactivate an account' })
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetAccountStatusDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.confirmAndSetStatus(id, dto, user, request);
  }

  private async confirmAndSetStatus(id: string, dto: SetAccountStatusDto, user: RequestUser, request: Request) {
    await this.users.verifyActorPassword(user.id, dto.currentPassword);
    return this.users.setAccountStatus(id, dto.isActive, this.auditContext(user, request));
  }

  @Post(':id/reset-password')
  @RequirePermissions('user:reset-password')
  @ApiOperation({ summary: 'Reset password and revoke all sessions' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    await this.users.verifyActorPassword(user.id, dto.currentPassword);
    return this.users.resetPassword(id, dto.password, this.auditContext(user, request));
  }

  @Put(':id/roles')
  @RequirePermissions('user:manage-roles')
  @ApiOperation({ summary: 'Replace account roles and revoke all sessions' })
  async setRoles(
    @Param('id') id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    await this.users.verifyActorPassword(user.id, dto.currentPassword);
    return this.users.setAccountRoles(id, dto.roleIds, this.auditContext(user, request));
  }

  @Post(':id/revoke-sessions')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'Revoke all active refresh-token sessions for an account' })
  revokeSessions(@Param('id') id: string, @Body() dto: SensitiveAccountActionDto, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.confirmAndRevoke(id, dto, user, request);
  }

  private async confirmAndRevoke(id: string, dto: SensitiveAccountActionDto, user: RequestUser, request: Request) {
    await this.users.verifyActorPassword(user.id, dto.currentPassword);
    return this.users.revokeSessions(id, this.auditContext(user, request));
  }

  @Put(':id/employee')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'One-time reconciliation link for a legacy system account' })
  linkEmployee(@Param('id') id: string, @Body() dto: LinkEmployeeAccountDto, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.users.linkEmployee(id, dto.employeeId ?? null, this.auditContext(user, request));
  }

  @Delete(':id')
  @RequirePermissions('user:delete')
  @ApiOperation({ summary: 'Soft-delete an unlinked account and revoke all sessions' })
  async remove(@Param('id') id: string, @Body() dto: SensitiveAccountActionDto, @CurrentUser() user: RequestUser, @Req() request: Request) {
    await this.users.verifyActorPassword(user.id, dto.currentPassword);
    return this.users.softDeleteAccount(id, this.auditContext(user, request));
  }

  private auditContext(user: RequestUser, request: Request): AuditContext {
    return { actorId: user.id, ip: request.ip, ua: request.get('user-agent') };
  }
}
