import {
  bufferToEmbedding,
  distanceToConfidence,
  embeddingToBuffer,
  euclideanDistance,
  minDistance,
} from './embedding.util';

describe('embedding.util', () => {
  it('round-trips an embedding through Buffer serialization', () => {
    const original = [0.1, -0.2, 0.3, 0.9];
    const restored = bufferToEmbedding(embeddingToBuffer(original));
    restored.forEach((v, i) => expect(v).toBeCloseTo(original[i], 5));
  });

  it('computes Euclidean distance', () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('returns Infinity for mismatched lengths', () => {
    expect(euclideanDistance([1, 2], [1, 2, 3])).toBe(Number.POSITIVE_INFINITY);
  });

  it('finds the minimum distance to candidates', () => {
    const probe = [0, 0];
    expect(minDistance(probe, [[3, 4], [1, 0], [0, 0.5]])).toBeCloseTo(0.5, 5);
  });

  it('maps distance to a 0..1 confidence', () => {
    expect(distanceToConfidence(0)).toBe(1);
    expect(distanceToConfidence(0.4)).toBeCloseTo(0.6, 5);
    expect(distanceToConfidence(2)).toBe(0);
    expect(distanceToConfidence(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
