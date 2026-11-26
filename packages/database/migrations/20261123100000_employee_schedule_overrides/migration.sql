CREATE TYPE "ScheduleOverrideSource" AS ENUM ('MANAGER_OVERRIDE', 'SHIFT_CHANGE_APPROVED');

CREATE TABLE "employee_schedule_overrides" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "workScheduleId" TEXT NOT NULL,
  "source" "ScheduleOverrideSource" NOT NULL DEFAULT 'MANAGER_OVERRIDE',
  "requestId" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_schedule_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_schedule_overrides_employeeId_workDate_key"
  ON "employee_schedule_overrides"("employeeId", "workDate");
CREATE INDEX "employee_schedule_overrides_workDate_idx"
  ON "employee_schedule_overrides"("workDate");
CREATE INDEX "employee_schedule_overrides_workScheduleId_idx"
  ON "employee_schedule_overrides"("workScheduleId");

ALTER TABLE "employee_schedule_overrides"
  ADD CONSTRAINT "employee_schedule_overrides_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_schedule_overrides"
  ADD CONSTRAINT "employee_schedule_overrides_workScheduleId_fkey"
  FOREIGN KEY ("workScheduleId") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
