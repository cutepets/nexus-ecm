CREATE TYPE "CandidateStatus" AS ENUM ('REVIEW', 'APPROVED', 'FOLLOW_UP', 'REJECTED');

ALTER TABLE "candidates"
ADD COLUMN "status" "CandidateStatus" NOT NULL DEFAULT 'REVIEW';
