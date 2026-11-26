-- Add login identifiers in a backward-compatible sequence. Existing users first
-- receive a deterministic fallback username; safe email local-parts then replace
-- that fallback. No existing email, password hash, or employee record is changed.
ALTER TABLE "users"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "employees"
  ADD COLUMN "terminatedAt" TIMESTAMP(3),
  ADD COLUMN "terminationReason" TEXT;

-- `user-<cuid>` is valid, deterministic and unique. It makes the migration
-- safe even when legacy email local-parts collide or contain unsupported chars.
UPDATE "users"
SET "username" = 'user-' || "id";

-- Prefer a readable username derived from a unique, valid email local-part.
-- Rows whose candidate is ambiguous or collides with a fallback stay unchanged.
WITH candidates AS (
  SELECT
    "id",
    NULLIF(
      regexp_replace(
        regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9._-]+', '_', 'g'),
        '^[._-]+|[._-]+$',
        '',
        'g'
      ),
      ''
    ) AS candidate
  FROM "users"
),
valid_candidates AS (
  SELECT
    "id",
    candidate,
    count(*) OVER (PARTITION BY candidate) AS candidate_count
  FROM candidates
  WHERE candidate ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$'
)
UPDATE "users" AS target
SET "username" = valid_candidates.candidate
FROM valid_candidates
WHERE target."id" = valid_candidates."id"
  AND valid_candidates.candidate_count = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "users" AS existing
    WHERE existing."username" = valid_candidates.candidate
      AND existing."id" <> target."id"
  );

-- Only copy phones that can be normalized unambiguously to Vietnamese E.164.
-- Invalid/duplicate employee phones remain null and must be corrected by an admin.
WITH phone_candidates AS (
  SELECT
    "userId",
    CASE
      WHEN regexp_replace("phone", '\D', '', 'g') ~ '^0[0-9]{9}$'
        THEN '+84' || substr(regexp_replace("phone", '\D', '', 'g'), 2)
      WHEN regexp_replace("phone", '\D', '', 'g') ~ '^84[0-9]{9}$'
        THEN '+' || regexp_replace("phone", '\D', '', 'g')
      ELSE NULL
    END AS normalized_phone
  FROM "employees"
  WHERE "userId" IS NOT NULL
    AND "phone" IS NOT NULL
),
unique_phone_candidates AS (
  SELECT
    "userId",
    normalized_phone,
    count(*) OVER (PARTITION BY normalized_phone) AS phone_count
  FROM phone_candidates
  WHERE normalized_phone IS NOT NULL
)
UPDATE "users" AS target
SET "phone" = unique_phone_candidates.normalized_phone
FROM unique_phone_candidates
WHERE target."id" = unique_phone_candidates."userId"
  AND unique_phone_candidates.phone_count = 1;

ALTER TABLE "users"
  ALTER COLUMN "username" SET NOT NULL;

ALTER TABLE "users"
  ADD CONSTRAINT "users_username_format_check"
    CHECK ("username" ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$'),
  ADD CONSTRAINT "users_phone_e164_check"
    CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$');

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
