import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface SearchHit {
  type: 'employee' | 'project' | 'task' | 'document';
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

/** Global search across the primary entities. Results are capped per type. */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string): Promise<SearchHit[]> {
    if (!q || q.trim().length < 2) return [];
    const term = q.trim();
    const contains = { contains: term, mode: 'insensitive' as const };

    const [employees, projects, tasks, documents] = await Promise.all([
      this.prisma.employee.findMany({
        where: { deletedAt: null, OR: [{ fullName: contains }, { employeeNo: contains }] },
        take: 5,
        select: { id: true, fullName: true, employeeNo: true },
      }),
      this.prisma.project.findMany({ where: { OR: [{ name: contains }, { code: contains }] }, take: 5, select: { id: true, name: true, code: true } }),
      this.prisma.task.findMany({ where: { title: contains }, take: 5, select: { id: true, title: true } }),
      this.prisma.document.findMany({ where: { title: contains }, take: 5, select: { id: true, title: true } }),
    ]);

    return [
      ...employees.map((e): SearchHit => ({ type: 'employee', id: e.id, title: e.fullName, subtitle: e.employeeNo, href: `/dashboard/karyawan/${e.id}` })),
      ...projects.map((p): SearchHit => ({ type: 'project', id: p.id, title: p.name, subtitle: p.code, href: `/dashboard/proyek/${p.id}` })),
      ...tasks.map((t): SearchHit => ({ type: 'task', id: t.id, title: t.title, href: `/dashboard/tugas/${t.id}` })),
      ...documents.map((d): SearchHit => ({ type: 'document', id: d.id, title: d.title, href: `/dashboard/dokumen` })),
    ];
  }
}
