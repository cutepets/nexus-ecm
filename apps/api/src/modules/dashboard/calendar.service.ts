import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

export type CalendarEventType = 'deadline' | 'leave' | 'milestone' | 'holiday';

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  type: CalendarEventType;
  title: string;
  detail?: string;
}

// Indonesian public holidays (tanggal merah) — representative 2026 set; extend as needed.
const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': 'Tahun Baru Masehi',
  '2026-02-17': 'Tahun Baru Imlek',
  '2026-03-19': 'Hari Raya Nyepi',
  '2026-03-20': 'Idul Fitri',
  '2026-03-21': 'Idul Fitri',
  '2026-04-03': 'Wafat Isa Almasih',
  '2026-05-01': 'Hari Buruh',
  '2026-05-14': 'Kenaikan Isa Almasih',
  '2026-05-27': 'Idul Adha',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-08-17': 'Hari Kemerdekaan RI',
  '2026-12-25': 'Hari Natal',
};

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private iso(d: Date) {
    return new Date(d).toISOString().slice(0, 10);
  }

  /** Aggregate company-wide calendar events within [from, to]. */
  async events(fromStr?: string, toStr?: string): Promise<CalendarEvent[]> {
    const now = new Date();
    const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = toStr ? new Date(toStr) : new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const [tasks, milestones, leaves] = await Promise.all([
      this.prisma.task.findMany({
        where: { dueDate: { gte: from, lte: to } },
        select: { id: true, title: true, dueDate: true, status: true, project: { select: { name: true } } },
      }),
      this.prisma.milestone.findMany({
        where: { dueDate: { gte: from, lte: to } },
        select: { id: true, title: true, dueDate: true, project: { select: { name: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: { status: 'APPROVED', startDate: { lte: to }, endDate: { gte: from } },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          employee: { select: { fullName: true } },
          leaveType: { select: { name: true } },
        },
      }),
    ]);

    const events: CalendarEvent[] = [];

    for (const t of tasks) {
      if (t.dueDate) {
        events.push({
          date: this.iso(t.dueDate),
          type: 'deadline',
          title: t.title,
          detail: `Deadline tugas${t.project ? ` · ${t.project.name}` : ''} (${t.status})`,
        });
      }
    }

    for (const m of milestones) {
      if (m.dueDate) {
        events.push({
          date: this.iso(m.dueDate),
          type: 'milestone',
          title: m.title,
          detail: `Milestone${m.project ? ` · ${m.project.name}` : ''}`,
        });
      }
    }

    // Expand each approved leave across its days within range.
    for (const l of leaves) {
      const start = new Date(Math.max(new Date(l.startDate).getTime(), from.getTime()));
      const end = new Date(Math.min(new Date(l.endDate).getTime(), to.getTime()));
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        events.push({
          date: this.iso(d),
          type: 'leave',
          title: `${l.employee.fullName} — ${l.leaveType.name}`,
          detail: `Cuti ${this.iso(l.startDate)} s/d ${this.iso(l.endDate)}`,
        });
      }
    }

    // Holidays within range.
    for (const [date, name] of Object.entries(HOLIDAYS_2026)) {
      const d = new Date(date);
      if (d >= from && d <= to) events.push({ date, type: 'holiday', title: name, detail: 'Hari libur nasional' });
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }
}
