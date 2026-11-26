'use client';

/* eslint-disable @next/next/no-img-element -- the crop source is a local object URL. */

import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const PREVIEW_SIZE = 288;
const PORTRAIT_PREVIEW = { width: 224, height: 288 };
const CIRCLE_OUTPUT = 128;
const PORTRAIT_OUTPUT = { width: 448, height: 576 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface AvatarCropDialogProps {
  file: File;
  sourceUrl: string;
  shape: 'circle' | 'portrait';
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

export function AvatarCropDialog({ file, sourceUrl, shape, onCancel, onConfirm }: AvatarCropDialogProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number }>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const previewWidth = shape === 'portrait' ? PORTRAIT_PREVIEW.width : PREVIEW_SIZE;
  const previewHeight = shape === 'portrait' ? PORTRAIT_PREVIEW.height : PREVIEW_SIZE;
  const outputWidth = shape === 'portrait' ? PORTRAIT_OUTPUT.width : CIRCLE_OUTPUT;
  const outputHeight = shape === 'portrait' ? PORTRAIT_OUTPUT.height : CIRCLE_OUTPUT;
  const baseScale = useMemo(() => dimensions.width && dimensions.height
    ? Math.max(previewWidth / dimensions.width, previewHeight / dimensions.height)
    : 1, [dimensions, previewHeight, previewWidth]);
  const renderedWidth = dimensions.width * baseScale * zoom;
  const renderedHeight = dimensions.height * baseScale * zoom;
  const maxOffsetX = Math.max(0, (renderedWidth - previewWidth) / 2);
  const maxOffsetY = Math.max(0, (renderedHeight - previewHeight) / 2);

  useEffect(() => {
    setOffset((current) => ({
      x: clamp(current.x, -maxOffsetX, maxOffsetX),
      y: clamp(current.y, -maxOffsetY, maxOffsetY),
    }));
  }, [maxOffsetX, maxOffsetY]);

  const moveImage = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setOffset({
      x: clamp(dragRef.current.offsetX + event.clientX - dragRef.current.pointerX, -maxOffsetX, maxOffsetX),
      y: clamp(dragRef.current.offsetY + event.clientY - dragRef.current.pointerY, -maxOffsetY, maxOffsetY),
    });
  };

  const cropImage = async () => {
    const image = imageRef.current;
    if (!image || !dimensions.width || !dimensions.height) return;
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');
      context.fillStyle = '#f1f0f5';
      context.fillRect(0, 0, outputWidth, outputHeight);
      const outputScaleX = outputWidth / previewWidth;
      const outputScaleY = outputHeight / previewHeight;
      context.drawImage(
        image,
        ((previewWidth - renderedWidth) / 2 + offset.x) * outputScaleX,
        ((previewHeight - renderedHeight) / 2 + offset.y) * outputScaleY,
        renderedWidth * outputScaleX,
        renderedHeight * outputScaleY,
      );
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('Cannot crop avatar')),
        'image/jpeg',
        0.9,
      ));
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'avatar';
      onConfirm(new File([blob], `${baseName}-${shape}.jpg`, { type: 'image/jpeg' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="top-[5%] max-h-[90vh] max-w-md overflow-y-auto p-6">
      <DialogTitle>{shape === 'portrait' ? 'Căn ảnh chân dung' : 'Căn icon tròn'}</DialogTitle>
      <DialogDescription className="sr-only">Điều chỉnh vùng ảnh đại diện trước khi tải lên.</DialogDescription>
      <div className="mt-5 space-y-5">
        <div
          className={`relative mx-auto touch-none cursor-grab overflow-hidden bg-[#f1f0f5] active:cursor-grabbing ${shape === 'portrait' ? 'h-72 w-56 rounded-2xl' : 'size-72 rounded-full'}`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, offsetX: offset.x, offsetY: offset.y };
          }}
          onPointerMove={moveImage}
          onPointerUp={() => { dragRef.current = undefined; }}
          onPointerCancel={() => { dragRef.current = undefined; }}
        >
          <img
            ref={imageRef}
            crossOrigin="anonymous"
            src={sourceUrl}
            alt="Ảnh đang căn"
            draggable={false}
            onLoad={(event) => {
              const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
              setDimensions({ width, height });
              // Give portrait shots enough breathing room to match the final
              // circular avatar instead of cropping tightly around the face.
              setZoom(shape === 'circle' && height > width * 1.05 ? 0.8 : 1);
            }}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width: renderedWidth || PREVIEW_SIZE,
              height: renderedHeight || PREVIEW_SIZE,
              left: `calc(50% + ${offset.x}px)`,
              top: `calc(50% + ${offset.y}px)`,
              transform: 'translate(-50%, -50%)',
            }}
          />
          <div className={`pointer-events-none absolute inset-0 border-4 border-white/90 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.2)] ${shape === 'portrait' ? 'rounded-2xl' : 'rounded-full'}`} />
          <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-white/25" />
          <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-white/25" />
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Phóng to
          <input type="range" min="0.5" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-ink" />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button type="button" disabled={saving || !dimensions.width} onClick={() => void cropImage()}>{saving ? 'Đang xử lý…' : 'Dùng ảnh này'}</Button>
        </div>
      </div>
    </DialogContent>
  );
}
