/** Permission keys shared between frontend (UI gating) and backend (guards). */
export const PERMISSION_MODULES = [
  'dashboard',
  'employee',
  'attendance',
  'leave',
  'project',
  'task',
  'document',
  'chat',
  'notification',
  'audit',
  'report',
  'rbac',
  'user',
  'settings',
  'attendance-policy',
  'branch',
  'attendance-correction',
  'payroll',
  'integration',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const DEFAULT_ROLES = ['admin'] as const;
export const ROLE_SUGGESTIONS = [
  { code: 'employee', name: 'Nhân viên' },
  { code: 'manager', name: 'Quản lý' },
] as const;
export type DefaultRole = (typeof DEFAULT_ROLES)[number];

/** Helper to build a permission key, e.g. perm('employee', 'create') -> 'employee:create' */
export const perm = (module: PermissionModule, action: string) => `${module}:${action}`;
