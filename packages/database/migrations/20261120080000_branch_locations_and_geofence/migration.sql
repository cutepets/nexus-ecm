CREATE TABLE "branch_locations" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "radiusMeters" INTEGER NOT NULL DEFAULT 100,
  "allowRemote" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "branch_locations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branch_locations_code_key" ON "branch_locations"("code");
CREATE INDEX "branch_locations_branchId_isActive_idx" ON "branch_locations"("branchId", "isActive");
ALTER TABLE "branch_locations" ADD CONSTRAINT "branch_locations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every existing branch center as its first valid attendance point.
INSERT INTO "branch_locations" ("id", "branchId", "code", "name", "address", "latitude", "longitude", "radiusMeters", "isActive", "updatedAt")
SELECT 'loc_' || "id", "id", "code" || '-MAIN', "name" || ' - Điểm chính', "address", "latitude", "longitude", "radiusMeters", "isActive", CURRENT_TIMESTAMP
FROM "branches"
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "employee_branch_assignments" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "allowRemote" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_branch_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employee_branch_assignments_employeeId_branchId_effectiveFrom_key" ON "employee_branch_assignments"("employeeId", "branchId", "effectiveFrom");
CREATE INDEX "employee_branch_assignments_employeeId_effectiveFrom_effectiveTo_idx" ON "employee_branch_assignments"("employeeId", "effectiveFrom", "effectiveTo");
ALTER TABLE "employee_branch_assignments" ADD CONSTRAINT "employee_branch_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_branch_assignments" ADD CONSTRAINT "employee_branch_assignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendances"
  ADD COLUMN "checkInLocationId" TEXT,
  ADD COLUMN "checkOutLocationId" TEXT,
  ADD COLUMN "checkInAccuracyMeters" DOUBLE PRECISION,
  ADD COLUMN "checkOutAccuracyMeters" DOUBLE PRECISION,
  ADD COLUMN "checkInDistanceMeters" DOUBLE PRECISION,
  ADD COLUMN "checkOutDistanceMeters" DOUBLE PRECISION,
  ADD COLUMN "geofenceReason" TEXT;
CREATE INDEX "attendances_checkInLocationId_idx" ON "attendances"("checkInLocationId");
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_checkInLocationId_fkey" FOREIGN KEY ("checkInLocationId") REFERENCES "branch_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_checkOutLocationId_fkey" FOREIGN KEY ("checkOutLocationId") REFERENCES "branch_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
