'use client';

/** Euclidean (L2) distance between two descriptors. */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export const DEFAULT_THRESHOLD = 0.55;

export interface MatchResult {
  matched: boolean;
  distance: number;
  confidence: number;
}

/** Best match of a probe descriptor against candidate descriptors. */
export function bestMatch(
  probe: number[],
  candidates: number[][],
  threshold = DEFAULT_THRESHOLD,
): MatchResult {
  let distance = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const d = euclideanDistance(probe, c);
    if (d < distance) distance = d;
  }
  return {
    matched: distance <= threshold,
    distance,
    confidence: Math.max(0, Math.min(1, 1 - distance)),
  };
}
