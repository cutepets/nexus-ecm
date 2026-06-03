<div align="center">

# Nexus ECM

### Enterprise Company Management System

A modern, full-featured, **100% open-source** management platform for medium-to-large companies — HR, attendance, leave, projects, finance, inventory, CRM, documents, and realtime chat in one app.

<p>
  <img alt="Status" src="https://img.shields.io/badge/status-complete%20(14%2F14%20phases)-brightgreen" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-100%25-3178c6" />
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-10-e0234e" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-336791" />
</p>

</div>

---

## ✨ Highlights

- **11 functional modules** + executive dashboard — a complete back-office in a single deployment.
- **Browser-based AI face recognition** for attendance — no paid cloud vision API, biometrics never leave the device.
- **Realtime chat** over Socket.IO (presence, typing, read receipts, @mentions, announcements).
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
| 7 | **Finance** | Invoices + line items + payments, expenses, reimbursements, **Excel + PDF reports** |
| 8 | **Inventory** | Items, categories, suppliers, warehouses, stock ledger (In/Out/Adjust), QR codes, low-stock alerts |
| 9 | **CRM** | Customers, leads, interactions, opportunities, **pipeline board** + funnel |
| 10 | **Documents** | Folder tree, version control, internal sharing, type tags (MinIO presigned URLs) |
| 11 | **Chat** | Realtime direct & group messaging, mentions, company announcements |
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
| **Reporting** | exceljs (Excel) · pdfkit (PDF) · qrcode |
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
└── docs/             # SRS, ERD, architecture, roadmap, deployment
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
pnpm dev            # API on :4000, Web on :3000
```

| Service | URL |
|---|---|
| **Web app** | http://localhost:3000 |
| API | http://localhost:4000/api/v1 |
| Swagger / OpenAPI | http://localhost:4000/api/docs |
| MinIO console | http://localhost:9001 |
| MailHog inbox | http://localhost:8025 |

### Default login
```
Email:    admin@nexus.local
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

Production images, compose, and a full guide (env/secrets, MinIO buckets, migrations, reverse-proxy/TLS, backups, **security pen-test checklist**) are in:

- [`docker/docker-compose.prod.yml`](docker/docker-compose.prod.yml)
- [`docs/06-DEPLOYMENT.md`](docs/06-DEPLOYMENT.md)

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build
```

---

## 📚 Documentation

| Doc | Description |
|---|---|
| [`docs/01-SRS.md`](docs/01-SRS.md) | Software Requirement Specification |
| [`docs/02-ERD.md`](docs/02-ERD.md) | Entity-Relationship Diagram (Mermaid) |
| [`docs/03-FOLDER-STRUCTURE.md`](docs/03-FOLDER-STRUCTURE.md) | Folder structure |
| [`docs/04-FACE-RECOGNITION.md`](docs/04-FACE-RECOGNITION.md) | Face recognition architecture |
| [`docs/05-ROADMAP.md`](docs/05-ROADMAP.md) | Implementation roadmap (all 14 phases ✅) |
| [`docs/06-DEPLOYMENT.md`](docs/06-DEPLOYMENT.md) | Deployment & hardening guide |
| [`packages/database/schema.prisma`](packages/database/schema.prisma) | Complete Prisma schema |

---

## 🔐 Security at a glance

- Argon2id password hashing; JWT rotation with refresh-token reuse detection.
- Global `JwtAuthGuard` + `PermissionsGuard`; every endpoint declares required permissions.
- Input validation (`whitelist` + `forbidNonWhitelisted`), Helmet, locked CORS, rate limiting.
- Face embeddings encrypted at rest (AES-256-GCM); files via private bucket + presigned URLs.
- Full audit trail (who changed what, before/after) on every mutation.

See the [pen-test checklist](docs/06-DEPLOYMENT.md#7-security-checklist-pen-test).

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
