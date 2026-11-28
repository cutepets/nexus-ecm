BEGIN;

-- Service-account connections depended on Shared Drives. Fall back to the
-- existing VPS storage for those installations; keep active personal OAuth
-- connections selected so their existing My Drive objects remain readable.
UPDATE "company_settings"
SET "storageProvider" = 'MINIO'::"StorageProvider",
    "googleDriveConnectionVerifiedAt" = NULL,
    "googleDriveConfigFingerprint" = NULL
WHERE "storageProvider" = 'GOOGLE_DRIVE'::"StorageProvider"
  AND (
    "googleDriveOAuthClientId" IS NULL OR
    "googleDriveOAuthClientSecretEnc" IS NULL OR
    "googleDriveOAuthRefreshTokenEnc" IS NULL OR
    "googleDriveFolderId" IS NULL
  );

UPDATE "company_settings"
SET "googleDriveConnectionVerifiedAt" = NULL,
    "googleDriveConfigFingerprint" = NULL
WHERE "googleDriveOAuthRefreshTokenEnc" IS NULL;

ALTER TABLE "company_settings"
  DROP COLUMN "googleDriveAuthMode",
  DROP COLUMN "googleDriveServiceAccountEnc",
  DROP COLUMN "googleDriveSharedDriveId";

DROP TYPE "GoogleDriveAuthMode";

COMMIT;
