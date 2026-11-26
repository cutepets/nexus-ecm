-- Day-level roster is authoritative for attendance; recurring assignments only seed it.
CREATE TYPE "WorkRosterStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED');
CREATE TYPE "DailyScheduleSource" AS ENUM ('GENERATED', 'MANAGER_EDITED', 'SHIFT_CHANGE_APPROVED');

ALTER TABLE "work_schedules"
  DROP COLUMN "graceMinutes",
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "work_schedules_displayOrder_idx" ON "work_schedules"("displayOrder");

CREATE TABLE "work_roster_months" (
  "id" TEXT NOT NULL,
  "monthStart" DATE NOT NULL,
  "status" "WorkRosterStatus" NOT NULL DEFAULT 'DRAFT',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "lockedAt" TIMESTAMP(3),
  "lockedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_roster_months_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "work_roster_months_monthStart_key" ON "work_roster_months"("monthStart");

CREATE TABLE "employee_daily_schedules" (
  "id" TEXT NOT NULL,
  "rosterMonthId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "workScheduleId" TEXT NOT NULL,
  "scheduleName" TEXT NOT NULL,
  "source" "DailyScheduleSource" NOT NULL DEFAULT 'GENERATED',
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_daily_schedules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employee_daily_schedules_employeeId_workDate_key" ON "employee_daily_schedules"("employeeId", "workDate");
CREATE INDEX "employee_daily_schedules_rosterMonthId_workDate_idx" ON "employee_daily_schedules"("rosterMonthId", "workDate");

CREATE TABLE "employee_daily_schedule_segments" (
  "id" TEXT NOT NULL,
  "dailyScheduleId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  CONSTRAINT "employee_daily_schedule_segments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employee_daily_schedule_segments_dailyScheduleId_sequence_key" ON "employee_daily_schedule_segments"("dailyScheduleId", "sequence");
CREATE INDEX "employee_daily_schedule_segments_branchId_idx" ON "employee_daily_schedule_segments"("branchId");

ALTER TABLE "employee_daily_schedules" ADD CONSTRAINT "employee_daily_schedules_rosterMonthId_fkey" FOREIGN KEY ("rosterMonthId") REFERENCES "work_roster_months"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_daily_schedules" ADD CONSTRAINT "employee_daily_schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_daily_schedules" ADD CONSTRAINT "employee_daily_schedules_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_daily_schedule_segments" ADD CONSTRAINT "employee_daily_schedule_segments_dailyScheduleId_fkey" FOREIGN KEY ("dailyScheduleId") REFERENCES "employee_daily_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_daily_schedule_segments" ADD CONSTRAINT "employee_daily_schedule_segments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
