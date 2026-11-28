import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isIP } from 'node:net';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';

const FAILURE_LIMIT = 5;
const FAILURE_WINDOW_MS = 60 * 60 * 1000;

function normalizeIpAddress(ip: string) {
  const value = ip.trim().replace(/^::ffff:/i, '');
  if (!isIP(value)) throw new BadRequestException('Invalid IP address');
  return value.toLowerCase();
}

@Injectable()
export class IpSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async assertIpAllowed(ipAddress: string) {
    const ip = normalizeIpAddress(ipAddress);
    const now = new Date();
    const control = await this.prisma.loginIpControl.findUnique({ where: { ipAddress: ip } });
    if (!control?.blockedAt) return;
    if (control.isPermanent || (control.expiresAt && control.expiresAt > now)) {
      throw new ForbiddenException('IP_BLOCKED');
    }
    await this.prisma.loginIpControl.update({
      where: { ipAddress: ip },
      data: { blockedAt: null, expiresAt: null, isPermanent: false, reason: null, failedAttempts: 0, failureWindowStartedAt: null },
    });
  }

  async recordFailedLogin(ipAddress: string) {
    const ip = normalizeIpAddress(ipAddress);
    const now = new Date();
    const settings = await this.getSettings();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ip}))::text AS lock_result`;
      const existing = await tx.loginIpControl.findUnique({ where: { ipAddress: ip } });
      if (existing?.isPermanent || (existing?.expiresAt && existing.expiresAt > now)) return true;

      const inWindow = Boolean(
        existing?.failureWindowStartedAt &&
        now.getTime() - existing.failureWindowStartedAt.getTime() < FAILURE_WINDOW_MS,
      );
      const failedAttempts = inWindow ? (existing?.failedAttempts ?? 0) + 1 : 1;
      const failureWindowStartedAt = inWindow ? existing!.failureWindowStartedAt! : now;
      const shouldBlock = failedAttempts >= FAILURE_LIMIT;
      const expiresAt = shouldBlock
        ? new Date(now.getTime() + settings.autoUnblockMinutes * 60_000)
        : null;
      const data = {
        failedAttempts,
        failureWindowStartedAt,
        ...(shouldBlock ? { blockedAt: now, expiresAt, isPermanent: false, reason: 'AUTO_LOGIN_FAILURES' } : {}),
      };
      await tx.loginIpControl.upsert({
        where: { ipAddress: ip },
        create: { ipAddress: ip, ...data },
        update: data,
      });
      return shouldBlock;
    });
  }

  async getSettings() {
    return this.prisma.ipSecuritySettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', autoUnblockMinutes: 60 },
      update: {},
      select: { autoUnblockMinutes: true },
    });
  }

  async updateSettings(autoUnblockMinutes: number, actorId: string) {
    const setting = await this.prisma.ipSecuritySettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', autoUnblockMinutes },
      update: { autoUnblockMinutes },
      select: { autoUnblockMinutes: true },
    });
    await this.audit.record({
      action: 'UPDATE', entity: 'IpSecuritySettings', entityId: 'default',
      after: setting, ctx: { actorId },
    });
    return setting;
  }

  async listBlockedIps() {
    const now = new Date();
    await this.prisma.loginIpControl.updateMany({
      where: { isPermanent: false, blockedAt: { not: null }, expiresAt: { lte: now } },
      data: { blockedAt: null, expiresAt: null, failedAttempts: 0, failureWindowStartedAt: null, isPermanent: false, reason: null },
    });
    return this.prisma.loginIpControl.findMany({
      where: { blockedAt: { not: null }, OR: [{ isPermanent: true }, { expiresAt: { gt: now } }] },
      orderBy: { blockedAt: 'desc' },
      select: { ipAddress: true, blockedAt: true, expiresAt: true, isPermanent: true, reason: true },
    });
  }

  async setManualBlock(
    ipAddress: string,
    options: { isPermanent: boolean },
    actorId: string,
    actorIp?: string,
  ) {
    const ip = normalizeIpAddress(ipAddress);
    if (actorIp && normalizeIpAddress(actorIp) === ip) {
      throw new BadRequestException('You cannot block your current IP address');
    }
    const settings = await this.getSettings();
    const blockedAt = new Date();
    const result = await this.prisma.loginIpControl.upsert({
      where: { ipAddress: ip },
      create: {
        ipAddress: ip, failedAttempts: 0, blockedAt,
        expiresAt: options.isPermanent ? null : new Date(blockedAt.getTime() + settings.autoUnblockMinutes * 60_000),
        isPermanent: options.isPermanent, reason: 'ADMIN',
      },
      update: {
        blockedAt,
        expiresAt: options.isPermanent ? null : new Date(blockedAt.getTime() + settings.autoUnblockMinutes * 60_000),
        isPermanent: options.isPermanent,
        reason: 'ADMIN',
      },
    });
    await this.audit.record({
      action: 'UPDATE', entity: 'LoginIpControl', entityId: ip,
      after: { isPermanent: result.isPermanent, expiresAt: result.expiresAt },
      ctx: { actorId, ip: actorIp },
    });
    return result;
  }

  async unblockIp(ipAddress: string, actorId: string, actorIp?: string) {
    const ip = normalizeIpAddress(ipAddress);
    const result = await this.prisma.loginIpControl.updateMany({
      where: { ipAddress: ip },
      data: {
        failedAttempts: 0, failureWindowStartedAt: null, blockedAt: null,
        expiresAt: null, isPermanent: false, reason: null,
      },
    });
    await this.audit.record({
      action: 'UPDATE', entity: 'LoginIpControl', entityId: ip,
      after: { unblocked: result.count > 0 }, ctx: { actorId, ip: actorIp },
    });
    return { success: true };
  }
}
