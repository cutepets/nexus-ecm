CREATE TYPE "PermissionScope" AS ENUM ('ALL', 'BRANCH', 'SELF');

ALTER TABLE "role_permissions"
ADD COLUMN "scope" "PermissionScope" NOT NULL DEFAULT 'ALL';

ALTER TABLE "role_assignment_rules"
DROP COLUMN "branchId";
