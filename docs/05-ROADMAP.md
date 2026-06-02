# Implementation Roadmap
### Nexus ECM — step-by-step build plan

A phased plan that delivers a working vertical slice early, then layers modules. Each phase ends with a
demoable, tested increment. Estimated effort assumes 1–2 developers; adjust to your team.

---

## Phase 0 — Foundations ✅ (this deliverable)
- [x] SRS ([`01-SRS.md`](01-SRS.md))
- [x] ERD ([`02-ERD.md`](02-ERD.md))
- [x] Prisma schema ([`../packages/database/schema.prisma`](../packages/database/schema.prisma))
- [x] Folder structure ([`03-FOLDER-STRUCTURE.md`](03-FOLDER-STRUCTURE.md))
- [x] Face Recognition architecture ([`04-FACE-RECOGNITION.md`](04-FACE-RECOGNITION.md))

---

## Phase 1 — Monorepo & Infra scaffolding ✅ DONE
**Goal:** `docker compose up` brings up the whole local stack.
1. [x] Init pnpm workspace + Turborepo; create `apps/api`, `apps/web`, `packages/{database,shared,config}`.
2. [x] `docker-compose.yml`: Postgres, Redis, MinIO, MailHog (all healthy via Colima).
3. [x] Wire Prisma: `prisma migrate dev` (migration `init` applied), generate client, `seed.ts` ran.
4. [x] `.env.example` + env wiring in API.
5. [ ] CI: lint + typecheck + `prisma validate` + build. *(deferred)*

**Done:** services healthy, DB migrated & seeded (68 permissions, 5 roles, super admin), API + web boot.

---

## Phase 2 — Auth & RBAC (security backbone) ✅ DONE
1. [x] NestJS: Argon2id hashing, JWT access (15m) + refresh (7d) with **rotation & reuse detection** (verified: 403 on reuse).
2. [x] Guards: `JwtAuthGuard`, `PermissionsGuard`, `@RequirePermissions()`, `@Public()`, `@CurrentUser()`.
3. [x] Global: Helmet, CORS, `@nestjs/throttler`, class-validator pipe.
4. [x] RBAC CRUD (roles, permissions, assignment) — 5 default roles seeded.
5. [x] Frontend: login page, `authStore` (Zustand+persist), axios client with refresh interceptor, protected dashboard layout.

**Done & verified:** login → tokens; `/auth/me`; protected `/rbac/*`; refresh rotation; reuse→403; no/invalid token→401; audit logs LOGIN/LOGOUT. Web serves /login + protected /dashboard.

---

## Phase 3 — App shell & Design system ✅ DONE
1. [x] Tailwind theme tokens for the Linear/Stripe/Notion aesthetic
   (`#F5F5F7` bg, white cards, 16–20px radius, pastel accents, soft shadows).
2. [x] Layout: fixed left sidebar (permission-filtered nav, active state), top bar with
   global search ⌘K (cmdk command palette), notifications bell, profile dropdown menu.
3. [x] Shared components: `KpiCard`, `DataTable` (TanStack Table: sort/search/paginate),
   `StatusBadge`, `EmptyState`, `PageHeader`, chart wrappers (Recharts: Area/Bar + `ChartCard`).
4. [x] TanStack Query provider, toast system (sonner), responsive grid; UI primitives
   `dropdown-menu` + `dialog` (Radix). Placeholder pages for all modules keep the shell navigable.

**Done & verified:** `pnpm typecheck` + `pnpm build` clean (18 routes). Navigable shell with
consistent styling, ⌘K palette, and reusable primitives. Dashboard previews KPIs/charts with sample data.

---

## Phase 4 — Module 2: Employee Management (first full vertical slice) ✅ DONE
1. [x] API module: departments, positions, employees CRUD + **soft delete & restore**;
   paginated/filterable/sortable list; auto employee number (`EMP-0001`).
2. [x] MinIO `StorageService` + presigned upload/download for photo & documents (KTP/NPWP/CV/Contract);
   bucket auto-created on boot.
3. [x] Job history (auto-seeded on placement) + salary history endpoints.
4. [x] Frontend: employee list (DataTable + dept/status filters), create/edit forms (zod),
   rich detail page with tabs (Info / Riwayat Jabatan / Riwayat Gaji / Dokumen) + presigned upload UI.
5. [x] `AuditService` (global) records CREATE/UPDATE/DELETE with before/after snapshots.

**Done & verified:** `pnpm build` (api + web) clean. Runtime smoke test passed end-to-end —
login → create dept/position/employee (auto EMP-0001) → list+search → salary history →
detail (jobHistory+salaryHistory seeded) → presigned upload → soft delete (excluded from list).

---

## Phase 5 — Module 3: Face Recognition Attendance ✅ DONE
1. [x] Frontend face utils (`features/attendance/face/`): loadModels, detectFace, quality,
   liveness (blink/head-turn via landmarks), match, useFaceCamera — `@vladmandic/face-api`, all
   dynamic-imported (browser-only, no SSR). Model download script + README in `public/models/`.
2. [x] Enrollment UI (multi-frame capture) + `POST /attendance/face/enroll` with **server-side dedup**
   (Euclidean distance) and **AES-256-GCM encrypted embeddings at rest** (`CryptoService`).
3. [x] Check-in/out pages: camera + liveness challenge + GPS + audit photo (downscaled JPEG → MinIO).
   **Server-side verify** (browser sends embedding only; raw video never leaves device).
4. [x] API: status derivation vs `WorkSchedule` (PRESENT/LATE + grace), upsert Attendance (unique per day);
   check-out updates same record; work-schedule CRUD endpoints.
5. [x] Attendance dashboard: Present/Late/Leave/Permit/Absent KPIs + bar chart + today's records table.

**Done & verified:** `pnpm build` (api + web, 22 routes) clean. Backend runtime smoke test passed —
enroll → check-in (PRESENT, matchScore 0.93) → duplicate check-in 400 → check-out → wrong face 401 →
cross-employee dedup 409 → liveness=false 400 → summary/list correct. (Camera/ML flow needs models
downloaded + a real camera to exercise in-browser.)

---

## Phase 6 — Module 4: Leave Management ✅ DONE
1. [x] Leave types + balances (auto-ensure per year, quota check on submit) + supporting-doc presigned upload;
   `requiresDoc` enforced; balance deducted on final approval.
2. [x] Multi-step approval engine (Supervisor → Manager → HR) with per-step `LeaveApproval` records,
   `currentStep` advancement, approve/reject, and requester withdraw (pending only).
3. [x] `NotificationService` (global, in-app) notifies next approver + requester on each transition.
4. [x] Frontend: request form (doc upload), list + approval inbox (RBAC-gated by `leave:approve`),
   detail page with approval timeline + approve/reject actions.

**Done & verified:** `pnpm build` (api + web) clean. Runtime smoke test passed — submit → 3-step approve
→ APPROVED + balance used 3/remaining 9 → reject flow → `requiresDoc` 400 → withdraw (404 after).

---

## Phase 7 — Modules 5 & 6: Projects & Tasks ✅ DONE
1. [x] Projects CRUD + members + milestones; **auto progress** (% DONE tasks, recalced on task change)
   + budget (planned/actual) tracking.
2. [x] Tasks: assignees, priority, due dates, status, checklist (toggle), comments (author-resolved),
   attachments (presigned); Kanban move endpoint.
3. [x] Views: **Kanban** (dnd-kit drag-drop), **Table** (DataTable), **Calendar** (month grid by dueDate).

**Done & verified:** `pnpm build` (api + web, 23 routes) clean. Runtime smoke test passed — project +
member + milestone → 3 tasks (progress 33%) → kanban move → 67% → checklist/comment → delete → 100%
recalc → duplicate code 400.

---

## Phase 8 — Module 7: Finance ✅ DONE
1. [x] Invoices + line items + payments (auto subtotal/tax/total, `INV-YYYY-####`, PARTIAL/PAID,
   OVERDUE derived on read); minimal Customers module (full CRM in Phase 10).
2. [x] Expenses (categories, DRAFT→APPROVED→PAID) + reimbursements with approve/reject/pay
   (PAID mirrors into expense ledger under REIMBURSEMENT); receipt presign.
3. [x] Reports: Cashflow, P&L, Expense — **Excel (exceljs) + PDF (pdfkit)** export endpoints.
   *(pdfkit chosen over pdfmake: reliable built-in fonts server-side, no TTF bundling.)*
4. [x] Finance dashboard (income/expense/net/outstanding KPIs, cashflow + by-category charts) +
   tabs for Invoices/Expenses/Reimbursements, invoice detail page with payments.

**Done & verified:** `pnpm build` (api + web) clean. Runtime smoke test passed — customer → invoice
(11% tax, total 13.32M) → partial→PAID → expense approve → reimbursement PAID mirrors to expense →
summary (income 13.32M, expense 1.8M, net 11.52M) → cashflow → export.xlsx (valid Excel) + export.pdf (valid PDF).

---

## Phase 9 — Module 8: Inventory ✅ DONE
1. [x] Items, categories, suppliers, warehouses (auto `SKU-####`).
2. [x] Stock movement ledger (IN/OUT/ADJUST); derived current stock (groupBy aggregation).
3. [x] QR generation (`qrcode` data URL); low-stock detection + notifications.

**Verified:** IN 10 → OUT 7 → stock 3 (low alert), low-stock list, QR data URL.

---

## Phase 10 — Module 9: CRM ✅ DONE
1. [x] Customers (from Phase 8), interactions, leads (status), opportunities, pipeline stages.
2. [x] Pipeline board grouped by stage (+ funnel totals); web pipeline + leads + customers tabs.

**Verified:** lead created, opportunity → board (5 stages, value 50M).

---

## Phase 11 — Module 10: Document Management ✅ DONE
1. [x] Folders (tree), documents, version control (auto-increment + currentVersion pointer), sharing, type tags.
2. [x] Upload/download via MinIO presigned URLs.

**Verified:** folder → document → version v1 → detail lists versions.

---

## Phase 12 — Module 11: Internal Communication (realtime) ✅ DONE
1. [x] Socket.IO gateway (`/chat`, JWT-authed on handshake): join, message, typing, read, presence.
2. [x] Direct + group chat, @mentions (→ notifications); REST history + conversation/user listing.
3. [x] Company announcements (ALL audience fan-out to notifications).

**Verified:** gateway subscribes to events on boot; REST message send + conversations + announcement.

---

## Phase 13 — Cross-cutting & Module 1: Dashboard ✅ DONE
1. [x] Notification Center (in-app: list/unread-count/mark-read) — bell dropdown in topbar. *(email via BullMQ deferred)*
2. [x] Global Search across employees/projects/tasks/documents/customers — wired into ⌘K palette.
3. [x] Audit Log viewer (filter by entity/action) — Pengaturan page.
4. [x] **Dashboard** aggregation endpoint (KPIs) + activity feed; web dashboard uses real data.

**Verified:** summary (employees/present/projects/income), search hits, audit Item log, notifications.

---

## Phase 14 — Hardening, Docs & Deploy ✅ DONE
1. [x] Security pass + **pen-test checklist** ([`06-DEPLOYMENT.md`](06-DEPLOYMENT.md) §7); helmet, CORS lock,
   throttler, global ValidationPipe, AES-256-GCM at rest, audit; `enableShutdownHooks`.
2. [x] Swagger/OpenAPI per-endpoint operations + `persistAuthorization`; `@Public()` health probes.
3. [x] Test coverage: jest unit suite (embedding/match logic) — 5/5 passing.
4. [x] Production multi-stage Docker images + [`docker-compose.prod.yml`](../docker/docker-compose.prod.yml)
   (healthchecks, volumes) + backup commands.
5. [x] Deployment guide ([`06-DEPLOYMENT.md`](06-DEPLOYMENT.md)): env/secrets, MinIO buckets, migrations, reverse proxy/TLS.

**Verified:** `pnpm typecheck` + `pnpm build` (api + web) clean, `pnpm --filter @nexus/api test` 5/5,
API boots (149 routes), `/health` → 200, `/health/ready` → db up.

---

## 🎉 All 14 phases complete
Full ECM: Auth/RBAC, Employees, Attendance (face), Leave, Projects/Tasks, Finance,
Inventory, CRM, Documents, Chat (realtime), Dashboard — backend verified via runtime
smoke tests, frontend builds clean, production deployment artifacts in place.

---

## Suggested build order rationale
- **Security first** (Phase 2) so every later module inherits auth/RBAC/audit.
- **Employees before Attendance/Leave/Finance** — most modules reference `Employee`.
- **Dashboard last** — it aggregates data that must already exist.
- Ship each module as an independent vertical slice (API → UI → tests) to stay demoable throughout.

---

### Next action
Proceed to **Phase 1** (monorepo + Docker scaffolding) on approval, or jump to any phase you want
prioritized. Recommend doing Phases 1→4 in sequence to establish the working skeleton.
