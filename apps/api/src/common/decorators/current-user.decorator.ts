import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  permissionScopes?: Record<string, 'ALL' | 'BRANCH' | 'SELF'>;
  branchAssignments?: { branchId: string; effectiveFrom: Date; effectiveTo: Date | null }[];
  employeeId?: string | null;
}

/** True when the user may manage others' data (not a self-service-only employee). */
export function isPrivileged(user: RequestUser, managePermission: string): boolean {
  if (user.roles.includes('ADMIN')) return true;
  const scope = user.permissionScopes?.[managePermission];
  if (scope) return scope === 'ALL';
  return user.permissions.includes(managePermission);
}

export function permissionScope(user: RequestUser, permission: string): 'ALL' | 'BRANCH' | 'SELF' | 'NONE' {
  if (user.roles.includes('ADMIN')) return 'ALL';
  return user.permissionScopes?.[permission] ?? (user.permissions.includes(permission) ? 'ALL' : 'NONE');
}

export function branchIdsForPeriod(user: RequestUser, from: Date, to: Date): string[] {
  return [...new Set((user.branchAssignments ?? [])
    .filter((item) => item.effectiveFrom <= to && (!item.effectiveTo || item.effectiveTo >= from))
    .map((item) => item.branchId))];
}

/** Injects the authenticated user (set by JwtStrategy) into a handler param. */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    return data ? user?.[data] : user;
  },
);
