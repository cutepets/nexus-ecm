import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { FaceService } from './face.service';
import { CheckDto, AttendanceQueryDto } from './dto/attendance.dto';
import { distanceToConfidence, minDistance } from './embedding.util';

@Injectable()
export class AttendanceService {
  private readonly threshold = Number(process.env.FACE_MATCH_THRESHOLD ?? 0.55);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly face: FaceService,
  ) {}

  async checkIn(dto: CheckDto, ctx: AuditContext) {
    const { employee, matchScore } = await this.verify(dto);
    if (!dto.livenessPassed) throw new BadRequestException('Liveness check failed');

    const now = new Date();
    const workDate = this.dateOnly(now);
    const status = await this.deriveStatus(now);
    const photoUrl = dto.photo
      ? await this.storage.putBase64Image(`attendance/${employee.id}/in`, dto.photo)
      : undefined;

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });
    if (existing?.checkInAt) throw new BadRequestException('Already checked in today');

    const record = await this.prisma.attendance.upsert({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      create: {
        employeeId: employee.id,
        workDate,
        checkInAt: now,
        checkInLat: dto.lat,
        checkInLng: dto.lng,
        checkInPhotoUrl: photoUrl,
        deviceInfo: dto.deviceInfo as Prisma.InputJsonValue,
        matchScore,
        livenessPassed: dto.livenessPassed,
        status,
      },
      update: {
        checkInAt: now,
        checkInLat: dto.lat,
        checkInLng: dto.lng,
        checkInPhotoUrl: photoUrl,
        matchScore,
        livenessPassed: dto.livenessPassed,
        status,
      },
    });

    await this.audit.record({ action: 'CREATE', entity: 'Attendance', entityId: record.id, after: { status }, ctx });
    return { ...record, employee: { id: employee.id, fullName: employee.fullName }, matchScore };
  }

  async checkOut(dto: CheckDto, ctx: AuditContext) {
    const { employee, matchScore } = await this.verify(dto);

    const now = new Date();
    const workDate = this.dateOnly(now);
    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
    });
    if (!existing?.checkInAt) throw new BadRequestException('No check-in found for today');
    if (existing.checkOutAt) throw new BadRequestException('Already checked out today');

    const photoUrl = dto.photo
      ? await this.storage.putBase64Image(`attendance/${employee.id}/out`, dto.photo)
      : undefined;

    const record = await this.prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        checkOutLat: dto.lat,
        checkOutLng: dto.lng,
        checkOutPhotoUrl: photoUrl,
      },
    });

    await this.audit.record({ action: 'UPDATE', entity: 'Attendance', entityId: record.id, after: { checkOut: true }, ctx });
    return { ...record, employee: { id: employee.id, fullName: employee.fullName }, matchScore };
  }

  async list(query: AttendanceQueryDto) {
    const where: Prisma.AttendanceWhereInput = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status as Prisma.AttendanceWhereInput['status'];
    if (query.date) {
      where.workDate = this.dateOnly(new Date(query.date));
    } else if (query.from || query.to) {
      where.workDate = {
        ...(query.from ? { gte: this.dateOnly(new Date(query.from)) } : {}),
        ...(query.to ? { lte: this.dateOnly(new Date(query.to)) } : {}),
      };
    }

    return this.prisma.attendance.findMany({
      where,
      include: { employee: { select: { id: true, fullName: true, employeeNo: true } } },
      orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
      take: 200,
    });
  }

  /** Status breakdown for a single day (defaults to today). */
  async summary(dateStr?: string) {
    const workDate = this.dateOnly(dateStr ? new Date(dateStr) : new Date());
    const grouped = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { workDate },
      _count: { _all: true },
    });
    const counts: Record<string, number> = { PRESENT: 0, LATE: 0, LEAVE: 0, PERMIT: 0, ABSENT: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;

    const totalActive = await this.prisma.employee.count({ where: { deletedAt: null } });
    const recorded = Object.values(counts).reduce((a, b) => a + b, 0);
    counts.ABSENT = Math.max(counts.ABSENT, totalActive - recorded);

    return { date: workDate.toISOString().slice(0, 10), totalActive, counts };
  }

  // ---- internals ----

  /** Match the probe embedding against the employee's enrolled profiles. */
  private async verify(dto: CheckDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const enrolled = await this.face.loadEmbeddings(employee.id);
    if (!enrolled.length) throw new BadRequestException('Employee has no enrolled face');

    const dist = minDistance(dto.embedding, enrolled);
    if (dist > this.threshold) throw new UnauthorizedException('Face not recognized');

    return { employee, matchScore: Number(distanceToConfidence(dist).toFixed(4)) };
  }

  private async deriveStatus(at: Date): Promise<'PRESENT' | 'LATE'> {
    const schedule = await this.prisma.workSchedule.findFirst({ orderBy: { name: 'asc' } });
    if (!schedule) return 'PRESENT';

    const [h, m] = schedule.startTime.split(':').map(Number);
    const deadline = h * 60 + m + schedule.graceMinutes;
    const arrived = at.getHours() * 60 + at.getMinutes();
    return arrived <= deadline ? 'PRESENT' : 'LATE';
  }

  private dateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
}
