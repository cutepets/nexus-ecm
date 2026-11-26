CREATE TABLE "employee_work_schedule_assignments" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "workScheduleId" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "priority" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_work_schedule_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_work_schedule_assignments_employeeId_workScheduleId_effectiveFrom_key"
  ON "employee_work_schedule_assignments"("employeeId", "workScheduleId", "effectiveFrom");
CREATE INDEX "employee_work_schedule_assignments_employeeId_effectiveFrom_effectiveTo_idx"
  ON "employee_work_schedule_assignments"("employeeId", "effectiveFrom", "effectiveTo");
CREATE INDEX "employee_work_schedule_assignments_workScheduleId_idx"
  ON "employee_work_schedule_assignments"("workScheduleId");

ALTER TABLE "employee_work_schedule_assignments"
  ADD CONSTRAINT "employee_work_schedule_assignments_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_work_schedule_assignments"
  ADD CONSTRAINT "employee_work_schedule_assignments_workScheduleId_fkey"
  FOREIGN KEY ("workScheduleId") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
