UPDATE "users" AS "user"
SET "fullName" = "employee"."fullName"
FROM "employees" AS "employee"
WHERE "employee"."userId" = "user"."id"
  AND "employee"."deletedAt" IS NULL
  AND "user"."fullName" IS DISTINCT FROM "employee"."fullName";
