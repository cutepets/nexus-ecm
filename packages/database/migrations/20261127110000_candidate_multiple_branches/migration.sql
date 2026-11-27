CREATE TABLE "candidate_branch_preferences" (
    "candidateId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "candidate_branch_preferences_pkey" PRIMARY KEY ("candidateId", "branchId")
);

CREATE INDEX "candidate_branch_preferences_branchId_idx"
ON "candidate_branch_preferences"("branchId");

ALTER TABLE "candidate_branch_preferences"
ADD CONSTRAINT "candidate_branch_preferences_candidateId_fkey"
FOREIGN KEY ("candidateId") REFERENCES "candidates"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_branch_preferences"
ADD CONSTRAINT "candidate_branch_preferences_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "branches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "candidate_branch_preferences" ("candidateId", "branchId")
SELECT "id", "desiredBranchId"
FROM "candidates"
WHERE "desiredBranchId" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "candidates" DROP CONSTRAINT "candidates_desiredBranchId_fkey";
DROP INDEX "candidates_desiredBranchId_idx";
ALTER TABLE "candidates" DROP COLUMN "desiredBranchId";
