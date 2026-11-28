ALTER TABLE "roles" ADD COLUMN "code" TEXT;

UPDATE "roles"
SET "code" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'));

UPDATE "roles"
SET "name" = CASE "code"
  WHEN 'admin' THEN 'Quản trị viên'
  WHEN 'hr' THEN 'Nhân sự'
  WHEN 'manager' THEN 'Quản lý'
  WHEN 'employee' THEN 'Nhân viên'
  ELSE "name"
END,
"isSystem" = ("code" = 'admin');

ALTER TABLE "roles" ALTER COLUMN "code" SET NOT NULL;
DROP INDEX "roles_name_key";
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");
