'use client';

/* eslint-disable @next/next/no-img-element -- local object URLs are needed for canvas cropping and pixel reads. */

import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library';
import { Camera, CheckCircle2, CreditCard, ScanLine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type IdCardData = { identityCode?: string; fullName?: string; dateOfBirth?: string; gender?: 'MALE' | 'FEMALE'; address?: string };
type Point = { x: number; y: number };
type Corners = [Point, Point, Point, Point];
const DEFAULT_CORNERS: Corners = [{ x: 0.08, y: 0.18 }, { x: 0.92, y: 0.18 }, { x: 0.92, y: 0.76 }, { x: 0.08, y: 0.76 }];
export type PreparedIdentityFiles = { prepare?: () => Promise<{ front?: File; back?: File }> };

export function parseVietnameseIdQr(value: string): IdCardData | null {
  const parts = value.split('|').map((part) => part.trim()).filter(Boolean);
  const identityIndex = parts.findIndex((part) => /^\d{9,12}$/.test(part));
  if (identityIndex < 0) return null;
  const dateIndex = parts.findIndex((part) => /^\d{2}[\/-]\d{2}[\/-]\d{4}$|^\d{8}$/.test(part));
  const genderIndex = parts.findIndex((part) => /^(nam|nữ|nu|male|female)$/i.test(part));
  const name = parts.slice(identityIndex + 1, dateIndex > identityIndex ? dateIndex : undefined).find((part) => /[A-Za-zÀ-ỹ]/.test(part));
  const dob = dateIndex < 0 ? undefined : parts[dateIndex].includes('/') || parts[dateIndex].includes('-') ? parts[dateIndex].split(/[\/-]/).reverse().join('-') : `${parts[dateIndex].slice(4, 8)}-${parts[dateIndex].slice(2, 4)}-${parts[dateIndex].slice(0, 2)}`;
  const gender = genderIndex < 0 ? '' : parts[genderIndex].toLowerCase();
  const address = parts.slice(genderIndex >= 0 ? genderIndex + 1 : dateIndex + 1).find((part) => /[A-Za-zÀ-ỹ]/.test(part));
  return { identityCode: parts[identityIndex], fullName: name?.toLocaleUpperCase('vi-VN'), dateOfBirth: dob, gender: /^(nam|male)$/i.test(gender) ? 'MALE' : /^(nữ|nu|female)$/i.test(gender) ? 'FEMALE' : undefined, address };
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try { return await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; }); }
  finally { URL.revokeObjectURL(url); }
}

function decodePixels(data: Uint8ClampedArray, width: number, height: number) {
  const direct = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })?.data;
  if (direct) return direct;
  try {
    const reader = new MultiFormatReader(); const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]); hints.set(DecodeHintType.TRY_HARDER, true); reader.setHints(hints);
    return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(data, width, height)))).getText();
  } catch { return null; }
}

function scanSource(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return null;
  context.drawImage(source, 0, 0, width, height);
  return decodePixels(context.getImageData(0, 0, width, height).data, width, height);
}

function scanImageRegion(image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return null;
  context.drawImage(image, x, y, width, height, 0, 0, width, height);
  return decodePixels(context.getImageData(0, 0, width, height).data, width, height);
}

async function scanFile(file: File) {
  const image = await loadImage(file);
  const full = scanSource(image, image.naturalWidth, image.naturalHeight);
  if (full) return full;
  // The QR on Vietnamese ID cards is normally in the upper-right corner.
  // Trying a few focused regions keeps detection reliable when the photo has a wide border.
  const regions = [
    [0.5, 0, 0.5, 0.6], [0.58, 0.08, 0.42, 0.5], [0.64, 0.15, 0.32, 0.38],
  ] as const;
  for (const [left, top, regionWidth, regionHeight] of regions) {
    const width = Math.round(image.naturalWidth * regionWidth); const height = Math.round(image.naturalHeight * regionHeight);
    const result = scanImageRegion(image, Math.round(image.naturalWidth * left), Math.round(image.naturalHeight * top), width, height);
    if (result) return result;
  }
  return null;
}

function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }

function solveLinearSystem(matrix: number[][]) {
  const size = matrix.length;
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    if (Math.abs(divisor) < 0.0000001) throw new Error('Invalid corners');
    for (let value = column; value <= size; value += 1) matrix[column][value] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let value = column; value <= size; value += 1) matrix[row][value] -= factor * matrix[column][value];
    }
  }
  return matrix.map((row) => row[size]);
}

/** Maps the normalized output rectangle to its four selected source corners. */
function outputToSourceMatrix(corners: Corners) {
  const destination = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
  const matrix: number[][] = [];
  destination.forEach(([u, v], index) => {
    const { x, y } = corners[index];
    matrix.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    matrix.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  });
  return solveLinearSystem(matrix);
}

async function cropFile(file: File, corners: Corners) {
  const image = await loadImage(file);
  const horizontal = (distance(corners[0], corners[1]) + distance(corners[3], corners[2])) * image.naturalWidth / 2;
  const vertical = (distance(corners[0], corners[3]) + distance(corners[1], corners[2])) * image.naturalHeight / 2;
  const scale = Math.min(1, 1800 / Math.max(horizontal, vertical));
  const width = Math.max(1, Math.round(horizontal * scale)); const height = Math.max(1, Math.round(vertical * scale));
  const sourceCanvas = document.createElement('canvas'); sourceCanvas.width = image.naturalWidth; sourceCanvas.height = image.naturalHeight;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true }); if (!sourceContext) return file;
  sourceContext.drawImage(image, 0, 0);
  const source = sourceContext.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
  const outputCanvas = document.createElement('canvas'); outputCanvas.width = width; outputCanvas.height = height;
  const outputContext = outputCanvas.getContext('2d'); if (!outputContext) return file;
  const output = outputContext.createImageData(width, height); const transform = outputToSourceMatrix(corners);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const u = width === 1 ? 0 : x / (width - 1); const v = height === 1 ? 0 : y / (height - 1);
    const divisor = transform[6] * u + transform[7] * v + 1;
    const sourceX = Math.max(0, Math.min(image.naturalWidth - 1, Math.round(((transform[0] * u + transform[1] * v + transform[2]) / divisor) * image.naturalWidth)));
    const sourceY = Math.max(0, Math.min(image.naturalHeight - 1, Math.round(((transform[3] * u + transform[4] * v + transform[5]) / divisor) * image.naturalHeight)));
    const sourceIndex = (sourceY * image.naturalWidth + sourceX) * 4; const outputIndex = (y * width + x) * 4;
    output.data[outputIndex] = source.data[sourceIndex]; output.data[outputIndex + 1] = source.data[sourceIndex + 1]; output.data[outputIndex + 2] = source.data[sourceIndex + 2]; output.data[outputIndex + 3] = 255;
  }
  outputContext.putImageData(output, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => outputCanvas.toBlob(resolve, 'image/jpeg', 0.95));
  return blob ? new File([blob], 'can-cuoc-da-can-chinh.jpg', { type: 'image/jpeg', lastModified: file.lastModified }) : file;
}

function usePreview(file?: File) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { if (!file) { setUrl(undefined); return; } const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  return url;
}

const ID_CARD_RATIO = 85.6 / 53.98;

function CropFrame({ preview, corners, onChange }: { preview: string; corners: Corners; onChange: (corners: Corners) => void }) {
  const activeCorner = useRef<number>();
  const [ratio, setRatio] = useState(1.6);
  const horizontalCrop = ratio > ID_CARD_RATIO;
  const visibleWidth = horizontalCrop ? ID_CARD_RATIO / ratio : 1;
  const visibleHeight = horizontalCrop ? 1 : ratio / ID_CARD_RATIO;
  const offsetX = (1 - visibleWidth) / 2;
  const offsetY = (1 - visibleHeight) / 2;
  const toScreen = (point: Point) => ({ x: (point.x - offsetX) / visibleWidth, y: (point.y - offsetY) / visibleHeight });
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (activeCorner.current === undefined) return; const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.max(0, Math.min(1, offsetX + ((event.clientX - rect.left) / rect.width) * visibleWidth)),
      y: Math.max(0, Math.min(1, offsetY + ((event.clientY - rect.top) / rect.height) * visibleHeight)),
    };
    onChange(corners.map((corner, index) => index === activeCorner.current ? point : corner) as Corners);
  };
  const visibleCorners = corners.map(toScreen);
  return <div className="relative aspect-[1.586/1] w-full touch-none overflow-hidden" onPointerMove={move} onPointerUp={() => { activeCorner.current = undefined; }} onPointerCancel={() => { activeCorner.current = undefined; }}>
    <img src={preview} alt="Căn cước cần cắt" className="h-full w-full object-cover" draggable={false} onLoad={(event) => setRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} />
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none"><path fill="rgba(0,0,0,.45)" fillRule="evenodd" d={`M0 0H100V100H0ZM${visibleCorners.map((point) => `${point.x * 100} ${point.y * 100}`).join('L')}Z`} /><polygon points={visibleCorners.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')} fill="none" stroke="white" strokeWidth="1" />{visibleCorners.map((point, index) => <circle key={index} cx={point.x * 100} cy={point.y * 100} r="3" fill="#7c3aed" stroke="white" strokeWidth="1" className="cursor-grab active:cursor-grabbing" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); activeCorner.current = index; }} />)}</svg>
  </div>;
}

function QrCamera({ onResult, onClose }: { onResult: (data: IdCardData) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream>();
  const [error, setError] = useState('');
  useEffect(() => { let timer: ReturnType<typeof setInterval> | undefined; navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }).then((stream) => { streamRef.current = stream; const video = videoRef.current; if (!video) return; video.srcObject = stream; timer = setInterval(() => { if (!video.videoWidth) return; const raw = scanSource(video, video.videoWidth, video.videoHeight); const data = raw ? parseVietnameseIdQr(raw) : null; if (data) { onResult(data); onClose(); } }, 350); }).catch(() => setError('Không mở được camera.')).catch(() => undefined); return () => { if (timer) clearInterval(timer); streamRef.current?.getTracks().forEach((track) => track.stop()); }; }, [onClose, onResult]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-md overflow-hidden rounded-2xl bg-card"><div className="flex items-center justify-between p-4"><b>Quét mã QR</b><button type="button" onClick={onClose}><X /></button></div>{error ? <p className="p-4 text-sm text-red-600">{error}</p> : <video ref={videoRef} autoPlay playsInline className="aspect-square w-full object-cover" />}</div></div>;
}

export function IdCardQrCapture({ onData, onFiles }: { onData: (data: IdCardData) => void; onFiles: (files: PreparedIdentityFiles) => void }) {
  const [front, setFront] = useState<File>(); const [back, setBack] = useState<File>();
  const [frontCorners, setFrontCorners] = useState<Corners>(DEFAULT_CORNERS); const [backCorners, setBackCorners] = useState<Corners>(DEFAULT_CORNERS);
  const [confirmedFront, setConfirmedFront] = useState<File>(); const [confirmedBack, setConfirmedBack] = useState<File>();
  const [processing, setProcessing] = useState<'front' | 'back'>();
  const [qrFailed, setQrFailed] = useState(false); const [cameraOpen, setCameraOpen] = useState(false); const [message, setMessage] = useState('');
  const frontPreview = usePreview(front); const backPreview = usePreview(back); const confirmedFrontPreview = usePreview(confirmedFront); const confirmedBackPreview = usePreview(confirmedBack);
  useEffect(() => { onFiles({ prepare: async () => ({ front: confirmedFront, back: confirmedBack }) }); }, [confirmedBack, confirmedFront, onFiles]);
  const readFront = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setFront(file); setFrontCorners(DEFAULT_CORNERS); setConfirmedFront(undefined); setQrFailed(false); setMessage(''); };
  const readBack = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) { setBack(file); setBackCorners(DEFAULT_CORNERS); setConfirmedBack(undefined); } };
  const confirmFront = async () => { if (!front) return; setProcessing('front'); setQrFailed(false); setMessage(''); try { const corrected = await cropFile(front, frontCorners); setConfirmedFront(corrected); const raw = await scanFile(corrected); const data = raw ? parseVietnameseIdQr(raw) : null; if (data) { onData(data); setMessage('Đã điền dữ liệu từ QR.'); } else setQrFailed(true); } catch { setQrFailed(true); } finally { setProcessing(undefined); } };
  const confirmBack = async () => { if (!back) return; setProcessing('back'); try { setConfirmedBack(await cropFile(back, backCorners)); } finally { setProcessing(undefined); } };
  const changeFrontCorners = (corners: Corners) => { setFrontCorners(corners); setConfirmedFront(undefined); setQrFailed(false); setMessage(''); };
  const changeBackCorners = (corners: Corners) => { setBackCorners(corners); setConfirmedBack(undefined); };
  const clearFront = () => { setFront(undefined); setFrontCorners(DEFAULT_CORNERS); setConfirmedFront(undefined); setQrFailed(false); setMessage(''); }; const clearBack = () => { setBack(undefined); setBackCorners(DEFAULT_CORNERS); setConfirmedBack(undefined); };
  return <section className="rounded-card border border-purple-200 bg-purple-50/40 p-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-purple-100 p-2 text-purple-700"><CreditCard className="size-5" /></span><h3 className="font-semibold">Quét căn cước công dân</h3></div><div className="mt-4 grid gap-5 md:grid-cols-2"><CardInput preview={frontPreview} confirmedPreview={confirmedFrontPreview} corners={frontCorners} onCorners={changeFrontCorners} onChange={readFront} onRemove={clearFront} onConfirm={confirmFront} processing={processing === 'front'} confirmed={Boolean(confirmedFront)} inputLabel="Chọn ảnh mặt trước" /><CardInput preview={backPreview} confirmedPreview={confirmedBackPreview} corners={backCorners} onCorners={changeBackCorners} onChange={readBack} onRemove={clearBack} onConfirm={confirmBack} processing={processing === 'back'} confirmed={Boolean(confirmedBack)} inputLabel="Chọn ảnh mặt sau" /></div>{qrFailed && <Button type="button" variant="secondary" className="mt-3" onClick={() => setCameraOpen(true)}><ScanLine /> Quét QR bằng camera</Button>}{message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}{cameraOpen && <QrCamera onResult={(data) => { onData(data); setMessage('Đã điền dữ liệu từ QR.'); setQrFailed(false); }} onClose={() => setCameraOpen(false)} />}</section>;
}

function CardInput({ preview, confirmedPreview, corners, onCorners, onChange, onRemove, onConfirm, processing, confirmed, inputLabel }: { preview?: string; confirmedPreview?: string; corners: Corners; onCorners: (corners: Corners) => void; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void; onConfirm: () => void; processing: boolean; confirmed: boolean; inputLabel: string }) {
  return <div className="space-y-2"><div className="aspect-[1.586/1] overflow-hidden rounded-xl border border-dashed border-purple-300 bg-card">{confirmedPreview ? <img src={confirmedPreview} alt={inputLabel} className="h-full w-full object-cover" /> : preview ? <CropFrame preview={preview} corners={corners} onChange={onCorners} /> : <label aria-label={inputLabel} className="flex h-full w-full cursor-pointer items-center justify-center text-purple-700"><Camera className="size-6" /><input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onChange} /></label>}</div>{preview && <div className="flex items-center gap-2"><Button type="button" variant={confirmed ? 'secondary' : 'primary'} size="sm" disabled={processing} onClick={onConfirm}>{processing ? 'Đang căn…' : confirmed ? 'Đã xác nhận' : 'Xác nhận'}</Button><Button type="button" variant="ghost" size="icon" aria-label={`Bỏ ${inputLabel}`} onClick={onRemove}><X /></Button></div>}</div>;
}
