'use client';

import type { FaceDetection } from './detectFace';

export interface QualityResult {
  ok: boolean;
  reason?: string;
  score: number;
  boxSize: number;
}

const MIN_SCORE = 0.5;
const MIN_BOX = 80; // px — face must still be large enough for reliable matching

/**
 * Client-side quality gates: detection confidence and face-box size.
 * (Brightness/pose can be layered on later.) Reject and re-prompt otherwise.
 */
export function checkQuality(detection: FaceDetection): QualityResult {
  const box = detection.detection.box;
  const score = detection.detection.score;
  const boxSize = Math.min(box.width, box.height);

  if (score < MIN_SCORE) {
    return { ok: false, reason: 'Khuôn mặt chưa rõ — vui lòng cải thiện ánh sáng', score, boxSize };
  }
  if (boxSize < MIN_BOX) {
    return { ok: false, reason: 'Hãy tiến gần camera hơn', score, boxSize };
  }
  return { ok: true, score, boxSize };
}
