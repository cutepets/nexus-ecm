ALTER TYPE "AttendanceCorrectionStatus" ADD VALUE IF NOT EXISTS 'NEEDS_MORE_INFO';

CREATE TYPE "AttendanceCorrectionAction" AS ENUM ('CREATED', 'UPDATED', 'REQUESTED_MORE_INFO', 'APPROVED', 'REJECTED');

ALTER TABLE "attendance_correction_requests"
  ADD COLUMN "evidencePhotoUrl" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "attendance_correction_history" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "action" "AttendanceCorrectionAction" NOT NULL,
  "actorId" TEXT,
  "note" TEXT,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_correction_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_correction_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "attendance_correction_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "attendance_correction_history_requestId_createdAt_idx" ON "attendance_correction_history"("requestId", "createdAt");
