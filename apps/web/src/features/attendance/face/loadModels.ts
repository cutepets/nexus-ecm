'use client';

import type * as FaceApi from '@vladmandic/face-api';

/** Where the face-api model weights live (see public/models + README). */
const MODEL_URL = '/models';

let faceapiPromise: Promise<typeof FaceApi> | null = null;
let modelsLoaded = false;

/** Lazily import face-api only in the browser (it touches WebGL/DOM globals). */
export async function getFaceApi(): Promise<typeof FaceApi> {
  if (!faceapiPromise) faceapiPromise = import('@vladmandic/face-api');
  return faceapiPromise;
}

/** Idempotently load the detector, landmark, and recognition models. */
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  const faceapi = await getFaceApi();
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

export function areModelsLoaded() {
  return modelsLoaded;
}
