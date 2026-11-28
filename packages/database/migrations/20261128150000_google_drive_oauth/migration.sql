CREATE TYPE "GoogleDriveAuthMode" AS ENUM ('SERVICE_ACCOUNT', 'OAUTH');

ALTER TABLE "company_settings"
  ADD COLUMN "googleDriveAuthMode" "GoogleDriveAuthMode" NOT NULL DEFAULT 'SERVICE_ACCOUNT',
  ADD COLUMN "googleDriveOAuthClientId" TEXT,
  ADD COLUMN "googleDriveOAuthClientSecretEnc" BYTEA,
  ADD COLUMN "googleDriveOAuthRefreshTokenEnc" BYTEA,
  ADD COLUMN "googleDriveOAuthEmail" TEXT,
  ADD COLUMN "googleDriveOAuthStateHash" TEXT,
  ADD COLUMN "googleDriveOAuthStateExpiresAt" TIMESTAMP(3);
