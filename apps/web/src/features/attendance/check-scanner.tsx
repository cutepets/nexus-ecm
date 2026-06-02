'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, Loader2, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFaceCamera } from './face/useFaceCamera';
import { detectSingleFace, descriptorToArray } from './face/detectFace';
import { checkQuality } from './face/quality';
import {
  CHALLENGE_LABEL,
  LivenessTracker,
  randomChallenge,
  type LivenessChallenge,
} from './face/liveness';
import { useCheck } from './api';

type Phase = 'init' | 'liveness' | 'capturing' | 'submitting' | 'done' | 'error';

export function CheckScanner({
  kind,
  employeeId,
}: {
  kind: 'check-in' | 'check-out';
  employeeId: string;
}) {
  const router = useRouter();
  const { videoRef, ready, error, capturePhoto } = useFaceCamera();
  const check = useCheck(kind);

  const [phase, setPhase] = useState<Phase>('init');
  const [hint, setHint] = useState('Posisikan wajah di dalam bingkai');
  const [challenge, setChallenge] = useState<LivenessChallenge>('blink');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const trackerRef = useRef<LivenessTracker | null>(null);
  const rafRef = useRef<number | null>(null);

  // Ask for geolocation up front (optional).
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(null),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }, []);

  const start = () => {
    const c = randomChallenge();
    setChallenge(c);
    trackerRef.current = new LivenessTracker(c);
    setPhase('liveness');
    setHint(CHALLENGE_LABEL[c]);
    loop();
  };

  const loop = () => {
    const tick = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const detection = await detectSingleFace(video);
      if (!detection) {
        setHint('Wajah tidak terdeteksi — hadapkan wajah ke kamera');
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const quality = checkQuality(detection);
      if (!quality.ok) {
        setHint(quality.reason ?? 'Perbaiki posisi wajah');
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const passed = trackerRef.current?.update(detection) ?? false;
      if (!passed) {
        setHint(CHALLENGE_LABEL[trackerRef.current!.challenge]);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Liveness satisfied → capture descriptor + photo and submit.
      setPhase('submitting');
      setHint('Memverifikasi…');
      const embedding = descriptorToArray(detection);
      const photo = capturePhoto() ?? undefined;
      check.mutate(
        {
          employeeId,
          embedding,
          livenessPassed: true,
          lat: coords?.lat,
          lng: coords?.lng,
          photo,
          deviceInfo: { userAgent: navigator.userAgent },
        },
        {
          onSuccess: () => setPhase('done'),
          onError: () => {
            setPhase('error');
            setHint('Verifikasi gagal. Coba lagi.');
          },
        },
      );
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-border bg-ink/90">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/40" />
        {phase === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/90 text-white">
            <CheckCircle2 className="size-16" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-sm">
        {phase === 'liveness' && <Badge tone="purple">{CHALLENGE_LABEL[challenge]}</Badge>}
        <span className="text-ink-muted">{hint}</span>
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <div className="flex justify-center gap-3">
        {phase === 'init' && (
          <Button onClick={start} disabled={!ready}>
            {ready ? <ScanFace /> : <Loader2 className="animate-spin" />}
            {ready ? 'Mulai Pindai' : 'Memuat model…'}
          </Button>
        )}
        {phase === 'submitting' && (
          <Button disabled>
            <Loader2 className="animate-spin" /> Memverifikasi…
          </Button>
        )}
        {phase === 'error' && (
          <Button onClick={start} variant="secondary">
            <Camera /> Coba Lagi
          </Button>
        )}
        {phase === 'done' && (
          <Button onClick={() => router.push('/dashboard/absensi')}>Selesai</Button>
        )}
      </div>

      {coords && (
        <p className="text-center text-xs text-ink-subtle">
          Lokasi: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
        </p>
      )}
    </div>
  );
}
