'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadModels } from './loadModels';

interface UseFaceCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  ready: boolean;
  error: string | null;
  capturePhoto: (maxWidth?: number) => string | null;
  facingMode: 'user' | 'environment';
  switchCamera: () => void;
  retry: () => void;
  stopCamera: () => void;
}

// Camera hardware can only serve one reliable stream per app.  Keeping both
// streams and video elements here lets a new scanner close every stream the
// app itself opened before requesting the device again.
const managedStreams = new Set<MediaStream>();
const managedVideos = new Set<HTMLVideoElement>();
let cameraOperation: Promise<void> = Promise.resolve();

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const stopStream = (stream: MediaStream | null | undefined) => stream?.getTracks().forEach((track) => track.stop());

function closeAppCameras() {
  managedVideos.forEach((video) => { video.pause(); video.srcObject = null; });
  managedVideos.clear();
  managedStreams.forEach(stopStream);
  managedStreams.clear();
}

function releaseStream(stream: MediaStream | null, video: HTMLVideoElement | null) {
  if (video) { video.pause(); video.srcObject = null; managedVideos.delete(video); }
  stopStream(stream);
  if (stream) managedStreams.delete(stream);
}

async function acquireStream(facingMode: 'user' | 'environment') {
  let acquired: MediaStream | null = null;
  cameraOperation = cameraOperation.catch(() => undefined).then(async () => {
    closeAppCameras();
    // Mobile browsers often need a short release interval after stop().
    await wait(250);
    acquired = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    managedStreams.add(acquired);
  });
  await cameraOperation;
  return acquired;
}

function cameraErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) return 'Không thể khởi động camera. Hãy thử lại.';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Camera đang bị chặn. Hãy cấp quyền Camera cho trang này rồi thử lại.';
  if (error.name === 'NotFoundError') return 'Không tìm thấy camera trên thiết bị này.';
  if (error.name === 'NotReadableError' || error.name === 'AbortError' || error.name === 'TrackStartError') return 'Camera đang được ứng dụng hoặc tab khác sử dụng. Ứng dụng đã đóng các phiên camera cũ của chính nó; hãy đóng ứng dụng/tab khác rồi thử lại.';
  if (error.name === 'OverconstrainedError') return 'Camera không hỗ trợ cấu hình hiện tại. Hãy đổi camera hoặc thử lại.';
  return 'Không thể khởi động camera. Hãy thử lại.';
}

export function useFaceCamera(): UseFaceCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let localStream: MediaStream | null = null;
    const video = videoRef.current;

    void (async () => {
      try {
        setReady(false);
        setError(null);
        // Fetch face models while the browser opens the camera so the two
        // startup waits overlap instead of delaying the preview sequentially.
        const modelsPromise = loadModels().then(
          () => null,
          (modelError: unknown) => modelError,
        );

        try {
          localStream = await acquireStream(facingMode);
        } catch (firstError) {
          if (!(firstError instanceof DOMException) || !['NotReadableError', 'AbortError', 'TrackStartError'].includes(firstError.name)) throw firstError;
          await wait(600);
          if (cancelled) return;
          localStream = await acquireStream(facingMode);
        }
        if (cancelled) { releaseStream(localStream, video); return; }

        const modelsError = await modelsPromise;
        if (modelsError) throw modelsError;

        streamRef.current = localStream;
        if (!video) throw new DOMException('Không tìm thấy khung camera', 'AbortError');
        managedVideos.add(video);
        video.srcObject = localStream;
        await video.play();
        if (cancelled) { releaseStream(localStream, video); return; }
        setReady(true);
      } catch (caught) {
        releaseStream(localStream, video);
        if (streamRef.current === localStream) streamRef.current = null;
        setError(cameraErrorMessage(caught));
      }
    })();

    return () => {
      cancelled = true;
      releaseStream(localStream, video);
      if (streamRef.current === localStream) streamRef.current = null;
    };
  }, [attempt, facingMode]);

  const capturePhoto = useCallback((maxWidth = 960): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.88);
  }, []);

  const stopCamera = useCallback(() => {
    try {
      releaseStream(streamRef.current, videoRef.current);
    } finally {
      streamRef.current = null;
      setReady(false);
    }
  }, []);

  return {
    videoRef,
    ready,
    error,
    capturePhoto,
    facingMode,
    switchCamera: () => setFacingMode((value) => value === 'user' ? 'environment' : 'user'),
    retry: () => setAttempt((value) => value + 1),
    stopCamera,
  };
}
