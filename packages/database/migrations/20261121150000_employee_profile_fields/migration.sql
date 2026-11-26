-- Personal, emergency-contact, and payroll-profile fields for an employee.
ALTER TABLE "employees"
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "identityCode" TEXT,
  ADD COLUMN "emergencyContactName" TEXT,
  ADD COLUMN "emergencyContactPhone" TEXT,
  ADD COLUMN "taxCode" TEXT,
  ADD COLUMN "salaryBankName" TEXT,
  ADD COLUMN "salaryBankAccount" TEXT;

CREATE UNIQUE INDEX "employees_identityCode_key" ON "employees"("identityCode");
