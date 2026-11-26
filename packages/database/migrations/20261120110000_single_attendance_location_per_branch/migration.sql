-- Each branch now owns exactly one active attendance point.  Keep legacy rows
-- for audit/history, but deactivate any later location rows so they cannot be
-- selected by geofence checks or face-identification eligibility.
WITH ranked_locations AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "branchId" ORDER BY "createdAt" ASC, id ASC) AS location_rank
  FROM "branch_locations"
)
UPDATE "branch_locations"
SET "isActive" = false, "allowRemote" = false
WHERE id IN (SELECT id FROM ranked_locations WHERE location_rank > 1);
