'use client';

import type { FaceDetection } from './detectFace';

export interface QualityResult {
  ok: boolean;
  reason?: string;
  score: number;
  boxSize: number;
}

const MIN_SCORE = 0.7;
const MIN_BOX = 100; // px — face must be large enough / close enough

/**
 * Client-side quality gates: detection confidence and face-box size.
 * (Brightness/pose can be layered on later.) Reject and re-prompt otherwise.
 */
export function checkQuality(detection: FaceDetection): QualityResult {
  const box = detection.detection.box;
  const score = detection.detection.score;
  const boxSize = Math.min(box.width, box.height);

  if (score < MIN_SCORE) {
    return { ok: false, reason: 'Wajah kurang jelas — perbaiki pencahayaan', score, boxSize };
  }
  if (boxSize < MIN_BOX) {
    return { ok: false, reason: 'Mendekatlah ke kamera', score, boxSize };
  }
  return { ok: true, score, boxSize };
}
