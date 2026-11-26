CREATE TABLE "employment_history" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "changeType" TEXT NOT NULL,
    "reason" TEXT,
    "decisionNumber" TEXT,
    "changes" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employment_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "employee_documents" ADD COLUMN "historyId" TEXT;
CREATE INDEX "employment_history_employeeId_effectiveDate_idx" ON "employment_history"("employeeId", "effectiveDate");
CREATE INDEX "employee_documents_historyId_idx" ON "employee_documents"("historyId");
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "employment_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;
