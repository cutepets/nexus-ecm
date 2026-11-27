# Nexus ECM — working guide

Source code and Prisma migrations are authoritative. Start with [`docs/system-map.md`](docs/system-map.md) for architecture and local startup; use [`docs/DEV-NEXT.md`](docs/DEV-NEXT.md) for pilot work still open.

## Change safely

- For unfamiliar code, use GitNexus query/context. Before editing a function, class, or method, run upstream impact analysis and report direct callers, affected flows, and risk. Stop and warn before HIGH/CRITICAL changes.
- Never rewrite an applied migration. Back up production data before migrations.
- Use synthetic demo data only; never add real employee biometrics, credentials, or personal data to seeds, tests, or docs.
- Before committing, run GitNexus change detection. After major code changes, refresh the index and preserve embeddings if `.gitnexus/meta.json` reports any.

## Local development

Use Node 20+, pnpm 9+, `.env`, and the Docker services. Start-up steps and URLs are in `docs/system-map.md`. Pilot inputs and acceptance evidence are in `docs/DEV-NEXT.md`.
