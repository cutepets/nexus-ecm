import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nexus/database';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { AuditService, AuditContext } from '../../core/audit/audit.service';
import { ProjectsService } from './projects.service';
import {
  AddAttachmentDto,
  ChecklistItemDto,
  CommentDto,
  CreateTaskDto,
  MoveTaskDto,
  TaskQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';

const DETAIL_INCLUDE = {
  assignees: { include: { employee: { select: { id: true, fullName: true } } } },
  checklist: { orderBy: { orderIndex: 'asc' as const } },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, fullName: true } } },
  },
  attachments: { orderBy: { uploadedAt: 'desc' as const } },
  project: { select: { id: true, name: true, code: true } },
};

const LIST_INCLUDE = {
  assignees: { include: { employee: { select: { id: true, fullName: true } } } },
  project: { select: { id: true, name: true, code: true } },
  _count: { select: { checklist: true, comments: true } },
};

interface EmployeeReadScope {
  scope: 'ALL' | 'BRANCH' | 'SELF' | 'NONE';
  employeeId?: string | null;
  branchIds: string[];
  from: Date;
  to: Date;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly projects: ProjectsService,
  ) {}

  list(query: TaskQueryDto, access?: EmployeeReadScope) {
    const where: Prisma.TaskWhereInput = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assigneeId ? { assignees: { some: { employeeId: query.assigneeId } } } : {}),
    };
    const scopeWhere = this.taskReadScopeWhere(access);
    if (scopeWhere) where.AND = [scopeWhere];
    return this.prisma.task.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: [{ status: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: string, access?: EmployeeReadScope) {
    const scopeWhere = this.taskReadScopeWhere(access);
    const task = await this.prisma.task.findFirst({ where: { id, ...(scopeWhere ? { AND: [scopeWhere] } : {}) }, include: DETAIL_INCLUDE });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private taskReadScopeWhere(access?: EmployeeReadScope): Prisma.TaskWhereInput | null {
    if (!access || access.scope === 'ALL') return null;
    if (access.scope === 'SELF') return { assignees: { some: { employeeId: access.employeeId ?? '__none__' } } };
    if (access.scope === 'NONE' || !access.branchIds.length) return { id: '__none__' };
    return {
      assignees: {
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

  async create(dto: CreateTaskDto, ctx: AuditContext) {
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        projectId: dto.projectId,
        milestoneId: dto.milestoneId,
        priority: dto.priority ?? 'MEDIUM',
        status: dto.status ?? 'TODO',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assignees: dto.assigneeIds?.length
          ? { create: dto.assigneeIds.map((employeeId) => ({ employeeId })) }
          : undefined,
      },
      include: LIST_INCLUDE,
    });
    if (task.projectId) await this.projects.recalcProgress(task.projectId);
    await this.audit.record({ action: 'CREATE', entity: 'Task', entityId: task.id, after: task, ctx });
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, ctx: AuditContext) {
    const before = await this.prisma.task.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Task not found');

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        projectId: dto.projectId,
        milestoneId: dto.milestoneId,
        priority: dto.priority,
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        // Replace assignees when provided.
        assignees: dto.assigneeIds
          ? { deleteMany: {}, create: dto.assigneeIds.map((employeeId) => ({ employeeId })) }
          : undefined,
      },
      include: LIST_INCLUDE,
    });
    if (task.projectId) await this.projects.recalcProgress(task.projectId);
    await this.audit.record({ action: 'UPDATE', entity: 'Task', entityId: id, before, after: task, ctx });
    return task;
  }

  /** Kanban move: change status (and order within the column). */
  async move(id: string, dto: MoveTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: dto.status, orderIndex: dto.orderIndex ?? 0 },
      include: LIST_INCLUDE,
    });
    if (updated.projectId) await this.projects.recalcProgress(updated.projectId);
    return updated;
  }

  async remove(id: string, ctx: AuditContext) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    await this.prisma.task.delete({ where: { id } });
    if (task.projectId) await this.projects.recalcProgress(task.projectId);
    await this.audit.record({ action: 'DELETE', entity: 'Task', entityId: id, before: task, ctx });
    return { success: true };
  }

  // ---- Checklist ----

  async addChecklistItem(taskId: string, dto: ChecklistItemDto) {
    await this.ensureTask(taskId);
    const count = await this.prisma.checklistItem.count({ where: { taskId } });
    return this.prisma.checklistItem.create({
      data: { taskId, label: dto.label, orderIndex: count },
    });
  }

  async toggleChecklistItem(id: string) {
    const item = await this.prisma.checklistItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Checklist item not found');
    return this.prisma.checklistItem.update({ where: { id }, data: { done: !item.done } });
  }

  async removeChecklistItem(id: string) {
    await this.prisma.checklistItem.delete({ where: { id } });
    return { success: true };
  }

  // ---- Comments ----

  async addComment(taskId: string, dto: CommentDto, actorUserId: string) {
    await this.ensureTask(taskId);
    const authorId = (await this.resolveActorEmployeeId(actorUserId)) ?? dto.authorId;
    if (!authorId) throw new BadRequestException('No employee linked to the current user; provide authorId');
    return this.prisma.taskComment.create({
      data: { taskId, authorId, body: dto.body },
      include: { author: { select: { id: true, fullName: true } } },
    });
  }

  async removeComment(id: string) {
    await this.prisma.taskComment.delete({ where: { id } });
    return { success: true };
  }

  // ---- Attachments ----

  async presignAttachment(taskId: string, fileName: string) {
    await this.ensureTask(taskId);
    const key = this.storage.buildKey(`tasks/${taskId}/attachments`, fileName);
    return this.storage.presignedUpload(key);
  }

  async addAttachment(taskId: string, dto: AddAttachmentDto) {
    await this.ensureTask(taskId);
    const att = await this.prisma.taskAttachment.create({
      data: { taskId, fileUrl: dto.fileUrl, fileName: dto.fileName },
    });
    return { ...att, fileUrl: await this.storage.presignedDownload(att.fileUrl) };
  }

  async removeAttachment(id: string) {
    const att = await this.prisma.taskAttachment.findUnique({ where: { id } });
    if (!att) throw new NotFoundException('Attachment not found');
    await this.storage.remove(att.fileUrl);
    await this.prisma.taskAttachment.delete({ where: { id } });
    return { success: true };
  }

  // ---- helpers ----

  private async ensureTask(id: string) {
    const exists = await this.prisma.task.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Task not found');
  }

  private async resolveActorEmployeeId(userId: string): Promise<string | undefined> {
    const employee = await this.prisma.employee.findFirst({ where: { userId }, select: { id: true } });
    return employee?.id;
  }
}
