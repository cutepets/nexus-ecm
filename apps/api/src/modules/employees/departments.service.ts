import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.department.findMany({
      include: { _count: { select: { employees: true, positions: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateDepartmentDto, ctx: AuditContext) {
    const exists = await this.prisma.department.findUnique({ where: { code: dto.code } });
    if (exists) throw new BadRequestException('Department code already exists');

    const dept = await this.prisma.department.create({ data: dto });
    await this.audit.record({ action: 'CREATE', entity: 'Department', entityId: dept.id, after: dept, ctx });
    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto, ctx: AuditContext) {
    const before = await this.prisma.department.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Department not found');

    if (dto.code && dto.code !== before.code) {
      const clash = await this.prisma.department.findUnique({ where: { code: dto.code } });
      if (clash) throw new BadRequestException('Department code already exists');
    }

    const dept = await this.prisma.department.update({ where: { id }, data: dto });
    await this.audit.record({ action: 'UPDATE', entity: 'Department', entityId: id, before, after: dept, ctx });
    return dept;
  }

  async remove(id: string, ctx: AuditContext) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true, positions: true } } },
    });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept._count.employees > 0 || dept._count.positions > 0) {
      throw new BadRequestException('Cannot delete a department that still has positions or employees');
    }

    await this.prisma.department.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'Department', entityId: id, before: dept, ctx });
    return { success: true };
  }
}
