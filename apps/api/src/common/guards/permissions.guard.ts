import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { RequestUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as RequestUser | undefined;
    if (!user) throw new ForbiddenException('Not authenticated');

    // ADMIN owns the store and bypasses granular checks.
    if (user.roles.includes('ADMIN')) return true;

    const has = required.every((p) => user.permissions.includes(p));
    if (!has) {
      throw new ForbiddenException(`Missing permission: ${required.join(', ')}`);
    }

    // Write endpoints currently use object-level checks in their services only
    // for the scopes they explicitly implement. Keep scoped write grants from
    // silently becoming global writes until those endpoints validate targets.
    const unscopedWrite = required.find((permission) =>
      /:(create|update|delete|export)$/.test(permission) &&
      (user.permissionScopes?.[permission] ?? 'ALL') !== 'ALL',
    );
    if (unscopedWrite) {
      throw new ForbiddenException(`This action requires the All scope: ${unscopedWrite}`);
    }
    return true;
  }
}
