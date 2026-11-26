ALTER TYPE "AttendanceExceptionType" ADD VALUE IF NOT EXISTS 'MISSED_PUNCH';
ALTER TYPE "AttendanceExceptionType" ADD VALUE IF NOT EXISTS 'LATE_ARRIVAL';

ALTER TABLE "attendances"
  ADD COLUMN "approvalUpdate" JSONB,
  ADD COLUMN "approvalEvidencePhotoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "latePenaltyWaived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "attendance_correction_requests"
  ADD COLUMN "evidencePhotoUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
