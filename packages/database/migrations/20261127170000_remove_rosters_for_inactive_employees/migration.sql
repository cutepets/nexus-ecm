WITH local_today AS (
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS work_date
)
DELETE FROM "employee_daily_schedules" AS schedule
USING "employees" AS employee, local_today
WHERE schedule."employeeId" = employee."id"
  AND employee."workStatus" = 'INACTIVE'
  AND schedule."workDate" >= local_today.work_date;

WITH local_today AS (
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS work_date
)
DELETE FROM "employee_schedule_overrides" AS schedule_override
USING "employees" AS employee, local_today
WHERE schedule_override."employeeId" = employee."id"
  AND employee."workStatus" = 'INACTIVE'
  AND schedule_override."workDate" >= local_today.work_date;

WITH local_today AS (
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS work_date
)
DELETE FROM "employee_work_schedule_assignments" AS assignment
USING "employees" AS employee, local_today
WHERE assignment."employeeId" = employee."id"
  AND employee."workStatus" = 'INACTIVE'
  AND assignment."effectiveFrom" >= local_today.work_date;

WITH local_today AS (
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS work_date
)
UPDATE "employee_work_schedule_assignments" AS assignment
SET "effectiveTo" = local_today.work_date - 1
FROM "employees" AS employee, local_today
WHERE assignment."employeeId" = employee."id"
  AND employee."workStatus" = 'INACTIVE'
  AND assignment."effectiveFrom" < local_today.work_date
  AND (assignment."effectiveTo" IS NULL OR assignment."effectiveTo" >= local_today.work_date);
