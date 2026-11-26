'use client';

import type * as FaceApi from '@vladmandic/face-api';
import { getFaceApi } from './loadModels';

export type FaceDetection = FaceApi.WithFaceExpressions<
  FaceApi.WithFaceDescriptor<
    FaceApi.WithFaceLandmarks<
      { detection: FaceApi.FaceDetection },
      FaceApi.FaceLandmarks68
    >
  >
>;

/**
 * Detect a single face in a video/image element with landmarks, a 128-d
 * descriptor, and expressions. Returns null if zero or multiple faces.
 */
export async function detectSingleFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<FaceDetection | null> {
  const faceapi = await getFaceApi();
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 });

  const results = await faceapi
    .detectAllFaces(input, options)
    .withFaceLandmarks()
    .withFaceExpressions()
    .withFaceDescriptors();

  if (results.length !== 1) return null;
  return results[0] as unknown as FaceDetection;
}

/** Convenience: descriptor (128-d) as a plain number[] ready to POST. */
export function descriptorToArray(detection: FaceDetection): number[] {
  return Array.from(detection.descriptor);
}
