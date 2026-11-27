UPDATE "employees" SET "workStatus" = 'PERMANENT' WHERE "workStatus" = 'CONTRACT';
ALTER TABLE "employees" ALTER COLUMN "workStatus" DROP DEFAULT;
ALTER TYPE "WorkStatus" RENAME TO "WorkStatus_old";
CREATE TYPE "WorkStatus" AS ENUM ('PROBATION', 'PERMANENT', 'ON_LEAVE', 'INACTIVE');
ALTER TABLE "employees" ALTER COLUMN "workStatus" TYPE "WorkStatus" USING ("workStatus"::text::"WorkStatus");
ALTER TABLE "employees" ALTER COLUMN "workStatus" SET DEFAULT 'PROBATION'::"WorkStatus";
DROP TYPE "WorkStatus_old";