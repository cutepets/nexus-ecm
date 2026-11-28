CREATE TYPE "StorageProvider" AS ENUM ('MINIO', 'GOOGLE_DRIVE');

ALTER TABLE "company_settings"
  ADD COLUMN "storageProvider" "StorageProvider",
  ADD COLUMN "googleDriveServiceAccountEnc" BYTEA,
  ADD COLUMN "googleDriveFolderId" TEXT,
  ADD COLUMN "googleDriveSharedDriveId" TEXT,
  ADD COLUMN "googleDriveConnectionVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "googleDriveConfigFingerprint" TEXT;
