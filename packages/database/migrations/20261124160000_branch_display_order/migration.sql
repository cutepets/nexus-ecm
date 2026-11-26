ALTER TABLE "branches"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "isActive" DESC, "name" ASC) - 1 AS "position"
  FROM "branches"
)
UPDATE "branches"
SET "displayOrder" = ranked."position"
FROM ranked
WHERE "branches"."id" = ranked."id";

CREATE INDEX "branches_isActive_displayOrder_idx" ON "branches"("isActive", "displayOrder");
