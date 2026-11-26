-- Retire hand gestures from attendance liveness.  The enum values remain for
-- historical records, but no active company policy may use them.
UPDATE "company_settings"
SET "livenessMode" = 'RANDOM'
WHERE "livenessMode" IN ('THUMB_UP', 'PEACE', 'NONE');

ALTER TABLE "company_settings"
  ALTER COLUMN "livenessMode" SET DEFAULT 'RANDOM';
