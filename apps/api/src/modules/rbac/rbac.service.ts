import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UpdateRoleDto } from './dto/rbac.dto';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

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
      where: { key: { in: permissionKeys } },
    });

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
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    if (role._count.users > 0) throw new BadRequestException('Remove this role from all employee accounts before deleting it');
    await this.prisma.role.delete({ where: { id: roleId } });
    return { success: true };
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
