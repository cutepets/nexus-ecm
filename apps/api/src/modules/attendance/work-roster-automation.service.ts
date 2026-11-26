import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { workDateInTimeZone } from '../../common/utils/company-time';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WorkRosterService } from './work-roster.service';

/** Periodic, idempotent generation of future work rosters. */
@Injectable()
export class WorkRosterAutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkRosterAutomationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rosters: WorkRosterService,
  ) {}

  onModuleInit() {
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), 15 * 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const setting = await this.prisma.companySetting.upsert({
        where: { id: 'default' },
        update: {},
        create: { id: 'default' },
        select: {
          timezone: true,
          rosterAutoGenerateEnabled: true,
          rosterGenerationDay: true,
        },
      });
      const today = workDateInTimeZone(now, setting.timezone);
      if (setting.rosterAutoGenerateEnabled && today.getUTCDate() >= setting.rosterGenerationDay) {
        const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
        const exists = await this.prisma.workRosterMonth.findUnique({ where: { monthStart: nextMonth }, select: { id: true } });
        if (!exists) await this.rosters.generate(this.monthKey(nextMonth), { actorId: 'system:monthly-roster' });
      }
    } catch (error) {
      this.logger.error(`Roster automation failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private monthKey(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
