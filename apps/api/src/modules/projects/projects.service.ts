import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { AddMemberDto, CreateProjectDto, UpdateProjectDto, UpsertMilestoneDto } from './dto/project.dto';

const DETAIL_INCLUDE = {
  members: { include: { employee: { select: { id: true, fullName: true, employeeNo: true } } } },
  milestones: { orderBy: { dueDate: 'asc' as const } },
  _count: { select: { tasks: true } },
};

interface EmployeeReadScope {
  scope: 'ALL' | 'BRANCH' | 'SELF' | 'NONE';
  employeeId?: string | null;
  branchIds: string[];
  from: Date;
  to: Date;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(status?: string, access?: EmployeeReadScope) {
    const scopeWhere = this.projectReadScopeWhere(access);
    return this.prisma.project.findMany({
      where: { ...(status ? { status: status as Prisma.ProjectWhereInput['status'] } : {}), ...(scopeWhere ? { AND: [scopeWhere] } : {}) },
      include: { _count: { select: { tasks: true, members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, access?: EmployeeReadScope) {
    const scopeWhere = this.projectReadScopeWhere(access);
    const project = await this.prisma.project.findFirst({ where: { id, ...(scopeWhere ? { AND: [scopeWhere] } : {}) }, include: DETAIL_INCLUDE });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private projectReadScopeWhere(access?: EmployeeReadScope): Prisma.ProjectWhereInput | null {
    if (!access || access.scope === 'ALL') return null;
    if (access.scope === 'SELF') return { OR: [{ managerId: access.employeeId ?? '__none__' }, { members: { some: { employeeId: access.employeeId ?? '__none__' } } }] };
    if (access.scope === 'NONE' || !access.branchIds.length) return { id: '__none__' };
    return {
      members: {
        some: {
          employee: {
            branchAssignments: {
              some: {
                branchId: { in: access.branchIds },
                effectiveFrom: { lte: access.to },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: access.from } }],
              },
            },
          },
        },
      },
    };
  }

  async create(dto: CreateProjectDto, ctx: AuditContext) {
    const exists = await this.prisma.project.findUnique({ where: { code: dto.code } });
    if (exists) throw new BadRequestException('Project code already exists');

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        status: dto.status ?? 'PLANNING',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        budgetPlanned: dto.budgetPlanned ? new Prisma.Decimal(dto.budgetPlanned) : undefined,
        budgetActual: dto.budgetActual ? new Prisma.Decimal(dto.budgetActual) : undefined,
        managerId: dto.managerId,
      },
    });
    await this.audit.record({ action: 'CREATE', entity: 'Project', entityId: project.id, after: project, ctx });
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, ctx: AuditContext) {
    const before = await this.prisma.project.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Project not found');
    if (dto.code && dto.code !== before.code) {
      const clash = await this.prisma.project.findUnique({ where: { code: dto.code } });
      if (clash) throw new BadRequestException('Project code already exists');
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        budgetPlanned: dto.budgetPlanned ? new Prisma.Decimal(dto.budgetPlanned) : undefined,
        budgetActual: dto.budgetActual ? new Prisma.Decimal(dto.budgetActual) : undefined,
        managerId: dto.managerId,
      },
    });
    await this.audit.record({ action: 'UPDATE', entity: 'Project', entityId: id, before, after: project, ctx });
    return project;
  }

  async remove(id: string, ctx: AuditContext) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    await this.prisma.project.delete({ where: { id } });
    await this.audit.record({ action: 'DELETE', entity: 'Project', entityId: id, before: project, ctx });
    return { success: true };
  }

  // ---- Members ----

  async addMember(projectId: string, dto: AddMemberDto) {
    await this.ensureProject(projectId);
    return this.prisma.projectMember.upsert({
      where: { projectId_employeeId: { projectId, employeeId: dto.employeeId } },
      update: { role: dto.role },
      create: { projectId, employeeId: dto.employeeId, role: dto.role },
    });
  }

  async removeMember(projectId: string, employeeId: string) {
    await this.prisma.projectMember.delete({
      where: { projectId_employeeId: { projectId, employeeId } },
    });
    return { success: true };
  }

  // ---- Milestones ----

  async addMilestone(projectId: string, dto: UpsertMilestoneDto) {
    await this.ensureProject(projectId);
    return this.prisma.milestone.create({
      data: {
        projectId,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        completed: dto.completed ?? false,
      },
    });
  }

  async updateMilestone(id: string, dto: UpsertMilestoneDto) {
    const exists = await this.prisma.milestone.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Milestone not found');
    return this.prisma.milestone.update({
      where: { id },
      data: {
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completed: dto.completed,
      },
    });
  }

  async removeMilestone(id: string) {
    await this.prisma.milestone.delete({ where: { id } });
    return { success: true };
  }

  // ---- Progress (called by TasksService) ----

  /** Recalculate project.progress as the share of DONE tasks. */
  async recalcProgress(projectId: string) {
    const [total, done] = await this.prisma.$transaction([
      this.prisma.task.count({ where: { projectId } }),
      this.prisma.task.count({ where: { projectId, status: 'DONE' } }),
    ]);
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    await this.prisma.project.update({ where: { id: projectId }, data: { progress } });
    return progress;
  }

  private async ensureProject(id: string) {
    const exists = await this.prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Project not found');
  }
}
