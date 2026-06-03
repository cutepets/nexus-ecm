import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

const userWithRoles = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  employee: { select: { id: true } },
} as const;

export interface ResolvedUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  passwordHash: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  employeeId: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<ResolvedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: userWithRoles,
    });
    return user ? this.resolve(user) : null;
  }

  async findById(id: string): Promise<ResolvedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userWithRoles,
    });
    return user ? this.resolve(user) : null;
  }

  /** Flattens nested role/permission relations into string arrays. */
  private resolve(user: any): ResolvedUser {
    const roles = user.roles.map((ur: any) => ur.role.name);
    const permissions = [
      ...new Set<string>(
        user.roles.flatMap((ur: any) =>
          ur.role.permissions.map((rp: any) => rp.permission.key),
        ),
      ),
    ];
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      roles,
      permissions,
      employeeId: user.employee?.id ?? null,
    };
  }
}
