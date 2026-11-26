WITH modules(module) AS (
  VALUES
    ('dashboard'), ('employee'), ('attendance'), ('leave'), ('project'),
    ('task'), ('document'), ('chat'), ('notification'), ('audit'),
    ('report'), ('rbac'), ('user'), ('settings'), ('attendance-policy'),
    ('branch'), ('attendance-correction'), ('payroll'), ('integration')
), actions(action) AS (
  VALUES ('create'), ('read'), ('update'), ('delete')
), catalog(key, module) AS (
  SELECT modules.module || ':' || actions.action, modules.module
  FROM modules CROSS JOIN actions
  UNION ALL SELECT 'leave:approve', 'leave'
  UNION ALL SELECT 'attendance:face:enroll', 'attendance'
  UNION ALL SELECT 'attendance:review', 'attendance'
  UNION ALL SELECT 'attendance:correction:approve', 'attendance'
  UNION ALL SELECT 'report:export', 'report'
  UNION ALL SELECT 'user:reset-password', 'user'
  UNION ALL SELECT 'user:manage-roles', 'user'
)
INSERT INTO "permissions" ("id", "key", "module")
SELECT 'perm_' || md5(catalog.key), catalog.key, catalog.module
FROM catalog
ON CONFLICT ("key") DO UPDATE SET "module" = EXCLUDED."module";

WITH modules(module) AS (
  VALUES
    ('dashboard'), ('employee'), ('attendance'), ('leave'), ('project'),
    ('task'), ('document'), ('chat'), ('notification'), ('audit'),
    ('report'), ('rbac'), ('user'), ('settings'), ('attendance-policy'),
    ('branch'), ('attendance-correction'), ('payroll'), ('integration')
), actions(action) AS (
  VALUES ('create'), ('read'), ('update'), ('delete')
), catalog(key) AS (
  SELECT modules.module || ':' || actions.action
  FROM modules CROSS JOIN actions
  UNION ALL SELECT 'leave:approve'
  UNION ALL SELECT 'attendance:face:enroll'
  UNION ALL SELECT 'attendance:review'
  UNION ALL SELECT 'attendance:correction:approve'
  UNION ALL SELECT 'report:export'
  UNION ALL SELECT 'user:reset-password'
  UNION ALL SELECT 'user:manage-roles'
)
DELETE FROM "permissions"
WHERE "key" NOT IN (SELECT key FROM catalog);

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT roles."id", permissions."id"
FROM "roles" AS roles
JOIN "permissions" AS permissions ON permissions."key" IN ('user:reset-password', 'attendance:face:enroll')
WHERE roles."name" = 'HR'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT roles."id", permissions."id"
FROM "roles" AS roles
JOIN "permissions" AS permissions ON permissions."key" IN ('user:reset-password', 'attendance:face:enroll')
WHERE roles."name" = 'MANAGER'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
