# Getting Started — Menjalankan Nexus ECM (lokal)

Panduan langkah demi langkah menjalankan stack hasil **Fase 1 (scaffolding)**.

---

## 1. Prasyarat (perlu diinstall dulu)

| Tool | Kenapa | Cara install (macOS) |
|---|---|---|
| **Node.js 20+** | runtime | ✅ sudah ada (v25) |
| **pnpm 9** | package manager monorepo | `corepack enable && corepack prepare pnpm@9 --activate` |
| **Docker Desktop** | jalankan Postgres/Redis/MinIO/MailHog | unduh dari docker.com, atau `brew install --cask docker` |

> Tanpa Docker, kamu perlu menyiapkan PostgreSQL, Redis, dan MinIO secara manual.

---

## 2. Setup environment

```bash
cd /Users/fs/Documents/manajement
cp .env.example .env        # lalu sesuaikan secret bila perlu
```

## 3. Install dependencies

```bash
pnpm install
```

## 4. Nyalakan infrastruktur (database dkk)

```bash
pnpm docker:up
# Postgres :5432 · Redis :6379 · MinIO :9000 (console :9001) · MailHog UI :8025
```

## 5. Siapkan database

```bash
pnpm db:generate     # generate Prisma client
pnpm db:migrate      # buat tabel (migration pertama)
pnpm db:seed         # isi role, permission, super admin, master data
```

Login super admin awal (dari `.env`):
- Email: `admin@nexus.local`
- Password: `Admin123!`

## 6. Jalankan aplikasi (dev)

```bash
pnpm dev             # menjalankan API + Web bersamaan (Turborepo)
```

Akses:
- **Web (Next.js):** http://localhost:3000
- **API (NestJS):** http://localhost:4000/api/v1
- **Swagger docs:** http://localhost:4000/api/docs
- **Health check:** http://localhost:4000/api/v1/health
- **MinIO console:** http://localhost:9001 (user/pass dari `.env`)
- **MailHog (email dev):** http://localhost:8025

---

## Perintah berguna

```bash
pnpm docker:up        # start infra
pnpm docker:down      # stop infra
pnpm db:studio        # buka Prisma Studio (GUI database)
pnpm build            # build semua app
pnpm typecheck        # cek tipe seluruh workspace
pnpm lint             # lint
```

---

## Verifikasi cepat
1. `pnpm docker:up` → semua container "healthy".
2. `pnpm db:migrate && pnpm db:seed` → tanpa error, super admin dibuat.
3. Buka http://localhost:4000/api/v1/health/ready → `{"status":"ok","db":"up"}`.
4. Buka http://localhost:3000 → halaman Nexus ECM tampil.

Kalau keempatnya hijau, **Fase 1 selesai** dan siap lanjut ke **Fase 2 (Auth & RBAC)**.

> Catatan: file `pnpm-lock.yaml` akan dibuat otomatis saat `pnpm install` pertama kali.
> Versi dependency di `package.json` boleh disesuaikan ke rilis terbaru saat install.
