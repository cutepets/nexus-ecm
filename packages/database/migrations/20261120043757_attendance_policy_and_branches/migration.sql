-- CreateEnum
CREATE TYPE "LivenessMode" AS ENUM ('NONE', 'BLINK', 'TURN_HEAD', 'RANDOM');

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "auditRetentionDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "correctionRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "livenessMode" "LivenessMode" NOT NULL DEFAULT 'RANDOM',
ADD COLUMN     "requireGps" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE INDEX "branches_isActive_idx" ON "branches"("isActive");
