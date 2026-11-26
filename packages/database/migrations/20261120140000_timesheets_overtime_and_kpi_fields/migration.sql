CREATE TYPE "WorkUnitMode" AS ENUM ('DAILY', 'HOURLY');
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AttendanceOvertimeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "TimesheetPeriodStatus" AS ENUM ('DRAFT', 'REVIEW', 'LOCKED');

ALTER TABLE "company_settings"
  ADD COLUMN "workUnitMode" "WorkUnitMode" NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "timesheetStartDay" INTEGER NOT NULL DEFAULT 26,
  ADD COLUMN "timesheetEndDay" INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN "roundingMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "latePenaltyPerMinute" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "missingPunchPenalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "overtimeTriggerMinutes" INTEGER NOT NULL DEFAULT 15;

CREATE TABLE "attendance_correction_requests" (
  "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "attendanceId" TEXT, "workDate" DATE NOT NULL,
  "proposedCheckIn" TIMESTAMP(3), "proposedCheckOut" TIMESTAMP(3), "reason" TEXT NOT NULL,
  "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING', "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3), "reviewNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attendance_correction_requests_employeeId_workDate_status_idx" ON "attendance_correction_requests"("employeeId", "workDate", "status");
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "attendance_overtime_requests" (
  "id" TEXT NOT NULL, "attendanceId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "requestedMinutes" INTEGER NOT NULL, "reason" TEXT NOT NULL,
  "status" "AttendanceOvertimeStatus" NOT NULL DEFAULT 'PENDING', "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3), "reviewNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_overtime_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_overtime_requests_attendanceId_key" ON "attendance_overtime_requests"("attendanceId");
CREATE INDEX "attendance_overtime_requests_employeeId_status_idx" ON "attendance_overtime_requests"("employeeId", "status");
ALTER TABLE "attendance_overtime_requests" ADD CONSTRAINT "attendance_overtime_requests_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_overtime_requests" ADD CONSTRAINT "attendance_overtime_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "timesheet_periods" (
  "id" TEXT NOT NULL, "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
  "status" "TimesheetPeriodStatus" NOT NULL DEFAULT 'DRAFT', "lockedAt" TIMESTAMP(3), "lockedById" TEXT,
  "reopenedAt" TIMESTAMP(3), "reopenedById" TEXT, "reopenReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timesheet_periods_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "timesheet_periods_startDate_endDate_key" ON "timesheet_periods"("startDate", "endDate");
CREATE INDEX "timesheet_periods_status_startDate_idx" ON "timesheet_periods"("status", "startDate");

CREATE TABLE "timesheet_entries" (
  "id" TEXT NOT NULL, "periodId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "workDate" DATE NOT NULL,
  "attendanceId" TEXT, "scheduledMinutes" INTEGER NOT NULL DEFAULT 0, "workedMinutes" INTEGER NOT NULL DEFAULT 0,
  "roundedWorkMinutes" INTEGER NOT NULL DEFAULT 0, "workUnits" DECIMAL(10,4) NOT NULL DEFAULT 0,
  "lateMinutes" INTEGER NOT NULL DEFAULT 0, "latePenalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "missingPunch" BOOLEAN NOT NULL DEFAULT false, "missingPunchPenalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "overtimeMinutes" INTEGER NOT NULL DEFAULT 0, "overtimeApprovedMinutes" INTEGER NOT NULL DEFAULT 0,
  "sourceSnapshot" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timesheet_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "timesheet_entries_periodId_employeeId_workDate_key" ON "timesheet_entries"("periodId", "employeeId", "workDate");
CREATE INDEX "timesheet_entries_employeeId_workDate_idx" ON "timesheet_entries"("employeeId", "workDate");
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "timesheet_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "integration_kpi_fields" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "label" TEXT NOT NULL, "fieldType" TEXT NOT NULL DEFAULT 'NUMBER',
  "required" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_kpi_fields_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integration_kpi_fields_key_key" ON "integration_kpi_fields"("key");
CREATE INDEX "integration_kpi_fields_isActive_sortOrder_idx" ON "integration_kpi_fields"("isActive", "sortOrder");
