-- Preserve the exact number of minutes an employee leaves before the configured shift end,
-- after applying the shift grace period. This is informative and does not create a fine.
ALTER TABLE "timesheet_entries"
ADD COLUMN "early_leave_minutes" INTEGER NOT NULL DEFAULT 0;
