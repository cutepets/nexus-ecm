# Face Recognition Architecture
### Nexus ECM — Module 3 (Attendance)

## 1. Library recommendation

**Primary choice: [`@vladmandic/face-api`](https://github.com/vladmandic/face-api)**
— a modern, actively-maintained fork of `face-api.js` built on **TensorFlow.js**. It runs entirely in the
browser (WebGL/WASM), is free/open-source (MIT), and provides everything we need: face detection, 68-point
landmarks, a 128-d recognition embedding, and expression/age models usable for a basic liveness check.

| Option | Verdict |
|---|---|
| **@vladmandic/face-api** ✅ | Best fit. Maintained, TF.js-based, 128-d embeddings, runs in browser, free. **Recommended.** |
| Original `face-api.js` | Works but unmaintained (TF.js v1). Use the fork instead. |
| `@tensorflow-models/face-landmarks-detection` (MediaPipe/BlazeFace) | Great fast detection + landmarks but **no built-in recognition embedding** — you'd add your own. Good complement for liveness. |
| `human` (@vladmandic/human) | Heavier all-in-one (detection + recognition + liveness/anti-spoof). Excellent if you want stronger built-in liveness; larger bundle. **Strong alternative if anti-spoofing is a priority.** |
| Cloud (AWS Rekognition / Azure Face) | ❌ Not free, sends biometric data off-device. Rejected per "everything free" + privacy. |

**Decision:** use **`@vladmandic/face-api`** for detection + embedding, optionally layer
**`@vladmandic/human`** later if stronger anti-spoofing is required.

### Models to download into `apps/web/public/models/`
- `tiny_face_detector` (fast detection) **or** `ssd_mobilenetv1` (more accurate)
- `face_landmark_68`
- `face_recognition` (produces the 128-d descriptor)
- `face_expression` (used in the liveness/blink heuristic)

---

## 2. Why client-side matching

- **Privacy:** raw camera frames never leave the device. Only the 128-d *embedding* (a non-reversible
  vector) and a single audit photo are sent to the server.
- **Free & scalable:** inference cost is on the client; the server does cheap vector math only when needed.
- **Latency:** no round-trip to a vision API; match in < 1.5 s.

The server stores embeddings (`FaceProfile.embedding` as `Bytes`) and verifies/deduplicates by computing
**Euclidean distance** between embeddings. A distance **< 0.5–0.6** (tunable) is a match.

---

## 3. Enrollment flow (new employee)

```
[Browser]                                  [API]
1. Load face-api models (once)
2. Capture N frames (e.g. 5) from webcam
3. For each frame:
     - detect single face (reject 0 or >1)
     - check quality: box size, brightness, sharpness, frontal pose
4. Compute 128-d descriptor per good frame
5. Average / keep top-K descriptors
6. POST /attendance/face/enroll  ───────►  7. Dedup check: compare to ALL existing
   { employeeId, embeddings[], sample }       FaceProfile embeddings.
                                               If min-distance < threshold → 409 "face
                                               already enrolled to another employee"
                                            8. Store FaceProfile rows (embedding=Bytes,
                                               quality, sampleImageUrl in MinIO)
                                            9. Audit log CREATE FaceProfile
```

**Quality gates (client):** detection score ≥ 0.7, face box ≥ 100px, brightness within range,
landmarks indicate roughly frontal pose. Reject and re-prompt otherwise.

**Duplicate-face detection (server):** on enroll, scan existing embeddings; reject if too similar to a
*different* employee. (DB-side: linear scan is fine for SMB scale; add `pgvector` later for large orgs.)

---

## 4. Check-In / Check-Out flow

```
[Browser]                                            [API]
1. Open /attendance/check-in
2. Request camera + geolocation permission
3. Load models, start video
4. LIVENESS challenge (anti-spoofing):
     - prompt "blink" / "turn head left"
     - track eye-aspect-ratio (landmarks) + expression
     - require change across frames → livenessPassed=true
5. Detect face → compute 128-d descriptor
6. Match locally against the employee's own profile
   (self-service) OR fetch candidate embeddings:
     GET /attendance/face/candidates ───────────►   returns active employees' embeddings
   pick best match (min distance)                     (or do server-side verify)
7. Show matched name + confidence
8. Capture audit photo (downscaled jpeg)
9. POST /attendance/check-in ──────────────────►   10. Validate: matchScore, livenessPassed,
   { employeeId, matchScore, livenessPassed,           GPS present, within geofence (optional)
     lat, lng, photo(base64/blob), deviceInfo }     11. Determine status:
                                                          checkInAt vs schedule.startTime+grace
                                                          → PRESENT or LATE
                                                     12. Upsert Attendance (unique employeeId+workDate)
                                                     13. Store photo in MinIO, audit log
```

Check-Out is identical but updates `checkOutAt`, `checkOut*` fields on the same day's record.

**Persisted per scan (per SRS FR-ATT-7):** timestamp, GPS lat/lng, captured photo URL, device info (JSON),
attendance status, match score, liveness flag.

---

## 5. Anti-spoofing (basic, free)

Layered heuristics — no paid liveness service:
1. **Active challenge:** randomized "blink" / "turn head" prompt; verify via landmark motion
   (eye-aspect-ratio drop for blink, nose-x shift for turn) across consecutive frames.
2. **Texture / moiré sanity:** reject very low-variance (flat photo) frames.
3. **Single-face + depth-ish pose change:** a printed photo can't satisfy the motion challenge easily.
4. (Optional upgrade) swap in **@vladmandic/human** which ships a dedicated anti-spoof model.

Store `livenessPassed`; reject check-in if false.

---

## 6. Data & storage

| Data | Where | Notes |
|---|---|---|
| Face embedding (128-d) | `FaceProfile.embedding` (`Bytes`) | Float32Array serialized; **encrypted at rest** |
| Enrollment sample image | MinIO (optional) | Can be discarded after embedding for privacy |
| Check-in/out audit photo | MinIO | Downscaled JPEG, presigned URL access |
| Match metadata | `Attendance` | score, liveness, GPS, device |

**Scaling note:** for thousands of employees, replace the linear embedding scan with **PostgreSQL
`pgvector`** (store embeddings as `vector(128)`, use an IVFFlat/HNSW index for nearest-neighbor search).
v1 keeps it simple with `Bytes` + in-app comparison.

---

## 7. Client utility shape (frontend)

```
features/attendance/face/
├── loadModels.ts        # idempotent model loader from /public/models
├── detectFace.ts        # returns detection + landmarks + descriptor
├── quality.ts           # brightness/size/pose gates
├── liveness.ts          # blink / head-turn challenge state machine
├── match.ts             # euclideanDistance + bestMatch(threshold)
└── useFaceCamera.ts     # React hook: video stream + capture frame/photo
```

---

## 8. Security & privacy considerations
- Biometric embeddings are sensitive PII — encrypt at rest, restrict access via RBAC (`attendance:face:*`).
- All face endpoints are audited.
- Provide an employee data-deletion path that purges `FaceProfile` + audit photos.
- Never transmit raw video; only embeddings + a single compressed audit still.
