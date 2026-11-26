import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UpdateRoleDto } from './dto/rbac.dto';
import { AuditService } from '../../core/audit/audit.service';
import { RoleAssignmentService } from './role-assignment.service';
import { RoleAssignmentRuleDto } from './dto/rbac.dto';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roleAssignments: RoleAssignmentService,
  ) {}

  listRoles() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] });
  }

  async createRole(name: string, description?: string) {
    const exists = await this.prisma.role.findUnique({ where: { name } });
    if (exists) throw new BadRequestException('Role already exists');
    return this.prisma.role.create({ data: { name, description } });
  }

  async setRolePermissions(roleId: string, permissionKeys: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    const permissions = await this.prisma.permission.findMany({
      where: role.name === 'ADMIN' ? {} : { key: { in: permissionKeys } },
    });
    if (role.name !== 'ADMIN' && permissions.length === await this.prisma.permission.count()) {
      throw new BadRequestException('Only ADMIN may hold the full permission set');
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      }),
    ]);
    return { roleId, count: permissions.length };
  }

  async updateRole(roleId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    const name = dto.name?.trim().toUpperCase();
    if (role.isSystem && name && name !== role.name) {
      throw new BadRequestException('System role code cannot be changed');
    }
    if (name && name !== role.name) {
      const existing = await this.prisma.role.findUnique({ where: { name }, select: { id: true } });
      if (existing) throw new BadRequestException('Role already exists');
    }
    return this.prisma.role.update({
      where: { id: roleId },
      data: { ...(name ? { name } : {}), ...(dto.description !== undefined ? { description: dto.description } : {}) },
    });
  }

  async deleteRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.name === 'ADMIN') throw new BadRequestException('The ADMIN role cannot be deleted');
    await this.prisma.role.delete({ where: { id: roleId } });
    return { success: true };
  }

  listAssignmentRules() {
    return this.prisma.roleAssignmentRule.findMany({
      include: { role: { select: { id: true, name: true } } },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async replaceAssignmentRules(rules: RoleAssignmentRuleDto[], actorId: string) {
    for (const rule of rules) {
      if (!rule.departmentId && !rule.positionId && !rule.branchId) {
        throw new BadRequestException(`Rule "${rule.name}" needs at least one department, position, or branch condition`);
      }
    }
    const roleIds = [...new Set(rules.map((rule) => rule.roleId))];
    const [roles, departments, positions, branches] = await Promise.all([
      this.prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true } }),
      this.prisma.department.findMany({ where: { id: { in: [...new Set(rules.flatMap((rule) => rule.departmentId ? [rule.departmentId] : []))] } }, select: { id: true } }),
      this.prisma.position.findMany({ where: { id: { in: [...new Set(rules.flatMap((rule) => rule.positionId ? [rule.positionId] : []))] } }, select: { id: true } }),
      this.prisma.branch.findMany({ where: { id: { in: [...new Set(rules.flatMap((rule) => rule.branchId ? [rule.branchId] : []))] } }, select: { id: true } }),
    ]);
    if (roles.length !== roleIds.length) throw new BadRequestException('A selected role does not exist');
    if (roles.some((role) => role.name === 'ADMIN')) throw new BadRequestException('ADMIN is assigned explicitly and cannot be assigned by an automatic rule');
    if (departments.length !== new Set(rules.flatMap((rule) => rule.departmentId ? [rule.departmentId] : [])).size ||
        positions.length !== new Set(rules.flatMap((rule) => rule.positionId ? [rule.positionId] : [])).size ||
        branches.length !== new Set(rules.flatMap((rule) => rule.branchId ? [rule.branchId] : [])).size) {
      throw new BadRequestException('A selected department, position, or branch does not exist');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.roleAssignmentRule.deleteMany();
      for (const rule of rules) {
        await tx.roleAssignmentRule.create({
          data: {
            name: rule.name.trim(), roleId: rule.roleId,
            departmentId: rule.departmentId || null,
            positionId: rule.positionId || null,
            branchId: rule.branchId || null,
            isActive: rule.isActive ?? true,
          },
        });
      }
      await this.roleAssignments.syncAll(tx);
    });
    await this.audit.record({ action: 'UPDATE', entity: 'RoleAssignmentRules', after: { count: rules.length }, ctx: { actorId } });
    return this.listAssignmentRules();
  }

  async assignRoleToUser(userId: string, roleId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { employee: { select: { id: true } } } }),
      this.prisma.role.findUnique({ where: { id: roleId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!user.employee) throw new BadRequestException('Roles can only be assigned through an employee account');
    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
    return { userId, roleId };
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
    return { success: true };
  }
}
