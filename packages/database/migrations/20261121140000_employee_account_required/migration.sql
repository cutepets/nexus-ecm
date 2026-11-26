-- Pha 5: an employee is the owner of exactly one login account.
-- The preflight/reconciliation has already linked every demo employee.
ALTER TABLE "employees"
  ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "employees" DROP CONSTRAINT "employees_userId_fkey";
ALTER TABLE "employees"
  ADD CONSTRAINT "employees_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
