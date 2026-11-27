ALTER TYPE "LivenessMode" ADD VALUE 'NOD';

ALTER TABLE "company_settings"
ADD COLUMN "livenessSensitivity" INTEGER NOT NULL DEFAULT 80;
