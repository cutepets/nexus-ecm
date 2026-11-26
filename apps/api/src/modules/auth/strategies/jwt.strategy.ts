import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  employeeId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET as string,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    if (!payload?.sub) throw new UnauthorizedException();
    // The token only establishes identity. Re-load the account so a lock,
    // deletion, or role update is effective immediately instead of waiting
    // for the (short-lived) access token to expire.
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      employeeId: user.employeeId,
    };
  }
}
