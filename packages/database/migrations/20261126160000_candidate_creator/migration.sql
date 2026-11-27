ALTER TABLE "candidates"
ADD COLUMN "createdById" TEXT;

CREATE INDEX "candidates_createdById_idx" ON "candidates"("createdById");

ALTER TABLE "candidates"
ADD CONSTRAINT "candidates_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
