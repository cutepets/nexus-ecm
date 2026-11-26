-- Earlier local migrations introduced snake_case names while Prisma models use
-- the project's established camelCase convention. Rename in place; no data is
-- removed and existing deployment history remains valid.
ALTER TABLE "timesheet_entries" RENAME COLUMN "early_leave_minutes" TO "earlyLeaveMinutes";

ALTER TABLE "integration_webhook_subscriptions"
  RENAME COLUMN "event_types" TO "eventTypes";
ALTER TABLE "integration_webhook_subscriptions"
  RENAME COLUMN "secret_ciphertext" TO "secretCiphertext";
ALTER TABLE "integration_webhook_subscriptions"
  RENAME COLUMN "is_active" TO "isActive";
ALTER TABLE "integration_webhook_subscriptions"
  RENAME COLUMN "created_by_id" TO "createdById";
ALTER TABLE "integration_webhook_subscriptions"
  RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "integration_webhook_subscriptions"
  RENAME COLUMN "updated_at" TO "updatedAt";

ALTER TABLE "integration_webhook_deliveries"
  RENAME COLUMN "subscription_id" TO "subscriptionId";
ALTER TABLE "integration_webhook_deliveries"
  RENAME COLUMN "event_type" TO "eventType";
ALTER TABLE "integration_webhook_deliveries"
  RENAME COLUMN "next_attempt_at" TO "nextAttemptAt";
ALTER TABLE "integration_webhook_deliveries"
  RENAME COLUMN "last_status_code" TO "lastStatusCode";
ALTER TABLE "integration_webhook_deliveries"
  RENAME COLUMN "last_error" TO "lastError";
ALTER TABLE "integration_webhook_deliveries"
  RENAME COLUMN "delivered_at" TO "deliveredAt";
ALTER TABLE "integration_webhook_deliveries"
  RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "integration_webhook_deliveries"
  RENAME COLUMN "updated_at" TO "updatedAt";
