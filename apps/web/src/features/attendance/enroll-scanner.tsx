'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFaceCamera } from './face/useFaceCamera';
import { detectSingleFace, descriptorToArray } from './face/detectFace';
import { checkQuality } from './face/quality';
import { useEnrollFace } from './api';

const TARGET_FRAMES = 5;

export function EnrollScanner({ employeeId, onComplete }: { employeeId: string; onComplete?: () => void }) {
  const router = useRouter();
  const { videoRef, ready, error, capturePhoto } = useFaceCamera();
  const enroll = useEnrollFace();

  const [capturing, setCapturing] = useState(false);
  const [count, setCount] = useState(0);
  const [hint, setHint] = useState('Nhấn bắt đầu để ghi nhận một số mẫu khuôn mặt');
  const descriptorsRef = useRef<number[][]>([]);
  const rafRef = useRef<number | null>(null);

  const start = () => {
    descriptorsRef.current = [];
    setCount(0);
    setCapturing(true);
    const tick = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const detection = await detectSingleFace(video);
      if (!detection) {
        setHint('Không nhận diện được khuôn mặt');
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const quality = checkQuality(detection);
      if (!quality.ok) {
        setHint(quality.reason ?? 'Hãy điều chỉnh lại vị trí khuôn mặt');
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      descriptorsRef.current.push(descriptorToArray(detection));
      const n = descriptorsRef.current.length;
      setCount(n);
      setHint(`Merekam sampel ${n}/${TARGET_FRAMES}…`);

      if (n >= TARGET_FRAMES) {
        setCapturing(false);
        const sampleImage = capturePhoto() ?? undefined;
        enroll.mutate(
          { employeeId, embeddings: descriptorsRef.current, sampleImage },
          { onSuccess: () => setHint('Đăng ký hoàn tất!') },
        );
        return;
      }
      // Small delay between captures for varied frames.
      setTimeout(() => {
        rafRef.current = requestAnimationFrame(tick);
      }, 400);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const done = enroll.isSuccess;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-border bg-ink/90">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/40" />
        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/90 text-white">
            <CheckCircle2 className="size-16" />
          </div>
        )}
      </div>

      <div className="text-center text-sm text-ink-muted">{hint}</div>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <div className="flex justify-center gap-3">
        {!capturing && !done && (
          <Button onClick={start} disabled={!ready || enroll.isPending}>
            {ready ? <ScanFace /> : <Loader2 className="animate-spin" />}
            {enroll.isPending ? 'Đang lưu…' : ready ? 'Bắt đầu quét' : 'Đang tải mô hình…'}
          </Button>
        )}
        {capturing && (
          <Button disabled>
            <Loader2 className="animate-spin" /> Merekam {count}/{TARGET_FRAMES}
          </Button>
        )}
        {done && <Button onClick={() => onComplete ? onComplete() : router.push('/dashboard/absensi')}>Hoàn tất</Button>}
      </div>
    </div>
  );
}
