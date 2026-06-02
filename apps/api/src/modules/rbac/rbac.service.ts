import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

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

  async assignRoleToUser(userId: string, roleId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.role.findUnique({ where: { id: roleId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
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
