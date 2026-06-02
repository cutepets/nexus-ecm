# Face-API model weights

The attendance face recognition (Phase 5) loads model weights from `/models`
(this folder) **in the browser**. The weight files are not committed; download
them once:

```bash
# from apps/web
node scripts/download-face-models.mjs
```

This fetches the four models used by `features/attendance/face/loadModels.ts`:

- `tiny_face_detector` — fast face detection
- `face_landmark_68` — 68-point landmarks (used for liveness)
- `face_recognition` — 128-d descriptor (used for matching)
- `face_expression` — expressions (auxiliary liveness signal)

Source: <https://github.com/vladmandic/face-api/tree/master/model> (MIT).

Without these files the camera pages will show a "could not load face models"
error; everything else in the app works normally.
