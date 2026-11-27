"use client";

import type { FaceDetection } from "./detectFace";

export type LivenessChallenge = "blink" | "turnLeft" | "turnRight" | "smile" | "nod";
export type LivenessStage = "baseline" | "challenge" | "recover" | "passed";

export const CHALLENGE_LABEL: Record<LivenessChallenge, string> = {
  blink: "Nháy mắt một lần, rồi mở mắt nhìn thẳng camera",
  turnLeft: "Quay đầu sang bên trái của bạn, rồi nhìn thẳng lại camera",
  turnRight: "Quay đầu sang bên phải của bạn, rồi nhìn thẳng lại camera",
  smile: "Mỉm cười, rồi trở lại nét mặt bình thường",
  nod: "Gật đầu xuống một lần, rồi nhìn thẳng lại camera",
};

type FaceMetrics = {
  eyeRatio: number;
  noseOffset: number;
  verticalNoseOffset: number;
  happiness: number;
};
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const meanX = (points: { x: number }[]) =>
  points.reduce((sum, point) => sum + point.x, 0) / points.length;
const meanY = (points: { y: number }[]) =>
  points.reduce((sum, point) => sum + point.y, 0) / points.length;

function eyeRatio(points: { x: number; y: number }[]) {
  if (points.length < 6) return 0;
  const width = distance(points[0], points[3]);
  return width
    ? (distance(points[1], points[5]) + distance(points[2], points[4])) /
        (2 * width)
    : 0;
}

function metricsOf(detection: FaceDetection): FaceMetrics {
  const landmarks = detection.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const eyeCentre = (meanX(leftEye) + meanX(rightEye)) / 2;
  const verticalEyeCentre = (meanY(leftEye) + meanY(rightEye)) / 2;
  const eyeDistance = Math.max(Math.abs(meanX(rightEye) - meanX(leftEye)), 1);
  return {
    eyeRatio: (eyeRatio(leftEye) + eyeRatio(rightEye)) / 2,
    noseOffset: (meanX(landmarks.getNose()) - eyeCentre) / eyeDistance,
    verticalNoseOffset:
      (meanY(landmarks.getNose()) - verticalEyeCentre) / eyeDistance,
    happiness: detection.expressions.happy,
  };
}

/** Requires `neutral → action → neutral`; a pre-posed still image cannot pass. */
export class LivenessTracker {
  private stage: LivenessStage = "baseline";
  private neutralFrames = 0;
  private baseline: FaceMetrics | null = null;
  private actionStartedAt: number | null = null;
  private completedAt: number | null = null;

  constructor(public readonly challenge: LivenessChallenge) {}

  update(detection: FaceDetection): LivenessStage {
    const current = metricsOf(detection);
    if (this.stage === "baseline") {
      if (!this.isNeutral(current, null)) {
        this.neutralFrames = 0;
        return this.stage;
      }
      this.neutralFrames += 1;
      if (this.neutralFrames >= 7) {
        this.baseline = current;
        this.neutralFrames = 0;
        this.stage = "challenge";
      }
      return this.stage;
    }
    if (this.stage === "challenge") {
      if (this.matchesChallenge(current)) {
        this.actionStartedAt = Date.now();
        this.neutralFrames = 0;
        this.stage = "recover";
      }
      return this.stage;
    }
    if (this.stage === "recover") {
      this.neutralFrames = this.isNeutral(current, this.baseline)
        ? this.neutralFrames + 1
        : 0;
      if (this.neutralFrames >= 5) {
        this.completedAt = Date.now();
        this.stage = "passed";
      }
    }
    return this.stage;
  }

  audit() {
    return {
      challenge: this.challenge,
      baselineFramesRequired: 7,
      recoveryFramesRequired: 5,
      actionDurationMs:
        this.actionStartedAt && this.completedAt
          ? this.completedAt - this.actionStartedAt
          : undefined,
    };
  }

  private isNeutral(current: FaceMetrics, baseline: FaceMetrics | null) {
    const referenceEye = baseline?.eyeRatio ?? current.eyeRatio;
    return (
      current.eyeRatio >= Math.max(0.18, referenceEye * 0.8) &&
      Math.abs(current.noseOffset) <= 0.11 &&
      Math.abs(
        current.verticalNoseOffset -
          (baseline?.verticalNoseOffset ?? current.verticalNoseOffset),
      ) <= 0.11 &&
      current.happiness <= 0.35
    );
  }

  private matchesChallenge(current: FaceMetrics) {
    const baseline = this.baseline;
    if (!baseline) return false;
    if (this.challenge === "blink")
      return (
        current.eyeRatio <=
        Math.min(0.3, baseline.eyeRatio * 0.8)
      );
    if (this.challenge === "nod")
      return current.verticalNoseOffset >= baseline.verticalNoseOffset + 0.12;
    if (this.challenge === "smile")
      return current.happiness >= Math.max(0.55, baseline.happiness + 0.15);
    // The preview is mirrored for the user while face-api reads the original
    // video pixels. Therefore the raw horizontal landmark movement is the
    // inverse of the user's perceived left/right direction.
    if (this.challenge === "turnLeft")
      return current.noseOffset >= baseline.noseOffset + 0.18;
    return current.noseOffset <= baseline.noseOffset - 0.18;
  }
}
