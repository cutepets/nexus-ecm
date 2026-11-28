# Nexus ECM system map

This is the current implementation map. The Prisma schema and source code are the
authoritative references; this page is a navigation aid, not a second roadmap.

## Workspace

```text
nexus-ecm/
|-- apps/api/                 NestJS REST API and Socket.IO gateway
|-- apps/web/                 Next.js App Router web client
|-- packages/database/        Prisma schema, migrations, seed
|-- packages/shared/          Shared types and permission keys
|-- packages/config/          Shared TypeScript configuration
|-- docker/                   Local and production compose + images
`-- docs/                     System map and focused test records
```

The workspace is a pnpm + Turborepo modular monolith. The API owns business rules
and persistence; the web app talks to it through the shared API client. PostgreSQL
is the system of record, Redis supports cache/realtime infrastructure, and MinIO
stores private uploads.

## API capabilities

Modules are registered from `apps/api/src/app.module.ts`:

| Capability | API module | Main responsibilities |
|---|---|---|
| Authentication and access | `auth`, `users`, `rbac` | Login/session, accounts, roles and permissions |
| People | `employees` | Employee profiles, departments, positions, employment history |
| Attendance | `attendance` | Face enrollment, check-in/out, schedules, daily roster and approvals |
| Time and pay | `payroll` | Timesheet calculations, overtime and exports |
| Leave | `leave` | Leave balance, requests and approval workflow |
| Work delivery | `projects` | Projects, tasks, assignments and progress |
| Knowledge | `documents` | Folders, document versions and private file access |
| Collaboration | `chat` | REST messaging, announcements and Socket.IO realtime events |
| Overview | `dashboard` | Dashboard aggregates, activity, calendar and search |
| Administration | `settings`, `integrations` | Company/branch policy and external integration endpoints |
| Network security | `security` | Vietnam-only GeoIP check, IP failure windows, temporary/permanent blocks and audit settings |
| Platform | `health` | Liveness/readiness probes |

Cross-cutting providers live under `apps/api/src/core/`: Prisma, encrypted data,
object storage, audit trail, notifications, and production security configuration.
The API prefix is `/api/v1`; Swagger is served at `/api/docs` in development.

## Web routes

All business screens live under `apps/web/src/app/dashboard/` and share the
permission-filtered app shell:

| Route area | Purpose |
|---|---|
| `/dashboard` | Role-scoped KPIs and activity |
| `/dashboard/karyawan` | Employee list, profile, create and edit |
| `/dashboard/absensi` | Attendance summary, scan/enrollment, history and monthly work roster |
| `/dashboard/cuti` | Leave requests and detail/approval |
| `/dashboard/phe-duyet` | Approval inbox |
| `/dashboard/proyek`, `/dashboard/tugas` | Projects and task board/detail |
| `/dashboard/dokumen` | Document workspace |
| `/dashboard/chat` | Realtime conversations |
| `/dashboard/kalender` | Company calendar and daily work roster |
| `/dashboard/phan-quyen`, `/dashboard/tai-khoan` | Access and account administration |
| `/dashboard/thong-bao` | Notification center |
| `/dashboard/pengaturan` | Company, branch, attendance, payroll, integration and IP security settings |
| `/dashboard/profil` | Current user's self-service profile |

Feature API hooks and UI are grouped under `apps/web/src/features/`; reusable
shell, shared components and primitives are under `components/`.

## Attendance and work-roster flow

```text
WorkSchedule templates
        -> EmployeeWorkScheduleAssignment (recurring assignment)
        -> WorkRosterMonth (DRAFT -> PUBLISHED -> LOCKED)
        -> EmployeeDailySchedule + branch-specific segments
        -> attendance and timesheet schedule resolution
```

Managers generate a draft roster from recurring assignments, review/edit daily
segments, then publish or lock it. An automation service checks the company-local
schedule every 15 minutes, generates the next month from the configured generation
day, and can lock elapsed days. Check-in and timesheet calculations prefer a
published/locked daily roster, then legacy overrides, then recurring assignments.
Roster endpoints are part of the attendance API; the management calendar is
`/dashboard/kalender`.

## Persistence and migrations

- Prisma model definitions: `packages/database/schema.prisma`.
- Ordered SQL migrations: `packages/database/migrations/`.
- Initial/reference seed: `packages/database/seed.ts`.
- Preserve migration history; do not rewrite an applied migration to change schema.
- Run `pnpm db:generate` after schema changes, then apply migrations deliberately
  with `pnpm db:migrate` against the intended database.

## Local development

Prerequisites: Node.js 20+, pnpm 9+, and Docker. Keep real secrets in the ignored
`.env`; `.env.example` documents the required configuration.

```powershell
pnpm install
pnpm docker:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The web client uses `http://localhost:3100`; the API uses
`http://localhost:4100/api/v1`. Postgres, Redis and MinIO use the ports configured
in `docker/docker-compose.yml` and `.env`. Stop local infrastructure with
`pnpm docker:down`.

Useful checks: `pnpm typecheck`, `pnpm build`, and `pnpm --filter @nexus/api test`.
Attendance camera pages additionally need the committed face models and a camera;
real deployment needs production secrets, TLS, persistent storage and backups.

## Production deployment

Production on the current VPS reuses its existing Caddy on ports 80/443.
`docker/docker-compose.prod.yml` attaches API/web to external Docker network
`n8n_net`; PostgreSQL, Redis and MinIO stay private on Nexus's Compose network.
Point an owned domain at the VPS, set the public HTTPS origins, mount GeoLite2
Country at `geoip/GeoLite2-Country.mmdb`, then add the Nexus site block to the
existing Caddy config. See [`DEPLOYMENT_SECURITY.md`](../DEPLOYMENT_SECURITY.md)
for the verified VPS details and install procedure.

## Handoff

- `docs/DEV-NEXT.md`: remaining pilot inputs, acceptance evidence, and operational cautions.
