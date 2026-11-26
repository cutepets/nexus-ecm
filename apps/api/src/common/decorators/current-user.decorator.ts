import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  employeeId?: string | null;
}

/** True when the user may manage others' data (not a self-service-only employee). */
export function isPrivileged(user: RequestUser, managePermission: string): boolean {
  return user.roles.includes('ADMIN') || user.permissions.includes(managePermission);
}

/** Injects the authenticated user (set by JwtStrategy) into a handler param. */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    return data ? user?.[data] : user;
  },
);
