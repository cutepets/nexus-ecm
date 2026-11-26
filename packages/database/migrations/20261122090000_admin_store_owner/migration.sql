-- Replace the hidden SUPER_ADMIN identity with the visible, employee-linked
-- store owner role. Existing permissions and account assignments are retained.
INSERT INTO "roles" ("id", "name", "description", "isSystem")
SELECT 'role_admin', 'ADMIN', 'Chủ cửa hàng', true
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'ADMIN');

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT admin."id", rp."permissionId"
FROM "roles" AS old_role
JOIN "role_permissions" AS rp ON rp."roleId" = old_role."id"
JOIN "roles" AS admin ON admin."name" = 'ADMIN'
WHERE old_role."name" = 'SUPER_ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "user_roles" ("userId", "roleId")
SELECT ur."userId", admin."id"
FROM "user_roles" AS ur
JOIN "roles" AS old_role ON old_role."id" = ur."roleId"
JOIN "roles" AS admin ON admin."name" = 'ADMIN'
WHERE old_role."name" = 'SUPER_ADMIN'
ON CONFLICT ("userId", "roleId") DO NOTHING;

DELETE FROM "user_roles"
WHERE "roleId" IN (SELECT "id" FROM "roles" WHERE "name" = 'SUPER_ADMIN');
DELETE FROM "roles" WHERE "name" = 'SUPER_ADMIN';

-- Make the seeded store owner visible in the employee directory. The
-- application seed also upserts this row and supplies the configured number.
INSERT INTO "employees" ("id", "userId", "employeeNo", "fullName", "email", "workStatus", "joinDate", "updatedAt")
SELECT 'employee_admin', u."id", 'ADMIN-001', 'Chủ cửa hàng', u."email", 'PERMANENT'::"WorkStatus", CURRENT_DATE, CURRENT_TIMESTAMP
FROM "users" AS u
WHERE u."username" = 'admin'
  AND NOT EXISTS (SELECT 1 FROM "employees" e WHERE e."userId" = u."id");
