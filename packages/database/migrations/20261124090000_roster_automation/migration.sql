-- Make the calendar automation configurable and retain an auditably locked
-- state for each work day, without blocking future days in the same month.
ALTER TABLE "company_settings"
  ADD COLUMN "rosterAutoGenerateEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "rosterGenerationDay" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "rosterAutoLockEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "employee_daily_schedules"
  ADD COLUMN "lockedAt" TIMESTAMP(3);

CREATE INDEX "employee_daily_schedules_lockedAt_idx"
  ON "employee_daily_schedules"("lockedAt");
