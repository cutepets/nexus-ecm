CREATE TYPE "IntegrationWebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'DEAD_LETTER');

CREATE TABLE "integration_webhook_subscriptions" (
  "id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "event_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "secret_ciphertext" BYTEA NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_webhook_deliveries" (
  "id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "IntegrationWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_status_code" INTEGER,
  "last_error" TEXT,
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_webhook_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_webhook_deliveries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "integration_webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "integration_webhook_subscriptions_is_active_idx" ON "integration_webhook_subscriptions"("is_active");
CREATE INDEX "integration_webhook_deliveries_status_next_attempt_at_idx" ON "integration_webhook_deliveries"("status", "next_attempt_at");
