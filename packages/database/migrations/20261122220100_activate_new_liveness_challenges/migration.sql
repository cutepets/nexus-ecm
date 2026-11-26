ALTER TABLE "company_settings"
  ALTER COLUMN "livenessMode" SET DEFAULT 'SMILE';

UPDATE "company_settings"
SET "livenessMode" = 'SMILE'
WHERE "livenessMode" IN ('NONE', 'BLINK', 'TURN_HEAD', 'RANDOM');
