-- Attendance is always GPS-gated and is valid at any active store location.
-- Legacy remote flags are retained only as historical data and no longer grant
-- an attendance bypass.
UPDATE "company_settings"
SET "requireGps" = true;

UPDATE "employee_branch_assignments"
SET "allowRemote" = false
WHERE "allowRemote" = true;

UPDATE "branch_locations"
SET "allowRemote" = false
WHERE "allowRemote" = true;
