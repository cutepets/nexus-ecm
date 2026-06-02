# Enterprise Folder Structure
### Nexus ECM — Monorepo (pnpm workspaces + Turborepo)

This layout supports a **modular monolith** today and a clean path to microservices later. Each backend
module follows **Clean Architecture** layers; the frontend follows a **feature-sliced** structure.

---

## Top level

```
nexus-ecm/
├── apps/
│   ├── api/                      # NestJS backend
│   └── web/                      # Next.js 15 frontend
├── packages/
│   ├── database/                 # Prisma schema, migrations, generated client, seed
│   ├── shared/                   # Cross-app types, DTO contracts, zod schemas, enums, constants
│   └── config/                   # Shared tsconfig / eslint / tailwind / prettier presets
├── docker/                       # Dockerfiles + compose + service configs
├── docs/                         # SRS, ERD, architecture, roadmap
├── .github/workflows/            # CI (lint, test, build, prisma validate)
├── .env.example
├── package.json                  # workspace root scripts
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## `apps/api` — NestJS (Clean + Modular Architecture)

```
apps/api/
├── src/
│   ├── main.ts                   # bootstrap, Swagger, Helmet, global pipes/filters
│   ├── app.module.ts
│   │
│   ├── core/                     # framework-agnostic cross-cutting
│   │   ├── config/               # env validation (zod/joi), config service
│   │   ├── prisma/               # PrismaModule + PrismaService
│   │   ├── redis/                # Redis + BullMQ providers
│   │   ├── storage/              # MinIO (S3) service, presigned URLs
│   │   ├── mail/                 # Nodemailer mailer + templates
│   │   ├── logger/               # pino logger
│   │   ├── guards/               # JwtAuthGuard, PermissionsGuard, ThrottlerGuard
│   │   ├── decorators/           # @CurrentUser, @RequirePermissions, @Public
│   │   ├── interceptors/         # AuditInterceptor, TransformResponse, Timeout
│   │   ├── filters/              # AllExceptionsFilter, PrismaExceptionFilter
│   │   └── pipes/                # ZodValidationPipe
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── domain/           # entities, value objects, repository INTERFACES
│   │   │   ├── application/      # use-cases (Login, Refresh, Logout), DTOs
│   │   │   ├── infrastructure/   # repository impls, strategies (jwt/refresh)
│   │   │   └── presentation/     # auth.controller.ts, auth.module.ts
│   │   ├── rbac/                 # roles & permissions management
│   │   ├── users/
│   │   ├── employees/
│   │   ├── attendance/           # face profiles + check-in/out + matching verify
│   │   ├── leave/
│   │   ├── projects/
│   │   ├── tasks/
│   │   ├── finance/              # invoices, payments, expenses, reimbursements, reports
│   │   ├── inventory/
│   │   ├── crm/
│   │   ├── documents/
│   │   ├── chat/                 # REST + Socket.IO gateway
│   │   ├── notifications/        # in-app + email, BullMQ processors
│   │   ├── audit/                # query API for audit logs
│   │   ├── search/               # global search
│   │   ├── reporting/            # PDF (pdfmake) + Excel (exceljs) generators
│   │   └── dashboard/            # KPI aggregation endpoints
│   │
│   └── shared/                   # api-only helpers (pagination, base dto, mappers)
│
├── test/                         # e2e tests
├── Dockerfile
├── nest-cli.json
├── tsconfig.json
└── package.json
```

**Clean Architecture rule:** `presentation → application → domain`, and `infrastructure → domain`.
Domain never imports Nest or Prisma. Use-cases depend on repository *interfaces*; infrastructure provides
Prisma-backed implementations wired in each `*.module.ts`.

A representative module:

```
modules/employees/
├── domain/
│   ├── employee.entity.ts
│   └── employee.repository.ts          # interface
├── application/
│   ├── dto/ create-employee.dto.ts ...
│   ├── use-cases/
│   │   ├── create-employee.usecase.ts
│   │   ├── update-employee.usecase.ts
│   │   ├── get-employee.usecase.ts
│   │   └── list-employees.usecase.ts
│   └── employees.service.ts            # orchestrates use-cases (optional facade)
├── infrastructure/
│   └── prisma-employee.repository.ts   # implements domain interface
└── presentation/
    ├── employees.controller.ts
    └── employees.module.ts
```

---

## `apps/web` — Next.js 15 (App Router, feature-sliced)

```
apps/web/
├── src/
│   ├── app/                      # App Router
│   │   ├── (auth)/login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         # sidebar + topbar shell
│   │   │   ├── page.tsx           # Dashboard (Module 1)
│   │   │   ├── employees/
│   │   │   ├── attendance/
│   │   │   ├── leave/
│   │   │   ├── projects/
│   │   │   ├── tasks/
│   │   │   ├── finance/
│   │   │   ├── inventory/
│   │   │   ├── crm/
│   │   │   ├── documents/
│   │   │   ├── chat/
│   │   │   └── settings/          # roles, permissions, profile
│   │   ├── api/                   # route handlers (BFF/proxy if needed)
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── layout/                # Sidebar, Topbar, SearchCommand
│   │   ├── charts/                # Recharts wrappers (revenue, attendance)
│   │   └── shared/                # KpiCard, DataTable, EmptyState, StatusBadge
│   │
│   ├── features/                  # one folder per module
│   │   ├── employees/
│   │   │   ├── api/               # React Query hooks (useEmployees, useCreate...)
│   │   │   ├── components/
│   │   │   ├── schemas/           # zod form schemas
│   │   │   └── types.ts
│   │   ├── attendance/
│   │   │   ├── face/              # face-api loader, enroll, match, liveness
│   │   │   └── ...
│   │   └── ... (one per module)
│   │
│   ├── lib/
│   │   ├── api-client.ts          # axios/fetch wrapper w/ token refresh interceptor
│   │   ├── query-client.ts        # TanStack Query config
│   │   ├── socket.ts              # Socket.IO client
│   │   └── utils.ts
│   │
│   ├── stores/                    # Zustand (authStore, uiStore, chatStore)
│   ├── hooks/
│   └── styles/
│
├── public/
│   └── models/                    # face-api.js model weights (tiny_face_detector, etc.)
├── Dockerfile
├── next.config.ts
├── tailwind.config.ts
├── components.json                # shadcn config
├── tsconfig.json
└── package.json
```

---

## `packages/database`

```
packages/database/
├── schema.prisma
├── migrations/                   # generated by `prisma migrate`
├── seed.ts                       # roles, permissions, demo data
├── src/index.ts                  # exports the singleton PrismaClient
└── package.json
```

## `packages/shared`

```
packages/shared/
├── src/
│   ├── enums/                    # mirror Prisma enums for the frontend
│   ├── types/                    # API response/request contracts
│   ├── schemas/                  # zod schemas shared by web + api validation
│   ├── constants/                # permission keys, route paths
│   └── index.ts
└── package.json
```

## `docker/`

```
docker/
├── docker-compose.yml            # postgres, redis, minio, mailhog, api, web
├── docker-compose.prod.yml
├── api.Dockerfile
├── web.Dockerfile
└── minio/ , postgres/            # init scripts / config
```

---

## Why this structure
- **Separation of concerns:** business rules (domain) are isolated from frameworks → testable & portable.
- **Module independence:** each module is a vertical slice; teams own modules without collisions.
- **Shared contracts:** `packages/shared` keeps frontend & backend types in sync (single source of truth).
- **Scale-out path:** any `modules/*` folder can become its own deployable service with minimal change.
