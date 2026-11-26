-- Phase 0-1 completion: company policy, payroll and integration configuration.
-- All defaults are safe for existing deployments and preserve current data.

DO $$ BEGIN
  CREATE TYPE "PayrollMode" AS ENUM ('MONTHLY', 'HOURLY', 'SHIFT', 'HYBRID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "company_settings"
  ADD COLUMN IF NOT EXISTS "employmentTypes" TEXT[] NOT NULL DEFAULT ARRAY['VAN_PHONG', 'CUA_HANG_POS', 'CONG_TRUONG', 'TU_XA', 'CA_KIP'],
  ADD COLUMN IF NOT EXISTS "payrollMode" "PayrollMode" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "payrollCutoffDay" INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS "overtimeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS "integrationApiEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "integrationAllowedOrigins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "company_settings"
  DROP CONSTRAINT IF EXISTS "company_settings_payroll_cutoff_day_check",
  ADD CONSTRAINT "company_settings_payroll_cutoff_day_check" CHECK ("payrollCutoffDay" BETWEEN 1 AND 31);
