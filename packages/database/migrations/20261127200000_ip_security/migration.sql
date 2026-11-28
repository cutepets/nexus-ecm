CREATE TABLE "login_ip_controls" (
    "ipAddress" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "failureWindowStartedAt" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "login_ip_controls_pkey" PRIMARY KEY ("ipAddress")
);

CREATE INDEX "login_ip_controls_blockedAt_expiresAt_idx"
ON "login_ip_controls"("blockedAt", "expiresAt");

CREATE TABLE "ip_security_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "autoUnblockMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ip_security_settings_pkey" PRIMARY KEY ("id")
);
