import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'EXPORT';

export interface AuditContext {
  actorId?: string;
  ip?: string;
  ua?: string;
}

/**
 * Central audit logging. Records who changed what, with before/after snapshots
 * for mutations. Failures are swallowed (logged) so auditing never breaks a
 * business operation.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    action: AuditAction;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ctx?: AuditContext;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.ctx?.actorId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          before: (params.before as object) ?? undefined,
          after: (params.after as object) ?? undefined,
          ip: params.ctx?.ip,
          userAgent: params.ctx?.ua,
        },
      });
    } catch (err) {
      this.logger.warn(`Audit write failed for ${params.entity}: ${(err as Error).message}`);
    }
  }
}
