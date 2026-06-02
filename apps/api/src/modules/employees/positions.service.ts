import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { CreatePositionDto, UpdatePositionDto } from './dto/position.dto';

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(departmentId?: string) {
    return this.prisma.position.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count: { select: { employees: true } },
      },
      orderBy: [{ department: { name: 'asc' } }, { level: 'desc' }, { title: 'asc' }],
    });
  }

  async create(dto: CreatePositionDto, ctx: AuditContext) {
    const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
    if (!dept) throw new BadRequestException('Department not found');

    const position = await this.prisma.position.create({ data: dto });
    await this.audit.record({ action: 'CREATE', entity: 'Position', entityId: position.id, after: position, ctx });
    return position;
  }

  async update(id: string, dto: UpdatePositionDto, ctx: AuditContext) {
    const before = await this.prisma.position.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Position not found');

    const position = await this.prisma.position.update({ where: { id }, data: dto });
    await this.audit.record({ action: 'UPDATE', entity: 'Position', entityId: id, before, after: position, ctx });
    return position;
  }

  async remove(id: string, ctx: AuditContext) {
    const position = await this.prisma.position.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!position) throw new NotFoundException('Position not found');
    if (position._count.employees > 0) {
      throw new BadRequestException('Cannot delete a position that still has employees');
    }

    await this.prisma.position.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'Position', entityId: id, before: position, ctx });
    return { success: true };
  }
}
