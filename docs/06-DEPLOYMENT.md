# Deployment & Hardening Guide
### Nexus ECM — Phase 14

This guide covers production deployment, secrets, storage, migrations, TLS, and
a security checklist.

---

## 1. Prerequisites
- Docker + Docker Compose v2 on the host.
- A domain with DNS pointing at the host (for TLS).
- Outbound SMTP credentials (production mail; MailHog is dev-only).

---

## 2. Environment & secrets
Copy `.env.example` → `.env` and set **strong** values. Critical secrets:

| Var | Notes |
|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ≥ 32 random chars, **distinct**. Rotate on incident. |
| `FACE_ENCRYPTION_KEY` | 64 hex chars (32 bytes). Encrypts face embeddings at rest. **Losing it makes enrolled faces unverifiable.** |
| `POSTGRES_PASSWORD` | strong, unique |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | strong, unique |
| `SEED_ADMIN_PASSWORD` | change before first seed; rotate after first login |
| `CORS_ORIGIN` | exact web origin(s), comma-separated. No wildcards in prod. |

Generate secrets:
```bash
openssl rand -hex 32   # JWT secrets
openssl rand -hex 32   # FACE_ENCRYPTION_KEY (64 hex chars)
```

---

## 3. Build & run
```bash
# from repo root
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```
Services: `postgres`, `redis`, `minio` (+`minio-init` bucket), `api` (:4000), `web` (:3000).

### First-time DB setup (run once)
```bash
# apply migrations
docker compose -f docker/docker-compose.prod.yml exec api \
  sh -c "cd packages/database && npx prisma migrate deploy"
# seed permissions, roles, super admin, master data
docker compose -f docker/docker-compose.prod.yml exec api \
  sh -c "cd packages/database && npx tsx seed.ts"
```

### Face-recognition models (web)
Download model weights into `apps/web/public/models` before building the web image:
```bash
cd apps/web && node scripts/download-face-models.mjs
```

---

## 4. MinIO buckets
`minio-init` creates `${MINIO_BUCKET}` automatically. Objects are served via
**presigned URLs** only — keep the bucket private (no anonymous access). For
public TLS access to MinIO, front it with the reverse proxy too.

---

## 5. Reverse proxy / TLS (example: Caddy)
```
api.example.com {
    reverse_proxy localhost:4000
}
app.example.com {
    reverse_proxy localhost:3000
}
```
Caddy auto-provisions Let's Encrypt certs. Set `CORS_ORIGIN=https://app.example.com`
and `NEXT_PUBLIC_API_URL=https://api.example.com/api/v1`. The Socket.IO chat
namespace (`/chat`) is served by the API origin and proxied the same way
(WebSocket upgrade is handled by Caddy automatically).

---

## 6. Backups
```bash
# Postgres
docker compose -f docker/docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
# MinIO: mirror the bucket
mc mirror local/nexus-files ./minio-backup
```
Schedule daily via cron; keep ≥ 7 days offsite.

---

## 7. Security checklist (pen-test)
- [x] **AuthN**: Argon2id password hashing; JWT access (15m) + refresh (7d) with rotation & reuse detection (revokes all on reuse).
- [x] **AuthZ**: global `JwtAuthGuard` + `PermissionsGuard`; every endpoint declares `@RequirePermissions`; SUPER_ADMIN bypass is explicit.
- [x] **Input validation**: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) — rejects unknown fields.
- [x] **Headers**: Helmet enabled. **CORS** locked to `CORS_ORIGIN` with credentials.
- [x] **Rate limiting**: `@nestjs/throttler` (configurable TTL/limit).
- [x] **CSRF**: tokens are sent via `Authorization` header (not cookies) → CSRF surface minimal; do not move tokens to cookies without adding CSRF protection.
- [x] **Sensitive data**: face embeddings encrypted at rest (AES-256-GCM); files via presigned URLs (private bucket); audit log records all mutations.
- [x] **Audit**: `AuditService` logs CREATE/UPDATE/DELETE/APPROVE/REJECT with before/after + actor + IP/UA.
- [ ] **TODO before go-live**: dependency audit (`pnpm audit`), set CSP at the proxy for the web app, enable Postgres TLS, restrict MinIO/Redis to the internal network (remove host port mappings), configure real SMTP, and a privacy data-deletion runbook (purge `FaceProfile` + audit photos on request).

---

## 8. Health & observability
- API health: `GET /api/v1/health`.
- Swagger/OpenAPI: `GET /api/docs` (disable or protect in prod if not needed).
- Logs: `docker compose -f docker/docker-compose.prod.yml logs -f api web`.

---

## 9. Test & CI
- Unit tests: `pnpm --filter @nexus/api test` (e.g. embedding/match logic).
- Recommended CI gates: `pnpm -r typecheck`, `pnpm -r build`, `prisma validate`, `pnpm --filter @nexus/api test`.
