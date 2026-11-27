import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@nexus/database';
import { AuditContext, AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { normalizeLoginIdentifier, normalizeVietnamesePhone } from '../../common/utils/login-identifier';
import {
  CreateUserAccountDto,
  UpdateUserAccountDto,
  UserAccountQueryDto,
} from './dto/user-account.dto';

const userWithRoles = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  employee: { select: { id: true, branchAssignments: { select: { branchId: true, effectiveFrom: true, effectiveTo: true } } } },
} as const;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userWithRoles }>;

const ACCOUNT_INCLUDE = {
  roles: { include: { role: { select: { id: true, name: true, description: true } } } },
  employee: { select: { id: true, employeeNo: true, fullName: true } },
} satisfies Prisma.UserInclude;

type AccountUser = Prisma.UserGetPayload<{ include: typeof ACCOUNT_INCLUDE }>;

export interface ResolvedUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  avatarPortraitUrl?: string | null;
  avatarCropUrl?: string | null;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
  permissionScopes: Record<string, 'ALL' | 'BRANCH' | 'SELF'>;
  branchAssignments: { branchId: string; effectiveFrom: Date; effectiveTo: Date | null }[];
  employeeId: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true, employeeNo: true, photoUrl: true, address: true, gender: true, dateOfBirth: true,
            emergencyContactName: true, emergencyContactPhone: true,
            salaryBankName: true, salaryBankAccount: true,
            department: { select: { name: true } }, position: { select: { title: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const portraitKey = user.avatarPortraitUrl ?? user.avatarUrl ?? user.employee?.photoUrl ?? null;
    const originalKey = user.avatarUrl ?? user.employee?.photoUrl ?? null;
    return {
      id: user.id, username: user.username, fullName: user.fullName, email: user.email, phone: user.phone,
      avatarUrl: portraitKey ? await this.storage.presignedDownload(portraitKey) : null,
      avatarOriginalUrl: originalKey ? await this.storage.presignedDownload(originalKey) : null,
      avatarCropUrl: user.avatarCropUrl ? await this.storage.presignedDownload(user.avatarCropUrl) : null,
      employee: user.employee ? {
        ...user.employee,
        photoUrl: user.employee.photoUrl ? await this.storage.presignedDownload(user.employee.photoUrl) : null,
      } : null,
    };
  }

  async presignMyAvatar(userId: string, fileName: string) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'avatar.jpg';
    const key = this.storage.buildKey(`avatars/${userId}`, safeName);
    return this.storage.presignedUpload(key);
  }

  async updateMyProfile(userId: string, dto: { fullName?: string; email?: string; phone?: string; avatarKey?: string; avatarPortraitKey?: string; avatarCropKey?: string; salaryBankName?: string; salaryBankAccount?: string }, ctx: AuditContext) {
    const before = await this.requireAccount(userId);
    const identity = this.normalizeAccountInput(dto);
    await this.assertIdentifiersAvailable(identity, userId);
    if (dto.avatarKey && !dto.avatarKey.startsWith(`avatars/${userId}/`)) {
      throw new BadRequestException('Invalid avatar upload');
    }
    if (dto.avatarCropKey && !dto.avatarCropKey.startsWith(`avatars/${userId}/`)) {
      throw new BadRequestException('Invalid avatar crop upload');
    }
    if (dto.avatarPortraitKey && !dto.avatarPortraitKey.startsWith(`avatars/${userId}/`)) {
      throw new BadRequestException('Invalid portrait upload');
    }
    if ((dto.salaryBankName !== undefined || dto.salaryBankAccount !== undefined) && !before.employee) {
      throw new BadRequestException('Only employee accounts can update payroll bank details');
    }
    const payroll = {
      ...(dto.salaryBankName !== undefined ? { salaryBankName: dto.salaryBankName.trim() || null } : {}),
      ...(dto.salaryBankAccount !== undefined ? { salaryBankAccount: dto.salaryBankAccount.trim() || null } : {}),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...identity,
          ...(dto.avatarKey ? { avatarUrl: dto.avatarKey } : {}),
          ...(dto.avatarPortraitKey ? { avatarPortraitUrl: dto.avatarPortraitKey } : {}),
          ...(dto.avatarCropKey ? { avatarCropUrl: dto.avatarCropKey } : {}),
        },
      });
      // Keep the employee directory in sync with the account identity.
      if (before.employee) {
        await tx.employee.update({
          where: { id: before.employee.id },
          data: {
            ...(identity.fullName ? { fullName: identity.fullName } : {}),
            ...(identity.email ? { email: identity.email } : {}),
            ...(identity.phone !== undefined ? { phone: identity.phone } : {}),
            ...(dto.avatarPortraitKey ? { photoUrl: dto.avatarPortraitKey } : dto.avatarKey ? { photoUrl: dto.avatarKey } : {}),
            ...payroll,
          },
        });
      }
    });
    await this.audit.record({ action: 'UPDATE', entity: 'User', entityId: userId, before: this.auditSnapshot(before), after: { selfProfileUpdated: true }, ctx });
    return this.getMyProfile(userId);
  }

  async changeMyPassword(userId: string, currentPassword: string, newPassword: string, ctx: AuditContext) {
    const user = await this.findById(userId);
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (await argon2.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException('New password must be different from current password');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }), mustChangePassword: false } });
    const sessionsRevoked = await this.revokeActiveSessions(userId);
    await this.audit.record({ action: 'UPDATE', entity: 'User', entityId: userId, after: { passwordChanged: true, sessionsRevoked }, ctx });
    return { success: true, sessionsRevoked };
  }

  async findByLoginIdentifier(identifier: string): Promise<ResolvedUser | null> {
    const normalized = normalizeLoginIdentifier(identifier);
    if (normalized.kind === 'phone') {
      // A numeric username can resemble a phone number. Refuse an ambiguous
      // identifier rather than allowing it to select an arbitrary account.
      const [phoneUser, numericUsernameUser] = await Promise.all([
        this.prisma.user.findUnique({ where: { phone: normalized.value }, include: userWithRoles }),
        this.prisma.user.findUnique({ where: { username: identifier.trim().toLowerCase() }, include: userWithRoles }),
      ]);
      if (phoneUser && numericUsernameUser && phoneUser.id !== numericUsernameUser.id) return null;
      const user = phoneUser ?? numericUsernameUser;
      return user ? this.resolve(user) : null;
    }

    const user =
      normalized.kind === 'email'
        ? await this.prisma.user.findFirst({
            where: { email: { equals: normalized.value, mode: 'insensitive' } },
            include: userWithRoles,
          })
        : await this.prisma.user.findUnique({ where: { username: normalized.value }, include: userWithRoles });
    return user ? this.resolve(user) : null;
  }

  async findById(id: string): Promise<ResolvedUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: userWithRoles,
    });
    return user ? this.resolve(user) : null;
  }

  async listAccounts(query: UserAccountQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.roleId ? { roles: { some: { roleId: query.roleId } } } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { fullName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: ACCOUNT_INCLUDE,
        orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map((item) => this.toAccount(item)), total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getAccount(id: string) {
    return this.toAccount(await this.requireAccount(id));
  }

  async verifyActorPassword(actorId: string, currentPassword: string) {
    const actor = await this.findById(actorId);
    if (!actor || !actor.isActive || !(await argon2.verify(actor.passwordHash, currentPassword))) {
      throw new BadRequestException('Current password is incorrect');
    }
  }

  listRoleOptions() {
    return this.prisma.role.findMany({
      select: { id: true, name: true, description: true, isSystem: true },
      orderBy: { name: 'asc' },
    });
  }

  async createAccount(dto: CreateUserAccountDto, ctx: AuditContext) {
    const data = this.normalizeAccountInput(dto);
    const { username, email, fullName, phone } = data;
    if (!username || !email || !fullName) throw new BadRequestException('Account identity is required');
    await this.assertIdentifiersAvailable(data);
    const roles = await this.requireRoles(dto.roleIds);
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        fullName,
        phone,
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        mustChangePassword: dto.password === '123456',
        roles: { create: roles.map((role) => ({ roleId: role.id })) },
      },
      include: ACCOUNT_INCLUDE,
    });
    await this.audit.record({ action: 'CREATE', entity: 'User', entityId: user.id, after: this.auditSnapshot(user), ctx });
    return this.toAccount(user);
  }

  async updateAccount(id: string, dto: UpdateUserAccountDto, ctx: AuditContext) {
    const before = await this.requireAccount(id);
    const data = this.normalizeAccountInput(dto);
    await this.assertIdentifiersAvailable(data, id);
    const user = await this.prisma.user.update({ where: { id }, data, include: ACCOUNT_INCLUDE });
    if (data.username || data.email || data.phone !== undefined) await this.revokeActiveSessions(id);
    await this.audit.record({ action: 'UPDATE', entity: 'User', entityId: id, before: this.auditSnapshot(before), after: this.auditSnapshot(user), ctx });
    return this.toAccount(user);
  }

  async setAccountStatus(id: string, isActive: boolean, ctx: AuditContext) {
    const before = await this.requireAccount(id);
    if (!isActive && ctx.actorId === id) throw new BadRequestException('You cannot deactivate your own account');
    if (!isActive) await this.ensureSuperAdminRemains(before);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive }, include: ACCOUNT_INCLUDE });
    await this.revokeActiveSessions(id);
    await this.audit.record({ action: 'UPDATE', entity: 'User', entityId: id, before: this.auditSnapshot(before), after: this.auditSnapshot(user), ctx });
    return this.toAccount(user);
  }

  async resetPassword(id: string, password: string, ctx: AuditContext) {
    const before = await this.requireAccount(id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }), mustChangePassword: true },
    });
    const revoked = await this.revokeActiveSessions(id);
    await this.audit.record({ action: 'UPDATE', entity: 'User', entityId: id, before: this.auditSnapshot(before), after: { passwordReset: true, sessionsRevoked: revoked }, ctx });
    return { success: true, sessionsRevoked: revoked };
  }

  async setAccountRoles(id: string, roleIds: string[], ctx: AuditContext) {
    const before = await this.requireAccount(id);
    const roles = await this.requireRoles(roleIds);
    const willRemainAdmin = roles.some((role) => role.name === 'ADMIN');
    if (!willRemainAdmin) await this.ensureSuperAdminRemains(before);
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: roles.map((role) => ({ userId: id, roleId: role.id })) });
      return tx.user.findUniqueOrThrow({ where: { id }, include: ACCOUNT_INCLUDE });
    });
    const revoked = await this.revokeActiveSessions(id);
    await this.audit.record({ action: 'UPDATE', entity: 'User', entityId: id, before: this.auditSnapshot(before), after: { ...this.auditSnapshot(user), sessionsRevoked: revoked }, ctx });
    return this.toAccount(user);
  }

  async revokeSessions(id: string, ctx: AuditContext) {
    await this.requireAccount(id);
    const revoked = await this.revokeActiveSessions(id);
    await this.audit.record({ action: 'UPDATE', entity: 'User', entityId: id, after: { sessionsRevoked: revoked }, ctx });
    return { success: true, sessionsRevoked: revoked };
  }

  async linkEmployee(id: string, employeeId: string | null, ctx: AuditContext) {
    const account = await this.requireAccount(id);
    if (!employeeId) throw new BadRequestException('Employee accounts cannot be unlinked');
    if (account.employee) throw new BadRequestException('Account is already linked to an employee');
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.userId && employee.userId !== id) throw new BadRequestException('Employee is already linked to another account');
    await this.prisma.employee.update({ where: { id: employeeId }, data: { userId: id } });
    const updated = await this.requireAccount(id);
    await this.audit.record({ action: 'UPDATE', entity: 'User', entityId: id, before: this.auditSnapshot(account), after: { ...this.auditSnapshot(updated), employeeId: employee.id }, ctx });
    return this.toAccount(updated);
  }

  async softDeleteAccount(id: string, ctx: AuditContext) {
    const account = await this.requireAccount(id);
    if (account.employee) throw new BadRequestException('Unlink or terminate the employee before deleting this account');
    if (ctx.actorId === id) throw new BadRequestException('You cannot delete your own account');
    await this.ensureSuperAdminRemains(account);
    await this.prisma.user.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    const revoked = await this.revokeActiveSessions(id);
    await this.audit.record({ action: 'DELETE', entity: 'User', entityId: id, before: this.auditSnapshot(account), after: { softDeleted: true, sessionsRevoked: revoked }, ctx });
    return { success: true };
  }

  /** Flattens nested role/permission relations into string arrays. */
  private async resolve(user: UserWithRoles): Promise<ResolvedUser> {
    const roles = user.roles.map((ur) => ur.role.name);
    const scopeRank = { SELF: 1, BRANCH: 2, ALL: 3 } as const;
    const scopeMap = user.roles.flatMap((ur) => ur.role.permissions.map((rp) => [rp.permission.key, rp.scope] as const))
      .reduce((merged, [key, scope]) => {
        const current = merged.get(key);
        if (!current || scopeRank[scope] > scopeRank[current]) merged.set(key, scope);
        return merged;
      }, new Map<string, 'ALL' | 'BRANCH' | 'SELF'>());
    if (roles.includes('ADMIN')) {
      const catalog = await this.prisma.permission.findMany({ select: { key: true } });
      catalog.forEach(({ key }) => scopeMap.set(key, 'ALL'));
    }
    const permissionScopes = Object.fromEntries(
      scopeMap,
    );
    const permissions = Object.keys(permissionScopes);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      avatarPortraitUrl: user.avatarPortraitUrl,
      avatarCropUrl: user.avatarCropUrl,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      roles,
      permissions,
      permissionScopes,
      branchAssignments: user.employee?.branchAssignments ?? [],
      employeeId: user.employee?.id ?? null,
    };
  }

  private async requireAccount(id: string): Promise<AccountUser> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, include: ACCOUNT_INCLUDE });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private normalizeAccountInput(dto: Pick<CreateUserAccountDto, 'username' | 'email' | 'phone' | 'fullName'> | UpdateUserAccountDto) {
    const data: { username?: string; email?: string; phone?: string | null; fullName?: string } = {};
    if (dto.username !== undefined) data.username = dto.username.trim().toLowerCase();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) {
      const phone = dto.phone.trim();
      if (!phone) data.phone = null;
      else {
        const normalized = normalizeVietnamesePhone(phone);
        if (!normalized) throw new BadRequestException('Invalid Vietnamese phone number');
        data.phone = normalized;
      }
    }
    return data;
  }

  private async assertIdentifiersAvailable(
    data: { username?: string; email?: string; phone?: string | null },
    excludedId?: string,
  ) {
    const [username, email, phone] = await Promise.all([
      data.username
        ? this.prisma.user.findFirst({ where: { username: data.username, id: { not: excludedId } }, select: { id: true } })
        : null,
      data.email
        ? this.prisma.user.findFirst({ where: { email: { equals: data.email, mode: 'insensitive' }, id: { not: excludedId } }, select: { id: true } })
        : null,
      data.phone
        ? this.prisma.user.findFirst({ where: { phone: data.phone, id: { not: excludedId } }, select: { id: true } })
        : null,
    ]);
    if (username) throw new BadRequestException('Username already used by another account');
    if (email) throw new BadRequestException('Email already used by another account');
    if (phone) throw new BadRequestException('Phone already used by another account');
  }

  private async requireRoles(roleIds: string[]) {
    const uniqueRoleIds = [...new Set(roleIds)];
    const roles = await this.prisma.role.findMany({ where: { id: { in: uniqueRoleIds } }, select: { id: true, name: true } });
    if (roles.length !== uniqueRoleIds.length) throw new BadRequestException('One or more roles were not found');
    return roles;
  }

  private async ensureSuperAdminRemains(account: AccountUser) {
    if (!account.isActive || !account.roles.some(({ role }) => role.name === 'ADMIN')) return;
    const activeAdmins = await this.prisma.user.count({
      where: { deletedAt: null, isActive: true, roles: { some: { role: { name: 'ADMIN' } } } },
    });
    if (activeAdmins <= 1) throw new BadRequestException('The last active store admin cannot be changed');
  }

  private async revokeActiveSessions(userId: string) {
    const { count } = await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return count;
  }

  private toAccount(user: AccountUser) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      employee: user.employee,
      roles: user.roles.map(({ role }) => role),
    };
  }

  private auditSnapshot(user: AccountUser) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      isActive: user.isActive,
      roles: user.roles.map(({ role }) => role.name),
    };
  }
}
