import { Body, Controller, Get, Post, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

function ctxOf(req: Request) {
  return { ip: req.ip, ua: req.headers['user-agent'] };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with username, phone, or email + password' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.identifier ?? dto.email ?? '', dto.password, ctxOf(req));
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair (rotating)' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, ctxOf(req));
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the provided refresh token' })
  logout(@Body() dto: RefreshDto, @CurrentUser('id') userId: string, @Req() req: Request) {
    return this.auth.logout(dto.refreshToken, userId, ctxOf(req));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }
}
