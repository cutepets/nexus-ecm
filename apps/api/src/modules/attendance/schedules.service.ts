import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { UpsertScheduleDto } from './dto/schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.workSchedule.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: UpsertScheduleDto, ctx: AuditContext) {
    const schedule = await this.prisma.workSchedule.create({
      data: { ...dto, graceMinutes: dto.graceMinutes ?? 15 },
    });
    await this.audit.record({ action: 'CREATE', entity: 'WorkSchedule', entityId: schedule.id, after: schedule, ctx });
    return schedule;
  }

  async update(id: string, dto: UpsertScheduleDto, ctx: AuditContext) {
    const before = await this.prisma.workSchedule.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Schedule not found');
    const schedule = await this.prisma.workSchedule.update({ where: { id }, data: dto });
    await this.audit.record({ action: 'UPDATE', entity: 'WorkSchedule', entityId: id, before, after: schedule, ctx });
    return schedule;
  }
}
