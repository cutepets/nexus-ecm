/** Helpers for face-embedding (de)serialization and matching. */

/** Serialize a descriptor (array of floats) to a Buffer of Float32. */
export function embeddingToBuffer(values: number[]): Buffer {
  return Buffer.from(Float32Array.from(values).buffer);
}

/** Deserialize a Float32 Buffer back into a number array. */
export function bufferToEmbedding(buf: Buffer): number[] {
  // Copy to ensure the underlying ArrayBuffer is correctly aligned/sized.
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  return Array.from(f32);
}

/** Euclidean (L2) distance between two equal-length vectors. */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Smallest distance from `probe` to any vector in `candidates`. */
export function minDistance(probe: number[], candidates: number[][]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const d = euclideanDistance(probe, c);
    if (d < min) min = d;
  }
  return min;
}

/** Map a distance to a 0..1 confidence (1 = identical). */
export function distanceToConfidence(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  return Math.max(0, Math.min(1, 1 - distance));
}
