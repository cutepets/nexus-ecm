'use client';

import type { FaceDetection } from './detectFace';

export type LivenessChallenge = 'blink' | 'turnLeft' | 'turnRight';

/** Pick a random challenge to defeat printed-photo spoofing. */
export function randomChallenge(): LivenessChallenge {
  const all: LivenessChallenge[] = ['blink', 'turnLeft', 'turnRight'];
  return all[Math.floor(Math.random() * all.length)];
}

export const CHALLENGE_LABEL: Record<LivenessChallenge, string> = {
  blink: 'Kedipkan mata Anda',
  turnLeft: 'Tengok ke kiri',
  turnRight: 'Tengok ke kanan',
};

/** Eye Aspect Ratio — drops sharply during a blink. */
function eyeAspectRatio(eye: { x: number; y: number }[]): number {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const vertical = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
  const horizontal = 2 * dist(eye[0], eye[3]);
  return horizontal === 0 ? 0 : vertical / horizontal;
}

/**
 * Stateful liveness detector. Feed it detections frame-by-frame; it returns
 * true once the active challenge is satisfied via landmark motion.
 */
export class LivenessTracker {
  private baselineNoseX: number | null = null;
  private earBaseline: number | null = null;
  private blinked = false;

  constructor(public challenge: LivenessChallenge) {}

  reset(challenge: LivenessChallenge) {
    this.challenge = challenge;
    this.baselineNoseX = null;
    this.earBaseline = null;
    this.blinked = false;
  }

  /** @returns true when the challenge has been passed. */
  update(detection: FaceDetection): boolean {
    const landmarks = detection.landmarks;
    const box = detection.detection.box;

    if (this.challenge === 'blink') {
      const ear =
        (eyeAspectRatio(landmarks.getLeftEye()) + eyeAspectRatio(landmarks.getRightEye())) / 2;
      if (this.earBaseline === null) this.earBaseline = ear;
      // A blink is a transient drop below ~70% of the open-eye baseline.
      if (ear < this.earBaseline * 0.7) this.blinked = true;
      return this.blinked;
    }

    // Head turn: track nose x relative to face-box width.
    const nose = landmarks.getNose()[3];
    const relX = (nose.x - box.x) / box.width;
    if (this.baselineNoseX === null) this.baselineNoseX = relX;
    const delta = relX - this.baselineNoseX;
    if (this.challenge === 'turnLeft') return delta < -0.12;
    return delta > 0.12; // turnRight
  }
}
