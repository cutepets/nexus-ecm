-- GPS is enforced by the attendance service and correction requests always
-- follow the approval workflow. These former configuration switches are gone.
ALTER TABLE "company_settings"
DROP COLUMN IF EXISTS "correctionRequiresApproval";
