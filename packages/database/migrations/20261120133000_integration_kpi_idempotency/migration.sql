CREATE TABLE "integration_kpi_events" (
  "id" TEXT NOT NULL,
  "apiKeyId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "salesAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "orderCount" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_kpi_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integration_kpi_events_apiKeyId_externalId_key" ON "integration_kpi_events"("apiKeyId", "externalId");
CREATE INDEX "integration_kpi_events_employeeId_occurredAt_idx" ON "integration_kpi_events"("employeeId", "occurredAt");
CREATE INDEX "integration_kpi_events_branchId_occurredAt_idx" ON "integration_kpi_events"("branchId", "occurredAt");
ALTER TABLE "integration_kpi_events" ADD CONSTRAINT "integration_kpi_events_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "integration_api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "integration_idempotency_records" (
  "id" TEXT NOT NULL,
  "apiKeyId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_idempotency_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integration_idempotency_records_apiKeyId_endpoint_idempotencyKey_key" ON "integration_idempotency_records"("apiKeyId", "endpoint", "idempotencyKey");
CREATE INDEX "integration_idempotency_records_createdAt_idx" ON "integration_idempotency_records"("createdAt");
ALTER TABLE "integration_idempotency_records" ADD CONSTRAINT "integration_idempotency_records_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "integration_api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
