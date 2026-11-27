import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UsersService, ResolvedUser } from '../users/users.service';
import { PasswordService } from './password.service';
import { AccessTokenPayload } from './strategies/jwt.strategy';

interface RefreshPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  // ---- Public API ----

  async login(identifier: string, plainPassword: string, ctx: { ip?: string; ua?: string }) {
    const user = await this.users.findByLoginIdentifier(identifier);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const ok = await this.password.verify(user.passwordHash, plainPassword);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit(user.id, 'LOGIN', 'User', user.id, ctx);

    return this.issueTokens(user, ctx);
  }

  async refresh(refreshToken: string, ctx: { ip?: string; ua?: string }) {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    // Reuse / unknown token detection: signature valid but token not in store (already rotated)
    if (!stored) {
      await this.revokeAllForUser(payload.sub);
      throw new ForbiddenException('Refresh token reuse detected');
    }
    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      throw new ForbiddenException('Refresh token reuse detected');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: revoke the used token, issue a new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive) throw new UnauthorizedException();

    return this.issueTokens(user, ctx);
  }

  async logout(refreshToken: string, userId: string, ctx: { ip?: string; ua?: string }) {
    const tokenHash = this.sha256(refreshToken);
    await this.prisma.refreshToken.updateMany({
      // A valid access token must never be able to revoke a different user's
      // refresh session when that token value is supplied by a malicious client.
      where: { tokenHash, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit(userId, 'LOGOUT', 'User', userId, ctx);
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.toAuthUser(user);
  }

  // ---- Internals ----

  private async issueTokens(user: ResolvedUser, ctx: { ip?: string; ua?: string }) {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      permissionScopes: user.permissionScopes,
      employeeId: user.employeeId,
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.sha256(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
        deviceInfo: ctx.ua,
        ip: ctx.ip,
      },
    });

    return { accessToken, refreshToken, user: this.toAuthUser(user) };
  }

  private async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toAuthUser(user: ResolvedUser) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarPortraitUrl ?? user.avatarUrl,
      avatarPortraitUrl: user.avatarPortraitUrl,
      avatarCropUrl: user.avatarCropUrl,
      roles: user.roles,
      permissions: user.permissions,
      permissionScopes: user.permissionScopes,
      employeeId: user.employeeId,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private async audit(
    actorId: string,
    action: 'LOGIN' | 'LOGOUT',
    entity: string,
    entityId: string,
    ctx: { ip?: string; ua?: string },
  ) {
    await this.prisma.auditLog.create({
      data: { actorId, action, entity, entityId, ip: ctx.ip, userAgent: ctx.ua },
    });
  }
}
