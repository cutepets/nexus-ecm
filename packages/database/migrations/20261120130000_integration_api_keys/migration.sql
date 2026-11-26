CREATE TABLE "integration_api_keys" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "branchIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_api_keys_keyPrefix_key" ON "integration_api_keys"("keyPrefix");
CREATE UNIQUE INDEX "integration_api_keys_secretHash_key" ON "integration_api_keys"("secretHash");
CREATE INDEX "integration_api_keys_revokedAt_expiresAt_idx" ON "integration_api_keys"("revokedAt", "expiresAt");
