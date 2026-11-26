<div align="center">

# Nexus ECM

### Enterprise Company Management System

A modern, full-featured, **100% open-source** people-operations platform for medium-to-large companies — HR, attendance, leave, projects, documents, and realtime chat in one app.

<p>
  <img alt="Status" src="https://img.shields.io/badge/status-active%20development-blue" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-100%25-3178c6" />
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-10-e0234e" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-336791" />
</p>

</div>

---

## ✨ Highlights

- **8 functional modules** + executive dashboard — a complete people-operations workspace in a single deployment.
- **Browser-based AI face recognition** for attendance — no paid cloud vision API, biometrics never leave the device.
- **Realtime chat** over Socket.IO (presence, typing, read receipts, @mentions, announcements).
- **Employee self-service** — scoped dashboard, attendance & leave for each employee, plus a shared company calendar.
- **Auto login provisioning** — creating an employee provisions their account (email + password) in one step.
- **Enterprise cross-cutting**: RBAC, full audit log, in-app notifications, global search, PDF/Excel reporting.
- **100% free / self-hostable stack** — Postgres, Redis, MinIO, all open source.
- **Production-ready**: multi-stage Docker images, `docker-compose.prod.yml`, health probes, deployment + pen-test guide.

---

## 🧩 Modules

| # | Module | What it does |
|---|--------|--------------|
| 1 | **Dashboard** | Role-scoped KPIs, recent activity feed, aggregation across modules |
| 2 | **Employees** | Departments, positions, employees (soft delete), job & salary history, document uploads |
| 3 | **Attendance** | Face-recognition enrollment + check-in/out, liveness challenge, GPS, audit photo, work schedules |
| 4 | **Leave** | Balances, requests with supporting docs, multi-step approval (Supervisor → Manager → HR) |
| 5 | **Projects** | CRUD, members, milestones, auto progress, budget tracking |
| 6 | **Tasks** | Assignees, priority, checklist, comments, attachments — **Kanban / Table / Calendar** views |
| 7 | **Documents** | Folder tree, version control, internal sharing, type tags (MinIO presigned URLs) |
| 8 | **Chat** | Realtime direct & group messaging, mentions, read receipts, company announcements |
| ⊹ | **Self-service** | Per-employee dashboard, attendance & leave, shared company calendar |
| ⊹ | **Cross-cutting** | RBAC, Audit Log viewer, Notification Center, Global Search (⌘K) |

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, TailwindCSS, TanStack Query/Table, Zustand, Recharts, dnd-kit |
| **Backend** | NestJS 10, TypeScript, Prisma ORM |
| **Database** | PostgreSQL 16 |
| **Cache / Realtime** | Redis 7 · Socket.IO |
| **Auth** | JWT access (15m) + refresh (7d) with rotation & reuse detection, Argon2id, RBAC |
| **Face Recognition** | `@vladmandic/face-api` (TensorFlow.js) — in the browser |
| **Object Storage** | MinIO (S3-compatible) — private bucket + presigned URLs |
| **Security** | Helmet, CORS lock, rate limiting, AES-256-GCM at rest (biometrics) |
| **Infra** | pnpm workspaces + Turborepo · Docker + Docker Compose |

---

## 🏛 Architecture

- **Modular monolith** — each business capability is an isolated NestJS module; splittable into microservices later.
- Global, reusable core services: `StorageService` (MinIO), `AuditService`, `CryptoService`, `NotificationService`.
- **Monorepo** managed with pnpm workspaces + Turborepo.

```
nexus-ecm/
├── apps/
│   ├── api/          # NestJS backend (modules, guards, core services)
│   └── web/          # Next.js 15 frontend (app router, features, UI kit)
├── packages/
│   ├── database/     # Prisma schema, migrations, seed
│   ├── shared/       # Shared types, constants, permission keys
│   └── config/       # Shared presets
├── docker/           # Dockerfiles + dev & prod compose
└── docs/             # Current system map and focused operational notes
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20, [pnpm](https://pnpm.io) ≥ 9, Docker (Docker Desktop or Colima)

### 1. Install & configure
```bash
pnpm install
cp .env.example .env          # adjust secrets if needed
```

### 2. Start infra (Postgres, Redis, MinIO, MailHog)
```bash
pnpm docker:up
```

### 3. Set up the database
```bash
pnpm db:migrate     # apply migrations
pnpm db:seed        # permissions, roles, super admin, master data
```

### 4. (Optional) Download face-recognition models
Required only for the attendance camera pages:
```bash
cd apps/web && node scripts/download-face-models.mjs
```

### 5. Run the apps
```bash
pnpm dev            # API on :4100, Web on :3100
```

| Service | URL |
|---|---|
| **Web app** | http://localhost:3100 |
| API | http://localhost:4100/api/v1 |
| Swagger / OpenAPI | http://localhost:4100/api/docs |
| MinIO console | http://localhost:9001 |
| MailHog inbox | http://localhost:8025 |

### Default login
```
Email:    admin
Password: Admin123!
```
> ⚠️ Change `SEED_ADMIN_PASSWORD` before seeding in any non-local environment.

---

## 🧪 Testing & Quality

```bash
pnpm typecheck                    # type-check all packages
pnpm build                        # build API + web
pnpm --filter @nexus/api test     # unit tests (jest)
```

---

## 📦 Deployment

Production images and compose configuration are in:

- [`docker/docker-compose.prod.yml`](docker/docker-compose.prod.yml)

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

---

## 📚 Documentation

| Doc | Description |
|---|---|
| [`docs/system-map.md`](docs/system-map.md) | Current modules, routes, data flows, and local services |
| [`docs/testing/`](docs/testing/) | Focused acceptance and pilot checklists |
| [`packages/database/schema.prisma`](packages/database/schema.prisma) | Complete Prisma schema |

---

## 🔐 Security at a glance

- Argon2id password hashing; JWT rotation with refresh-token reuse detection.
- Global `JwtAuthGuard` + `PermissionsGuard`; every endpoint declares required permissions.
- Input validation (`whitelist` + `forbidNonWhitelisted`), Helmet, locked CORS, rate limiting.
- Face embeddings encrypted at rest (AES-256-GCM); files via private bucket + presigned URLs.
- Full audit trail (who changed what, before/after) on every mutation.

Review environment secrets and HTTPS configuration before exposing the deployment publicly.

---

## 💸 Why "everything free"

| Need | Open-source choice (vs. paid) |
|---|---|
| Object storage | **MinIO** (vs. AWS S3) |
| Face recognition | **face-api.js / TF.js** in-browser (vs. AWS Rekognition / Azure Face) |
| Email | **MailHog** (dev) / free SMTP tier (prod) |
| Database / cache | **PostgreSQL** / **Redis** |
| Hosting | Docker Compose on any VPS / free tiers |

---

## 📄 License

MIT.
