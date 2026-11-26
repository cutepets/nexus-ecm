CREATE TYPE "AttendanceApprovalStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');
CREATE TYPE "AttendanceExceptionType" AS ENUM ('OUTSIDE_GEOFENCE', 'WRONG_SCHEDULE', 'FACE_UNRECOGNIZED', 'GPS_UNAVAILABLE', 'OTHER');

ALTER TABLE "attendances"
  ADD COLUMN "approvalStatus" "AttendanceApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "exceptionType" "AttendanceExceptionType",
  ADD COLUMN "approvalRequestNote" TEXT,
  ADD COLUMN "approvalReviewedAt" TIMESTAMP(3),
  ADD COLUMN "approvalReviewedById" TEXT,
  ADD COLUMN "approvalReviewNote" TEXT;

CREATE INDEX "attendances_approvalStatus_workDate_idx" ON "attendances"("approvalStatus", "workDate");
