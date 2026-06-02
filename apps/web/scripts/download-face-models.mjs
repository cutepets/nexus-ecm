#!/usr/bin/env node
/**
 * Downloads the face-api model weights used by Phase 5 (attendance) into
 * apps/web/public/models. Run once: `node scripts/download-face-models.mjs`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';

// Manifest + shard files for each model we load in the browser.
const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
  'face_expression_model-weights_manifest.json',
  'face_expression_model.bin',
];

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');

await mkdir(outDir, { recursive: true });

for (const file of FILES) {
  process.stdout.write(`↓ ${file} … `);
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) {
    console.error(`FAILED (${res.status})`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(join(outDir, file), buf);
  console.log(`ok (${(buf.length / 1024).toFixed(0)} KB)`);
}

console.log('✅ Face models ready in public/models');
