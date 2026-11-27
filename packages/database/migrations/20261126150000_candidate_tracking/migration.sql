CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "photoKey" TEXT,
    "desiredBranchId" TEXT,
    "desiredShift" TEXT,
    "desiredStartDate" TIMESTAMP(3),
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "candidates_fullName_idx" ON "candidates"("fullName");
CREATE INDEX "candidates_phone_idx" ON "candidates"("phone");
CREATE INDEX "candidates_desiredBranchId_idx" ON "candidates"("desiredBranchId");
CREATE INDEX "candidates_createdAt_idx" ON "candidates"("createdAt");

ALTER TABLE "candidates"
ADD CONSTRAINT "candidates_desiredBranchId_fkey"
FOREIGN KEY ("desiredBranchId") REFERENCES "branches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "key", "module")
SELECT 'perm_' || md5(catalog.key), catalog.key, 'candidate'
FROM (VALUES
    ('candidate:create'),
    ('candidate:read'),
    ('candidate:update'),
    ('candidate:delete')
) AS catalog(key)
ON CONFLICT ("key") DO UPDATE SET "module" = EXCLUDED."module";

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT roles."id", permissions."id"
FROM "roles" AS roles
JOIN "permissions" AS permissions ON permissions."key" IN (
    'candidate:create', 'candidate:read', 'candidate:update', 'candidate:delete'
)
WHERE roles."name" = 'HR'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT roles."id", permissions."id"
FROM "roles" AS roles
JOIN "permissions" AS permissions ON permissions."key" = 'candidate:read'
WHERE roles."name" = 'MANAGER'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
