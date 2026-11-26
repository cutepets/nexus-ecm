CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME');

ALTER TABLE "employees"
  ADD COLUMN "basicSalary" DECIMAL(18,2),
  ADD COLUMN "spaBonusPercent" DECIMAL(5,2),
  ADD COLUMN "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
  ADD COLUMN "primaryBranchId" TEXT;

CREATE INDEX "employees_primaryBranchId_idx" ON "employees"("primaryBranchId");

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_primaryBranchId_fkey"
  FOREIGN KEY ("primaryBranchId") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
