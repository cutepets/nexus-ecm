UPDATE "work_roster_months" SET "status" = 'PUBLISHED';

ALTER TABLE "work_roster_months"
  DROP COLUMN "status",
  DROP COLUMN "publishedAt",
  DROP COLUMN "publishedById",
  DROP COLUMN "lockedAt",
  DROP COLUMN "lockedById";

ALTER TABLE "employee_daily_schedules" DROP COLUMN "lockedAt";
ALTER TABLE "company_settings" DROP COLUMN "rosterAutoLockEnabled";

DROP TYPE "WorkRosterStatus";
