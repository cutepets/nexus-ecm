'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadModels } from './loadModels';

interface UseFaceCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  ready: boolean;
  error: string | null;
  /** Capture a downscaled JPEG data URL of the current frame (for the audit photo). */
  capturePhoto: (maxWidth?: number) => string | null;
}

/**
 * Manages the webcam stream and ensures face-api models are loaded.
 * Cleans up the media stream on unmount.
 */
export function useFaceCamera(): UseFaceCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadModels();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Tidak dapat mengakses kamera atau memuat model wajah',
        );
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capturePhoto = useCallback((maxWidth = 320): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  }, []);

  return { videoRef, ready, error, capturePhoto };
}
