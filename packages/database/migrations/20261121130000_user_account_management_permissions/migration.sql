-- Account-management actions are intentionally separate from generic update.
-- This keeps password resets and role grants explicitly delegable and auditable.
INSERT INTO "permissions" ("id", "key", "module")
VALUES
  (concat('perm_', md5('user:reset-password')), 'user:reset-password', 'user'),
  (concat('perm_', md5('user:manage-roles')), 'user:manage-roles', 'user')
ON CONFLICT ("key") DO NOTHING;

-- Keep existing SUPER_ADMIN records aligned even in installations that do not
-- run the development seed after applying the migration.
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."name" = 'SUPER_ADMIN'
  AND permission."key" IN ('user:reset-password', 'user:manage-roles')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
