-- Store only policy/result metadata for each attendance event.
-- Embeddings remain encrypted in face_profiles and are never copied here.
ALTER TABLE "attendances"
  ADD COLUMN IF NOT EXISTS "livenessChallenge" TEXT,
  ADD COLUMN IF NOT EXISTS "livenessPolicy" "LivenessMode";
