# Software Requirement Specification (SRS)
### Nexus ECM — Enterprise Company Management System
**Version:** 1.0 · **Date:** 2026-06-02 · **Status:** Approved for build

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for **Nexus ECM**, a web-based
enterprise management platform covering HR, attendance, leave, projects, tasks, finance, inventory, CRM,
documents, and internal communication. It is the authoritative reference for design, implementation, and QA.

### 1.2 Scope
Nexus ECM is a **modular monolith** web application (responsive, desktop-first) targeting medium-to-large
companies. It centralizes operational data behind a single RBAC-secured platform with AI-powered
face-recognition attendance, real-time chat, analytics dashboards, and PDF/Excel reporting.

### 1.3 Definitions & Acronyms
| Term | Meaning |
|---|---|
| RBAC | Role-Based Access Control |
| KPI | Key Performance Indicator |
| Embedding | 128/512-d float vector representing a face |
| Spoofing | Presenting a photo/video instead of a live face |
| SoD | Separation of Duties |
| SLA | Service Level Agreement |

### 1.4 Actors / User Roles
| Role | Description | Scope |
|---|---|---|
| **Super Admin** | Full system access, configuration, user/role management | Global |
| **HR** | Manage employees, attendance, leave approvals | Org-wide HR data |
| **Finance** | Manage income, expenses, invoices, payroll, reports | Org-wide financial data |
| **Manager** | Manage own team, projects, tasks, approve leave | Team / department scope |
| **Employee** | Self-service: own profile, attendance, leave, tasks, chat | Self + assigned items |

RBAC is **permission-based**, not just role-based: roles are bundles of granular permissions
(e.g. `employee:create`, `finance:report:read`), so custom roles can be added without code changes.

---

## 2. Overall Description

### 2.1 Product Perspective
A greenfield system. Frontend (Next.js 15) ↔ Backend (NestJS REST + WebSocket) ↔ PostgreSQL/Redis/MinIO.
Face recognition runs **client-side** in the browser; only face *embeddings* and audit photos are persisted.

### 2.2 Operating Environment
- **Client:** Modern evergreen browser (Chrome/Edge/Firefox/Safari) with camera + geolocation for attendance.
- **Server:** Linux containers via Docker Compose. Node.js 20+.
- **Network:** HTTPS only in production. WebSocket (WSS) for realtime.

### 2.3 Design & Implementation Constraints
- 100% free / open-source components (no paid SaaS dependency).
- Clean Architecture per module; modular monolith deployable as a single unit.
- All write actions must be auditable.
- Multi-tenant **not** required for v1 (single organization) but schema leaves room (`organizationId` optional).

### 2.4 Assumptions & Dependencies
- Users grant camera + location permissions for attendance.
- Browser supports WebGL/WASM for TensorFlow.js.
- An SMTP relay is available for email notifications.

---

## 3. Functional Requirements

> Requirement IDs: `FR-<MODULE>-<n>`. Priority: **M**ust / **S**hould / **C**ould.

### 3.1 Authentication & Authorization (FR-AUTH)
| ID | Requirement | Pri |
|---|---|---|
| FR-AUTH-1 | Users log in with email + password; passwords hashed with Argon2id | M |
| FR-AUTH-2 | Issue short-lived JWT access token (15 min) + long-lived refresh token (7 d) | M |
| FR-AUTH-3 | Refresh tokens are rotated and stored hashed; reuse detection revokes the session | M |
| FR-AUTH-4 | Logout revokes the active refresh token | M |
| FR-AUTH-5 | RBAC guards every endpoint via required-permission metadata | M |
| FR-AUTH-6 | Account lockout after N failed attempts (configurable) | S |
| FR-AUTH-7 | Optional 2FA (TOTP) | C |

### 3.2 Module 1 — Dashboard (FR-DASH)
| ID | Requirement | Pri |
|---|---|---|
| FR-DASH-1 | Show KPI cards: Total Employees, Active Employees, Today's Attendance, Total Income, Total Expense, Active Projects, Pending Tasks | M |
| FR-DASH-2 | Monthly revenue chart (line/area, 12 months) | M |
| FR-DASH-3 | Attendance chart (present/late/leave/absent distribution) | M |
| FR-DASH-4 | Recent activity feed (from Audit Log) | M |
| FR-DASH-5 | System notifications panel | M |
| FR-DASH-6 | Data scoped to the user's role (e.g. Manager sees own team) | M |
| FR-DASH-7 | Fully responsive grid (desktop → mobile) | M |

### 3.3 Module 2 — Employee Management (FR-EMP)
| ID | Requirement | Pri |
|---|---|---|
| FR-EMP-1 | CRUD employees | M |
| FR-EMP-2 | Full profile: photo, department, position, phone, email, address, work status, join date | M |
| FR-EMP-3 | Position/job history timeline | M |
| FR-EMP-4 | Salary history (effective-dated) | M |
| FR-EMP-5 | Document upload: KTP, NPWP, CV, Employment Contract (with type + verification status) | M |
| FR-EMP-6 | Employee detail page aggregating all of the above | M |
| FR-EMP-7 | Soft-delete / deactivate (retain history) | M |
| FR-EMP-8 | Search & filter by name, department, status | S |

### 3.4 Module 3 — Face Recognition Attendance (FR-ATT)
| ID | Requirement | Pri |
|---|---|---|
| FR-ATT-1 | **Face enrollment**: capture multiple photos, compute embedding(s), store per employee | M |
| FR-ATT-2 | Validate image quality (resolution, brightness, single centered face) before enrollment | M |
| FR-ATT-3 | Duplicate-face detection (reject if embedding matches an existing employee above threshold) | M |
| FR-ATT-4 | Basic anti-spoofing (liveness): blink/head-move challenge or texture heuristic | M |
| FR-ATT-5 | **Check-In**: access camera, detect face, match embedding, show name, record attendance | M |
| FR-ATT-6 | **Check-Out**: same flow, updates the day's record | M |
| FR-ATT-7 | Persist per scan: timestamp, GPS lat/long, captured photo, device info, attendance status | M |
| FR-ATT-8 | Status derivation: Present, Late (after grace), Leave, Permit, Absent | M |
| FR-ATT-9 | Attendance dashboard with counts per status and date filters | M |
| FR-ATT-10 | Matching runs in-browser; only embedding + audit photo sent to server | M |
| FR-ATT-11 | Configurable work schedule (start time, grace minutes) per department | S |

### 3.5 Module 4 — Leave Management (FR-LEAVE)
| ID | Requirement | Pri |
|---|---|---|
| FR-LEAVE-1 | Submit requests of type: Leave (cuti), Permit (izin), Sick (sakit) | M |
| FR-LEAVE-2 | Attach supporting document (e.g. medical note) | M |
| FR-LEAVE-3 | Multi-step approval workflow: Employee → Supervisor → Manager → HR | M |
| FR-LEAVE-4 | Status: Pending, Approved, Rejected (with rejection reason) | M |
| FR-LEAVE-5 | Each approval step records approver, decision, timestamp, comment | M |
| FR-LEAVE-6 | Notify next approver and the requester on each transition | M |
| FR-LEAVE-7 | Leave balance tracking per leave type per year | S |

### 3.6 Module 5 — Project Management (FR-PROJ)
| ID | Requirement | Pri |
|---|---|---|
| FR-PROJ-1 | CRUD projects | M |
| FR-PROJ-2 | Milestones with target dates | M |
| FR-PROJ-3 | Deadline + progress tracking (% complete) | M |
| FR-PROJ-4 | Budget tracking (planned vs actual spend) | M |
| FR-PROJ-5 | Status: Planning, Active, Completed, Cancelled | M |
| FR-PROJ-6 | Assign team members + project manager | M |

### 3.7 Module 6 — Task Management (FR-TASK)
| ID | Requirement | Pri |
|---|---|---|
| FR-TASK-1 | CRUD tasks, optionally linked to a project | M |
| FR-TASK-2 | Assign one or more users | M |
| FR-TASK-3 | Priority: Low, Medium, High, Critical | M |
| FR-TASK-4 | Due date | M |
| FR-TASK-5 | Checklist sub-items with done state | M |
| FR-TASK-6 | Threaded comments | M |
| FR-TASK-7 | File attachments | M |
| FR-TASK-8 | Views: Kanban board (drag-drop), Table, Calendar | M |
| FR-TASK-9 | Status columns: Todo, In Progress, Review, Done (configurable) | S |

### 3.8 Module 7 — Financial Management (FR-FIN)
| ID | Requirement | Pri |
|---|---|---|
| FR-FIN-1 | **Income**: create invoices with line items, record client payments, income history | M |
| FR-FIN-2 | **Expense**: categories — Operational, Purchase, Salary, Reimbursement | M |
| FR-FIN-3 | Reimbursement submission + approval | M |
| FR-FIN-4 | **Reports**: Cashflow, Profit & Loss, Expense Report | M |
| FR-FIN-5 | Financial dashboard (income vs expense, by category, trends) | M |
| FR-FIN-6 | Export reports to PDF & Excel | M |

### 3.9 Module 8 — Inventory Management (FR-INV)
| ID | Requirement | Pri |
|---|---|---|
| FR-INV-1 | CRUD items | M |
| FR-INV-2 | Stock In / Stock Out movements (ledger) | M |
| FR-INV-3 | Suppliers, categories, warehouses | M |
| FR-INV-4 | Barcode + QR code per item (generated) | M |
| FR-INV-5 | Low-stock notification when quantity ≤ reorder level | M |
| FR-INV-6 | Current stock = derived from movement ledger per warehouse | M |

### 3.10 Module 9 — CRM (FR-CRM)
| ID | Requirement | Pri |
|---|---|---|
| FR-CRM-1 | Customer records | M |
| FR-CRM-2 | Interaction history (call, email, meeting, note) | M |
| FR-CRM-3 | Leads | M |
| FR-CRM-4 | Opportunities with value + stage | M |
| FR-CRM-5 | Sales pipeline with configurable stages | M |
| FR-CRM-6 | Visual sales funnel | M |

### 3.11 Module 10 — Document Management (FR-DOC)
| ID | Requirement | Pri |
|---|---|---|
| FR-DOC-1 | Upload documents to folders | M |
| FR-DOC-2 | Folder hierarchy management | M |
| FR-DOC-3 | Version control (new uploads create versions) | M |
| FR-DOC-4 | Download | M |
| FR-DOC-5 | Internal share (per-user/role access) | M |
| FR-DOC-6 | Document type tagging: SOP, Contract, Invoice, Letter | M |

### 3.12 Module 11 — Internal Communication (FR-CHAT)
| ID | Requirement | Pri |
|---|---|---|
| FR-CHAT-1 | 1:1 personal chat | M |
| FR-CHAT-2 | Group chat | M |
| FR-CHAT-3 | Company-wide announcements | M |
| FR-CHAT-4 | @mention users | M |
| FR-CHAT-5 | File sharing in chat | M |
| FR-CHAT-6 | Realtime delivery via WebSocket; read receipts + typing indicator | M |

### 3.13 Cross-Cutting (FR-X)
| ID | Requirement | Pri |
|---|---|---|
| FR-X-AUDIT-1 | Log Login, Logout, Create, Update, Delete with actor, entity, before/after, IP, UA | M |
| FR-X-NOTIF-1 | Notification Center: in-app + email channels | M |
| FR-X-REPORT-1 | Generate PDF and Excel reports across modules | M |
| FR-X-SEARCH-1 | Global search across employees, projects, tasks, documents, customers | M |

---

## 4. Non-Functional Requirements

### 4.1 Performance
- API p95 latency < 300 ms for standard reads (excluding reports).
- Dashboard initial load < 2 s on broadband.
- Face match in browser < 1.5 s per attempt on a mid-range laptop.

### 4.2 Scalability
- Stateless API horizontally scalable behind a load balancer; sessions in Redis.
- Heavy work (reports, emails, notifications) offloaded to BullMQ workers.

### 4.3 Security (see FR-AUTH + §5)
- JWT auth, refresh-token rotation, RBAC, rate limiting, CSRF & XSS protection, parameterized queries (Prisma) to prevent SQL injection, security headers (Helmet), input validation (class-validator/zod).

### 4.4 Availability & Reliability
- Target 99.5% uptime. Graceful degradation if MinIO/email is down (queue + retry).
- Daily DB backups.

### 4.5 Usability & Accessibility
- WCAG 2.1 AA target, keyboard navigable, high-contrast pastel palette.
- Responsive from 360px to 4K.

### 4.6 Maintainability
- Clean Architecture, ≥80% unit-test coverage on domain/application layers, typed end-to-end, OpenAPI docs.

### 4.7 Privacy & Compliance
- Biometric data (embeddings) stored encrypted at rest; raw enrollment images optionally discarded after embedding.
- PII access is audited. Data export/delete supported for employee records.

---

## 5. Security Requirements Detail
| Control | Implementation |
|---|---|
| Authentication | JWT access + rotating refresh tokens, Argon2id hashing |
| Authorization | Permission-based RBAC guards (`@RequirePermissions()`) |
| Rate limiting | `@nestjs/throttler` + Redis store, stricter on `/auth/*` |
| CSRF | Double-submit cookie / SameSite=strict for cookie-based flows |
| XSS | Output encoding, CSP header, sanitize rich text |
| SQL Injection | Prisma parameterized queries only; no raw string SQL |
| Transport | TLS everywhere, HSTS |
| Headers | Helmet (CSP, X-Frame-Options, etc.) |
| Secrets | Env vars / Docker secrets, never committed |
| Audit | Immutable append-only audit log |

---

## 6. Data Requirements
See [`02-ERD.md`](02-ERD.md) and [`../packages/database/schema.prisma`](../packages/database/schema.prisma)
for the full entity model, relationships, and constraints.

---

## 7. External Interfaces
| Interface | Protocol | Notes |
|---|---|---|
| Web client ↔ API | HTTPS REST (JSON) | OpenAPI/Swagger documented |
| Web client ↔ API | WSS (Socket.IO) | Chat, notifications, presence |
| API ↔ PostgreSQL | TCP | via Prisma |
| API ↔ Redis | TCP | cache, queues, throttle, pub/sub |
| API ↔ MinIO | S3 API | file storage, presigned URLs |
| API ↔ SMTP | SMTP | email notifications |

---

## 8. Acceptance Criteria (sample)
- A Super Admin can create roles, assign permissions, and onboard an employee end-to-end.
- An employee can enroll their face, then check-in/out with GPS + photo recorded and correct status.
- A leave request traverses all four approval stages with notifications at each step.
- Finance can export a Profit & Loss report as both PDF and Excel.
- Every create/update/delete appears in the Audit Log with actor and diff.

---

## 9. Out of Scope (v1)
- Native mobile apps (responsive web only).
- Payroll tax/government e-filing integrations.
- Multi-currency consolidation (single base currency in v1).
- True multi-tenancy (schema leaves room; not enforced).
