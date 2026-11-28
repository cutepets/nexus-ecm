import { Body, Controller, Delete, Get, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { IpSecurityService } from './ip-security.service';
import { SetIpBlockDto, UpdateIpSecuritySettingsDto } from './dto/ip-security.dto';

@ApiTags('security')
@ApiBearerAuth()
@Controller('security')
export class SecurityController {
  constructor(private readonly security: IpSecurityService) {}

  @Get('ip-blocks')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'List currently blocked IP addresses' })
  listBlockedIps() {
    return this.security.listBlockedIps();
  }

  @Get('ip-settings')
  @RequirePermissions('settings:read')
  getIpSettings() {
    return this.security.getSettings();
  }

  @Put('ip-settings')
  @RequirePermissions('settings:update')
  updateIpSettings(@Body() dto: UpdateIpSecuritySettingsDto, @CurrentUser('id') actorId: string) {
    return this.security.updateSettings(dto.autoUnblockMinutes, actorId);
  }

  @Put('ip-blocks/:ipAddress')
  @RequirePermissions('settings:update')
  setIpBlock(
    @Param('ipAddress') ipAddress: string,
    @Body() dto: SetIpBlockDto,
    @CurrentUser('id') actorId: string,
    @Req() request: Request,
  ) {
    return this.security.setManualBlock(ipAddress, dto, actorId, request.ip);
  }

  @Delete('ip-blocks/:ipAddress')
  @RequirePermissions('settings:update')
  unblockIp(
    @Param('ipAddress') ipAddress: string,
    @CurrentUser('id') actorId: string,
    @Req() request: Request,
  ) {
    return this.security.unblockIp(ipAddress, actorId, request.ip);
  }
}
