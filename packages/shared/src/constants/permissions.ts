/** Permission keys shared between frontend (UI gating) and backend (guards). */
export const PERMISSION_MODULES = [
  'dashboard',
  'employee',
  'attendance',
  'leave',
  'project',
  'task',
  'finance',
  'inventory',
  'crm',
  'document',
  'chat',
  'notification',
  'audit',
  'report',
  'rbac',
  'user',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const DEFAULT_ROLES = ['SUPER_ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'] as const;
export type DefaultRole = (typeof DEFAULT_ROLES)[number];

/** Helper to build a permission key, e.g. perm('employee', 'create') -> 'employee:create' */
export const perm = (module: PermissionModule, action: string) => `${module}:${action}`;
