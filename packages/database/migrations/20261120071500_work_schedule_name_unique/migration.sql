-- Keep one copy of an identical named schedule, then make repeated seeding idempotent.
DELETE FROM "work_schedules" older
USING "work_schedules" newer
WHERE older.name = newer.name
  AND older.ctid > newer.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS "work_schedules_name_key" ON "work_schedules"("name");
