ALTER TABLE "user_roles"
ADD COLUMN "isAutomatic" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "role_assignment_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "positionId" TEXT,
    "branchId" TEXT,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "role_assignment_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "role_assignment_rules_roleId_idx" ON "role_assignment_rules"("roleId");
CREATE INDEX "role_assignment_rules_departmentId_positionId_branchId_isActive_idx"
ON "role_assignment_rules"("departmentId", "positionId", "branchId", "isActive");

ALTER TABLE "role_assignment_rules"
ADD CONSTRAINT "role_assignment_rules_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
