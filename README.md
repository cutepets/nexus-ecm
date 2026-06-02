# Nexus ECM — Enterprise Company Management System

A modern, scalable, fully open-source / free-tier enterprise management platform for medium-to-large companies.

> **Status:** Foundation phase. This repository currently contains the planning artifacts
> (SRS, ERD, database schema, architecture, roadmap). Application code is built in the
> phases described in [`docs/05-ROADMAP.md`](docs/05-ROADMAP.md).

---

## ✨ Highlights

- **11 functional modules**: Dashboard, Employees, Face-Recognition Attendance, Leave, Projects, Tasks, Finance, Inventory, CRM, Documents, Internal Chat.
- **Enterprise cross-cutting concerns**: RBAC, Audit Log, Notification Center, Reporting (PDF/Excel), Global Search, hardened security.
- **Browser-based AI Face Recognition** (no paid cloud vision API needed).
- **100% free / open-source stack** — see [Cost & "Everything Free" Strategy](#-cost--everything-free-strategy).

## 🧱 Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui, TanStack Query, Zustand |
| **Backend** | NestJS, TypeScript, Prisma ORM |
| **Database** | PostgreSQL 16 |
| **Cache / Queue / Pub-Sub** | Redis 7 + BullMQ |
| **Auth** | JWT access + refresh tokens, RBAC |
| **Realtime** | Socket.IO (WebSocket) |
| **Face Recognition** | `@vladmandic/face-api` (TensorFlow.js) — runs in the browser |
| **Object Storage** | MinIO (self-hosted, S3-compatible) |
| **Email** | Nodemailer + MailHog (dev) / any free SMTP (prod) |
| **Docs** | Swagger / OpenAPI |
| **Infra** | Docker + Docker Compose |

## 🏛 Architecture

- **Clean Architecture** inside each NestJS module (domain → application → infrastructure → presentation).
- **Modular monolith** — each business capability is an isolated Nest module; can be split into microservices later.
- **Monorepo** managed with **pnpm workspaces + Turborepo**.

## 📂 Repository Layout (target)

```
nexus-ecm/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js 15 frontend
├── packages/
│   ├── database/     # Prisma schema, migrations, client
│   ├── shared/       # Shared types, DTOs, zod schemas, constants
│   └── config/       # Shared eslint/tsconfig/tailwind presets
├── docker/           # Dockerfiles + compose
└── docs/             # SRS, ERD, architecture, roadmap
```

Full breakdown: [`docs/03-FOLDER-STRUCTURE.md`](docs/03-FOLDER-STRUCTURE.md).

## 📚 Documentation Index

| Doc | Description |
|---|---|
| [`docs/01-SRS.md`](docs/01-SRS.md) | Software Requirement Specification |
| [`docs/02-ERD.md`](docs/02-ERD.md) | Entity-Relationship Diagram (Mermaid) |
| [`packages/database/schema.prisma`](packages/database/schema.prisma) | Complete Prisma schema |
| [`docs/03-FOLDER-STRUCTURE.md`](docs/03-FOLDER-STRUCTURE.md) | Enterprise-scale folder structure |
| [`docs/04-FACE-RECOGNITION.md`](docs/04-FACE-RECOGNITION.md) | Face Recognition architecture & library choice |
| [`docs/05-ROADMAP.md`](docs/05-ROADMAP.md) | Step-by-step implementation roadmap |

## 💸 Cost & "Everything Free" Strategy

Every component is open-source and self-hostable at zero licensing cost:

| Need | Free choice |
|---|---|
| Object storage (KTP, NPWP, CV, photos, docs) | **MinIO** (self-hosted S3) — instead of paid AWS S3 |
| Face recognition | **face-api.js / TensorFlow.js** in-browser — instead of AWS Rekognition / Azure Face |
| Email | **MailHog** in dev, free SMTP (e.g. Brevo free tier) in prod |
| Database | **PostgreSQL** |
| Cache/queue | **Redis** |
| Hosting (dev/demo) | Docker Compose on any VPS, or free tiers (Railway/Render/Fly.io trials, Oracle Cloud Always-Free) |

## 🎨 Design Language

Inspired by **Linear · Stripe Dashboard · Notion**. Soft `#F5F5F7` background, white elevated cards,
16–20px radii, pastel accents (purple/cyan/mint/pink), generous whitespace. Details in the frontend phase.

---

© Nexus ECM — open source.
