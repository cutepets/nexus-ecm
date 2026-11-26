-- Preserve daily attendance as the reporting aggregate, while recording every
-- in/out pair as a separate session. Existing records become session #1.
CREATE TABLE "attendance_sessions" (
  "id" TEXT NOT NULL,
  "attendanceId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "checkInAt" TIMESTAMP(3) NOT NULL,
  "checkOutAt" TIMESTAMP(3),
  "checkInLocationId" TEXT,
  "checkOutLocationId" TEXT,
  "checkInPhotoUrl" TEXT,
  "checkOutPhotoUrl" TEXT,
  "checkInLat" DOUBLE PRECISION,
  "checkInLng" DOUBLE PRECISION,
  "checkOutLat" DOUBLE PRECISION,
  "checkOutLng" DOUBLE PRECISION,
  "checkInAccuracyMeters" DOUBLE PRECISION,
  "checkOutAccuracyMeters" DOUBLE PRECISION,
  "checkInDistanceMeters" DOUBLE PRECISION,
  "checkOutDistanceMeters" DOUBLE PRECISION,
  "checkOutUpdateCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_sessions_attendanceId_sequence_key" ON "attendance_sessions"("attendanceId", "sequence");
CREATE INDEX "attendance_sessions_attendanceId_checkInAt_idx" ON "attendance_sessions"("attendanceId", "checkInAt");
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "attendance_sessions" (
  "id", "attendanceId", "sequence", "checkInAt", "checkOutAt",
  "checkInLocationId", "checkOutLocationId", "checkInPhotoUrl", "checkOutPhotoUrl",
  "checkInLat", "checkInLng", "checkOutLat", "checkOutLng",
  "checkInAccuracyMeters", "checkOutAccuracyMeters", "checkInDistanceMeters", "checkOutDistanceMeters",
  "createdAt", "updatedAt"
)
SELECT
  'legacy_' || "id", "id", 1, "checkInAt", "checkOutAt",
  "checkInLocationId", "checkOutLocationId", "checkInPhotoUrl", "checkOutPhotoUrl",
  "checkInLat", "checkInLng", "checkOutLat", "checkOutLng",
  "checkInAccuracyMeters", "checkOutAccuracyMeters", "checkInDistanceMeters", "checkOutDistanceMeters",
  "createdAt", "createdAt"
FROM "attendances"
WHERE "checkInAt" IS NOT NULL;

ALTER TABLE "work_schedules" ADD COLUMN "secondStartTime" TEXT;
ALTER TABLE "work_schedules" ADD COLUMN "secondEndTime" TEXT;
